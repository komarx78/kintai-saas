import { calculatePayroll, calculateIncomeTax, type EmployeePayrollProfile, type AttendanceSummary } from '../payrollEngine';
import { isNursingInsuranceApplicable, lookupStandardMonthlyRemuneration, calculateSocialInsuranceDeduction, getPrefectureRate } from '../socialInsurance';

/**
 * 給与計算エンジン ＆ 社会保険計算エンジンの単体テストスイート
 */
export function runPayrollEngineTests(): { success: boolean; results: string[] } {
  const results: string[] = [];

  // ==========================================
  // テスト1: 介護保険（40歳〜64歳）の生年月日自動判定
  // ==========================================
  {
    const calcDate = new Date('2024-04-15'); // 2024年4月給与

    // 39歳（1984年5月1日生まれ → 40歳到達日は2024年4月30日 → 4月分から該当）
    const age39Turn40Apr = isNursingInsuranceApplicable('1984-05-01', calcDate);
    // 39歳（1984年5月2日生まれ → 40歳到達日は2024年5月1日 → 4月分は非該当）
    const age39Turn40May = isNursingInsuranceApplicable('1984-05-02', calcDate);
    // 25歳（1999年1月1日生まれ → 非該当）
    const youngAge = isNursingInsuranceApplicable('1999-01-01', calcDate);
    // 45歳（1979年1月1日生まれ → 該当）
    const middleAge = isNursingInsuranceApplicable('1979-01-01', calcDate);
    // 64歳（1959年5月1日生まれ → 65歳到達日は2024年4月30日 → 3月分まで該当、4月分は非該当）
    const age64Turn65Apr = isNursingInsuranceApplicable('1959-05-01', calcDate);
    // 70歳（1954年1月1日生まれ → 非該当）
    const elderlyAge = isNursingInsuranceApplicable('1954-01-01', calcDate);

    if (age39Turn40Apr === true && age39Turn40May === false && youngAge === false && middleAge === true && age64Turn65Apr === false && elderlyAge === false) {
      results.push('✅ テスト1 パス: 介護保険（40歳〜64歳）の生年月日に基づく厳密な法律準拠判定（誕生日前日基準）が完全正確');
    } else {
      results.push(`❌ テスト1 失敗: 介護保険年齢判定不整合 (39Apr:${age39Turn40Apr}, 39May:${age39Turn40May}, middle:${middleAge}, 64Apr:${age64Turn65Apr})`);
    }
  }

  // ==========================================
  // テスト2: 標準報酬月額等級（健康保険50等級・厚生年金32等級）の判定
  // ==========================================
  {
    const standard300k = lookupStandardMonthlyRemuneration(305000, 'health'); // 300,000円
    const standardPensionMax = lookupStandardMonthlyRemuneration(800000, 'pension'); // 厚生年金上限 650,000円
    const standardHealthMax = lookupStandardMonthlyRemuneration(1500000, 'health'); // 健康保険上限 1,390,000円
    const standardPensionMin = lookupStandardMonthlyRemuneration(50000, 'pension'); // 厚生年金下限 88,000円

    if (standard300k === 300000 && standardPensionMax === 650000 && standardHealthMax === 1390000 && standardPensionMin === 88000) {
      results.push('✅ テスト2 パス: 標準報酬月額表（50等級・厚生年金上限/下限）の換算が完全正確');
    } else {
      results.push(`❌ テスト2 失敗: 標準報酬月額等級換算不整合`);
    }
  }

  // ==========================================
  // テスト3: 都道府県別健康保険料率（東京・大阪）の折半計算
  // ==========================================
  {
    // 東京都（13: 9.98%, 介護 1.60%, 年金 18.30%）
    const tokyoDeduction = calculateSocialInsuranceDeduction({
      monthlySalary: 300000,
      prefectureCode: '13',
      birthDate: '1980-01-01', // 44歳（介護該当）
      isHealthEnabled: true,
      isPensionEnabled: true,
      isEmploymentEnabled: true,
    });

    // 健康保険 300,000 * 9.98% / 2 = 14,970円
    // 介護保険 300,000 * 1.60% / 2 = 2,400円
    // 厚生年金 300,000 * 18.30% / 2 = 27,450円
    // 雇用保険 300,000 * 0.6% = 1,800円
    if (tokyoDeduction.healthInsurance === 14970 && tokyoDeduction.nursingInsurance === 2400 && tokyoDeduction.pensionInsurance === 27450 && tokyoDeduction.employmentInsurance === 1800) {
      results.push('✅ テスト3 パス: 東京都・40代の社会保険料（健康・介護・厚生年金・雇用）折半計算が1円単位で完全一致');
    } else {
      results.push(`❌ テスト3 失敗: 東京都社保計算不整合 (health:${tokyoDeduction.healthInsurance}, nursing:${tokyoDeduction.nursingInsurance}, pension:${tokyoDeduction.pensionInsurance})`);
    }

    // 大阪府（27: 10.34%, 介護 1.60%）25歳（介護非該当）
    const osakaDeduction = calculateSocialInsuranceDeduction({
      monthlySalary: 300000,
      prefectureCode: '27',
      birthDate: '1999-01-01', // 25歳（介護非該当）
      isHealthEnabled: true,
      isPensionEnabled: true,
      isEmploymentEnabled: true,
    });

    // 健康保険 300,000 * 10.34% / 2 = 15,510円
    // 介護保険 0円
    if (osakaDeduction.healthInsurance === 15510 && osakaDeduction.nursingInsurance === 0) {
      results.push('✅ テスト4 パス: 大阪府・20代の都道府県別料率＆介護保険非該当が完全正確');
    } else {
      results.push(`❌ テスト4 失敗: 大阪府社保計算不整合 (health:${osakaDeduction.healthInsurance}, nursing:${osakaDeduction.nursingInsurance})`);
    }
  }

  // ==========================================
  // テスト4: 月給制の総合給与計算（社保＋所得税＋手取り）
  // ==========================================
  {
    const profile: EmployeePayrollProfile = {
      tenant_id: 'test-tenant',
      user_id: 'user-1',
      salary_type: 'monthly',
      base_salary: 300000,
      hourly_wage: 0,
      position_allowance: 30000,
      qualification_allowance: 10000,
      housing_allowance: 20000,
      family_allowance: 10000,
      commuting_allowance: 15000,
      commuting_taxable: false,
      fixed_overtime_hours: 0,
      fixed_overtime_allowance: 0,
      dependents_count: 1,
      birth_date: '1980-05-15', // 40代（介護該当）
      health_insurance_enabled: true,
      pension_insurance_enabled: true,
      employment_insurance_enabled: true,
      resident_tax_monthly: 15000,
      tax_bracket: 'kou'
    };

    const attendance: AttendanceSummary = {
      work_days: 20,
      actual_hours: 170,
      overtime_hours: 10,
      midnight_hours: 0,
      holiday_hours: 0,
      paid_leave_days: 1,
      absence_days: 0,
      late_early_hours: 0
    };

    const result = calculatePayroll(profile, attendance, { prefecture_code: '13' });

    if (result.base_salary === 300000 && result.overtime_allowance === 26562 && result.total_earnings === 411562) {
      results.push('✅ テスト5 パス: 月給制の基本給・残業手当・総支給額が1円単位で正確');
    } else {
      results.push(`❌ テスト5 失敗: total_earnings=${result.total_earnings}`);
    }

    if (result.net_salary === result.total_earnings - result.total_deductions) {
      results.push('✅ テスト6 パス: 差引手取り額が総支給 - 総控除と完全一致');
    } else {
      results.push(`❌ テスト6 失敗: 手取り額計算不整合`);
    }
  }

  const allPassed = results.every(r => r.startsWith('✅'));
  return { success: allPassed, results };
}
