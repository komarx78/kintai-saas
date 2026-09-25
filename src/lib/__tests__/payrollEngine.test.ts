import { 
  calculatePayroll, 
  calculateResidentTaxLumpSum, 
  calculateRetirementIncomeTax, 
  calculateServiceYears,
  calculateBonusDeductions,
  type EmployeePayrollProfile, 
  type AttendanceSummary 
} from '../payrollEngine';
import { 
  isNursingInsuranceApplicable, 
  lookupStandardMonthlyRemuneration, 
  calculateSocialInsuranceDeduction,
  determineRetirementSocialInsuranceMonths,
  calculateSanteiKisoRemuneration,
  checkMonthlyRevisionEligibility
} from '../socialInsurance';

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
    // 東京都（13: 9.85%, 介護 1.60%, 年金 18.30%）
    const tokyoDeduction = calculateSocialInsuranceDeduction({
      monthlySalary: 300000,
      prefectureCode: '13',
      birthDate: '1980-01-01', // 44歳（介護該当）
      isHealthEnabled: true,
      isPensionEnabled: true,
      isEmploymentEnabled: true,
    });

    // 健康保険 300,000 * 9.85% / 2 = 14,775円
    // 介護保険 300,000 * 1.60% / 2 = 2,400円
    // 厚生年金 300,000 * 18.30% / 2 = 27,450円
    // 雇用保険 300,000 * 0.6% = 1,800円
    if (tokyoDeduction.healthInsurance === 14775 && tokyoDeduction.nursingInsurance === 2400 && tokyoDeduction.pensionInsurance === 27450 && tokyoDeduction.employmentInsurance === 1800) {
      results.push('✅ テスト3 パス: 東京都・40代の社会保険料（健康・介護・厚生年金・雇用）折半計算が1円単位で完全一致');
    } else {
      results.push(`❌ テスト3 失敗: 東京都社保計算不整合 (health:${tokyoDeduction.healthInsurance}, nursing:${tokyoDeduction.nursingInsurance}, pension:${tokyoDeduction.pensionInsurance})`);
    }

    // 大阪府（27: 10.13%, 介護 1.60%）25歳（介護非該当）
    const osakaDeduction = calculateSocialInsuranceDeduction({
      monthlySalary: 300000,
      prefectureCode: '27',
      birthDate: '1999-01-01', // 25歳（介護非該当）
      isHealthEnabled: true,
      isPensionEnabled: true,
      isEmploymentEnabled: true,
    });

    // 健康保険 300,000 * 10.13% / 2 = 15,195円
    // 介護保険 0円
    if (osakaDeduction.healthInsurance === 15195 && osakaDeduction.nursingInsurance === 0) {
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

  // ==========================================
  // テスト7: 退職月の社会保険料控除（健保法156条・厚年法19条）
  // ==========================================
  {
    // 3月31日退職（月末退職）: 資格喪失日は4月1日 → 3月分給与で前月分＋当月分の2ヶ月分一括徴収
    const endOfMonthResign = determineRetirementSocialInsuranceMonths('2023-04-01', '2024-03-31', true);
    // 3月15日退職（月途中退職）: 資格喪失日は3月16日 → 当月分保険料免除、前月分のみ（1ヶ月）
    const midMonthResign = determineRetirementSocialInsuranceMonths('2023-04-01', '2024-03-15', true);
    // 在籍継続中（退職なし）
    const activeEmp = determineRetirementSocialInsuranceMonths('2023-04-01', null, true);

    if (
      endOfMonthResign?.deductionMonthsCount === 2 &&
      endOfMonthResign?.isEndOfMonth === true &&
      midMonthResign?.deductionMonthsCount === 1 &&
      midMonthResign?.isEndOfMonth === false &&
      activeEmp === null
    ) {
      results.push('✅ テスト7 パス: 退職月の社会保険料（月末退職の翌月控除2ヶ月徴収＆月中退職の当月免除）判定が完全正確');
    } else {
      results.push(`❌ テスト7 失敗: 退職社保判定不整合 (月末:${endOfMonthResign?.deductionMonthsCount}, 月中:${midMonthResign?.deductionMonthsCount}, active:${activeEmp})`);
    }
  }

  // ==========================================
  // テスト8: 退職時の住民税一括徴収（地方税法第321条の5第2項）
  // ==========================================
  {
    // 3月15日退職、月額住民税10,000円 → 1〜4月退職は5月までの一括徴収必須（3月・4月・5月の計3ヶ月分 = 30,000円）
    const marchLumpSum = calculateResidentTaxLumpSum('2024-03-15', null, 10000, false);
    // 8月15日退職、一括徴収申出なし → 当月分 10,000円のみ
    const augustNoLump = calculateResidentTaxLumpSum('2024-08-15', null, 10000, false);
    // 8月15日退職、一括徴収申出あり → 8月〜翌5月の計10ヶ月分 = 100,000円
    const augustWithLump = calculateResidentTaxLumpSum('2024-08-15', null, 10000, true);

    if (
      marchLumpSum?.isLumpSumRequired === true &&
      marchLumpSum?.lumpSumAmount === 30000 &&
      augustNoLump?.isLumpSumOptional === true &&
      augustNoLump?.lumpSumAmount === 10000 &&
      augustWithLump?.lumpSumAmount === 100000
    ) {
      results.push('✅ テスト8 パス: 退職時住民税一括徴収（1〜4月退職の5月分まで義務的徴収＆申出連動）が完全正確');
    } else {
      results.push(`❌ テスト8 失敗: 住民税一括徴収不整合 (Mar:${marchLumpSum?.lumpSumAmount}, AugNo:${augustNoLump?.lumpSumAmount}, AugWith:${augustWithLump?.lumpSumAmount})`);
    }
  }

  // ==========================================
  // テスト9: 算定基礎届（定時決定）支払基礎日数判定（健保法41条・厚年法21条）
  // ==========================================
  {
    // 4月: 20日 300,000円、5月: 15日 300,000円（一般社員17日未満のため除外）、6月: 20日 320,000円
    // 有効月: 4月と6月の2ヶ月平均 = (300,000 + 320,000) / 2 = 310,000円 → 23等級（320,000円）
    const records = [
      { month: 4 as const, baseDays: 20, totalWage: 300000 },
      { month: 5 as const, baseDays: 15, totalWage: 300000 },
      { month: 6 as const, baseDays: 20, totalWage: 320000 }
    ];
    const santeiResult = calculateSanteiKisoRemuneration(records, false);

    if (
      santeiResult.validMonths.length === 2 &&
      santeiResult.validMonths.includes(4) &&
      santeiResult.validMonths.includes(6) &&
      santeiResult.excludedMonths.includes(5) &&
      santeiResult.averageWage === 310000 &&
      santeiResult.newHealthRemuneration === 320000
    ) {
      results.push('✅ テスト9 パス: 算定基礎届（4〜6月支払基礎日数17日未満除外＆有効月平均・新等級算出）が完全正確');
    } else {
      results.push(`❌ テスト9 失敗: 算定基礎届計算不整合 (valid:${santeiResult.validMonths}, avg:${santeiResult.averageWage}, new:${santeiResult.newHealthRemuneration})`);
    }
  }

  // ==========================================
  // テスト10: 随時改定（月額変更届）2等級以上の差判定（健保法43条・厚年法23条）
  // ==========================================
  {
    // 従前等級: 300,000円（健康保険22等級）
    // 変動後3ヶ月平均: 360,000円（健康保険25等級 → 3等級上昇 ≧ 2等級）
    const geppenEligible = checkMonthlyRevisionEligibility({
      currentHealthStandard: 300000,
      currentPensionStandard: 300000,
      fixedWageChangeType: 'increase',
      isShortTimeWorker: false,
      consecutiveMonths: [
        { baseDays: 20, totalWage: 360000 },
        { baseDays: 20, totalWage: 360000 },
        { baseDays: 20, totalWage: 360000 }
      ]
    });

    // 従前等級: 300,000円、変動後3ヶ月平均: 310,000円（新等級300,000円 → 0等級差、非該当）
    const geppenNotEligible = checkMonthlyRevisionEligibility({
      currentHealthStandard: 300000,
      currentPensionStandard: 300000,
      fixedWageChangeType: 'increase',
      isShortTimeWorker: false,
      consecutiveMonths: [
        { baseDays: 20, totalWage: 310000 },
        { baseDays: 20, totalWage: 310000 },
        { baseDays: 20, totalWage: 310000 }
      ]
    });

    // 高額所得者のエッジケース: 従前620,000円（健保34等級・厚年31等級） → 800,000円へ昇給
    // 健保は39等級（5等級差 ≧ 2等級、健保該当）
    // 厚年は上限の32等級（1等級差 < 2等級、厚年非該当）
    const geppenHighIncome = checkMonthlyRevisionEligibility({
      currentHealthStandard: 620000,
      currentPensionStandard: 620000,
      fixedWageChangeType: 'increase',
      isShortTimeWorker: false,
      consecutiveMonths: [
        { baseDays: 20, totalWage: 800000 },
        { baseDays: 20, totalWage: 800000 },
        { baseDays: 20, totalWage: 800000 }
      ]
    });

    if (
      geppenEligible.isEligible === true &&
      geppenEligible.isHealthEligible === true &&
      geppenEligible.isPensionEligible === true &&
      geppenEligible.healthGradeDiff >= 2 &&
      geppenNotEligible.isEligible === false &&
      geppenHighIncome.isHealthEligible === true &&
      geppenHighIncome.isPensionEligible === false &&
      geppenHighIncome.pensionGradeDiff === 1
    ) {
      results.push('✅ テスト10 パス: 随時改定（月変・3ヶ月連続基準日数クリア＆2等級差・厚年32等級上限独立判定）が完全正確');
    } else {
      results.push(`❌ テスト10 失敗: 随時改定判定不整合 (elig:${geppenEligible.isEligible}, highHealth:${geppenHighIncome.isHealthEligible}, highPension:${geppenHighIncome.isPensionEligible}, penDiff:${geppenHighIncome.pensionGradeDiff})`);
    }
  }

  // ==========================================
  // テスト11: 退職所得控除および税額計算（所得税法第30条・令和4年改正対応）
  // ==========================================
  {
    // 勤続10年（控除額: 40万円 * 10年 = 400万円）、退職金 6,000,000円、一般社員
    // 課税退職所得金額 = (6,000,000 - 4,000,000) * 1/2 = 1,000,000円
    // 所得税 = 1,000,000 * 5% = 50,000円、復興特別所得税 = 50,000 * 2.1% = 1,050円 → 合計 51,050円
    // 住民税 = 1,000,000 * 10% = 100,000円
    // 差引手取り額 = 6,000,000 - (51,050 + 100,000) = 5,848,950円
    const retResult = calculateRetirementIncomeTax({
      severancePay: 6000000,
      joinDate: '2014-04-01',
      retirementDate: '2024-03-31',
      isOfficer: false,
      isDisabilityRetirement: false
    });

    if (
      retResult.deductionAmount === 4000000 &&
      retResult.taxableRetirementIncome === 1000000 &&
      retResult.incomeTax === 51050 &&
      retResult.residentTax === 100000 &&
      retResult.totalTax === 151050 &&
      retResult.netSeverancePay === 5848950
    ) {
      results.push('✅ テスト11 パス: 退職所得控除・所得税（復興含）・住民税・差引手取り計算が完全正確');
    } else {
      results.push(`❌ テスト11 失敗: 退職所得計算不整合 (ded:${retResult.deductionAmount}, taxable:${retResult.taxableRetirementIncome}, tax:${retResult.incomeTax}, res:${retResult.residentTax}, net:${retResult.netSeverancePay})`);
    }
  }

  // ==========================================
  // テスト12: 退職所得の勤続年数暦日端数切上げ（所令69条）＆ 2022年税制改正エッジケース
  // ==========================================
  {
    // A: 暦日端数切上げ（満4年0日 vs 満4年1日）
    const syExact4 = calculateServiceYears('2020-04-01', '2024-03-31');
    const syOver4 = calculateServiceYears('2020-04-01', '2024-04-01');
    const syMidExact4 = calculateServiceYears('2020-04-15', '2024-04-14');
    const syMidOver4 = calculateServiceYears('2020-04-15', '2024-04-15');

    // B: 勤続25年（20年超: 800万 + 70万 * 5 = 1,150万円）
    const ret25Years = calculateRetirementIncomeTax({
      severancePay: 15000000,
      joinDate: '1999-04-01',
      retirementDate: '2024-03-31',
      isOfficer: false,
      isDisabilityRetirement: false
    });

    // C: 障害者退職（100万円加算 → 1,250万円控除）
    const retDisability = calculateRetirementIncomeTax({
      severancePay: 15000000,
      joinDate: '1999-04-01',
      retirementDate: '2024-03-31',
      isOfficer: false,
      isDisabilityRetirement: true
    });

    // D: 令和4年改正 短期役員退職金（勤続3年、退職金500万円）
    // 控除: 40万 * 3 = 120万円（最低80万円以上クリア）
    // 役員のため超過額 (500万 - 120万 = 380万円) に1/2適用なし（全額380万円が課税退職所得）
    const retShortOfficer = calculateRetirementIncomeTax({
      severancePay: 5000000,
      joinDate: '2021-04-01',
      retirementDate: '2024-03-31',
      isOfficer: true,
      isDisabilityRetirement: false
    });

    // E: 令和4年改正 短期一般社員退職金（勤続3年、退職金500万円）
    // 控除: 120万円。超過額380万円。
    // 一般社員のため300万円までは1/2 (150万円)、残りの80万円は全額 (80万円) → 計230万円が課税退職所得
    const retShortEmployee = calculateRetirementIncomeTax({
      severancePay: 5000000,
      joinDate: '2021-04-01',
      retirementDate: '2024-03-31',
      isOfficer: false,
      isDisabilityRetirement: false
    });

    if (
      syExact4.serviceYears === 4 &&
      syOver4.serviceYears === 5 &&
      syMidExact4.serviceYears === 4 &&
      syMidOver4.serviceYears === 5 &&
      ret25Years.deductionAmount === 11500000 &&
      retDisability.deductionAmount === 12500000 &&
      retShortOfficer.taxableRetirementIncome === 3800000 &&
      retShortEmployee.taxableRetirementIncome === 2300000
    ) {
      results.push('✅ テスト12 パス: 暦日端数切上げ（満4年0日=4年/満4年1日=5年）・勤続20年超控除・障害加算・短期役員等1/2除外（令和4年改正）が完全正確');
    } else {
      results.push(`❌ テスト12 失敗: 退職所得エッジケース不整合 (exact4:${syExact4.serviceYears}, over4:${syOver4.serviceYears}, ded25:${ret25Years.deductionAmount}, disDed:${retDisability.deductionAmount}, offTax:${retShortOfficer.taxableRetirementIncome}, empTax:${retShortEmployee.taxableRetirementIncome})`);
    }
  }

  // ==========================================
  // テスト13: 賞与控除額（健保法45条千円切捨て・厚年150万上限・誕生日前日介護判定・都道府県折半料率）
  // ==========================================
  {
    // A: 千円未満切捨て（1,000,500円 → 1,000,000円）＆ 厚生年金上限（200万円 → 150万円制限）
    const bonusHigh = calculateBonusDeductions({
      bonusGross: 2000500,
      birthDate: '1999-01-01', // 25歳（介護非該当）
      prefectureCode: '13', // 東京都
      lastMonthTaxBase: 300000,
      dependentsCount: 1
    });

    // B: 介護保険該当年齢（40歳到達日は誕生日前日）
    // 1984年7月1日生まれ → 2024年6月30日（前日）に40歳到達 → 該当
    const bonusTurn40Applicable = calculateBonusDeductions({
      bonusGross: 1000000,
      birthDate: '1984-07-01',
      targetDate: '2024-06-30',
      prefectureCode: '13',
      lastMonthTaxBase: 300000
    });

    // 1984年7月2日生まれ → 2024年6月30日時点では未到達（7月1日に到達） → 非該当
    const bonusTurn40NotApplicable = calculateBonusDeductions({
      bonusGross: 1000000,
      birthDate: '1984-07-02',
      targetDate: '2024-06-30',
      prefectureCode: '13',
      lastMonthTaxBase: 300000
    });

    // 検証:
    // bonusHigh:
    // standardBonus = 2,000,000円
    // health = 2,000,000 * 9.85% / 2 = 98,500円
    // pension = 1,500,000 * 18.30% / 2 = 137,250円（150万円上限クリア）
    // employment = 2,000,500 * 0.6% = 12,003円
    // bonusTurn40Applicable: nursing > 0
    // bonusTurn40NotApplicable: nursing === 0
    if (
      bonusHigh.standardBonus === 2000000 &&
      bonusHigh.welfarePension === 137250 &&
      bonusHigh.healthInsurance === 98500 &&
      bonusHigh.employmentInsurance === 12003 &&
      bonusTurn40Applicable.nursingInsurance > 0 &&
      bonusTurn40NotApplicable.nursingInsurance === 0
    ) {
      results.push('✅ テスト13 パス: 賞与控除（千円切捨て・厚年150万上限・誕生日前日介護判定・都道府県折半料率）が完全正確');
    } else {
      results.push(`❌ テスト13 失敗: 賞与計算不整合 (std:${bonusHigh.standardBonus}, pen:${bonusHigh.welfarePension}, health:${bonusHigh.healthInsurance}, emp:${bonusHigh.employmentInsurance}, nursingApp:${bonusTurn40Applicable.nursingInsurance}, nursingNot:${bonusTurn40NotApplicable.nursingInsurance})`);
    }
  }

  const allPassed = results.every(r => r.startsWith('✅'));

  return { success: allPassed, results };
}

// CLIから直接実行された場合の自動実行
if (typeof globalThis !== 'undefined' && (globalThis as any).process) {
  const { success, results } = runPayrollEngineTests();
  results.forEach(r => console.log(r));
  if (!success) {
    (globalThis as any).process.exit(1);
  }
}

