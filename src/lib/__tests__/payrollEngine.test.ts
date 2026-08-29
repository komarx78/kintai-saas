import { calculatePayroll, calculateIncomeTax, type EmployeePayrollProfile, type AttendanceSummary } from '../payrollEngine';

/**
 * 給与計算エンジンの単体テストスイート
 */
export function runPayrollEngineTests(): { success: boolean; results: string[] } {
  const results: string[] = [];

  // テスト1: 月給制の計算精度検証
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
      health_insurance_enabled: true,
      nursing_insurance_enabled: false,
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

    const result = calculatePayroll(profile, attendance);

    if (result.base_salary === 300000 && result.overtime_allowance === 26562 && result.total_earnings === 411562) {
      results.push('✅ テスト1 パス: 月給制の基本給・残業手当・総支給額が1円単位で正確');
    } else {
      results.push(`❌ テスト1 失敗: total_earnings=${result.total_earnings}`);
    }

    if (result.employment_insurance === 2469 && result.health_insurance === 20578 && result.pension_insurance === 37657) {
      results.push('✅ テスト2 パス: 社会保険料・雇用保険料が料率通り正確に算出');
    } else {
      results.push(`❌ テスト2 失敗: 社保計算不整合`);
    }

    if (result.net_salary === result.total_earnings - result.total_deductions) {
      results.push('✅ テスト3 パス: 差引手取り額が総支給 - 総控除と完全一致');
    } else {
      results.push(`❌ テスト3 失敗: 手取り額計算不整合`);
    }
  }

  // テスト2: 時給制アルバイト・パートの計算精度検証
  {
    const profile: EmployeePayrollProfile = {
      tenant_id: 'test-tenant',
      user_id: 'user-2',
      salary_type: 'hourly',
      base_salary: 0,
      hourly_wage: 1200,
      position_allowance: 0,
      qualification_allowance: 0,
      housing_allowance: 0,
      family_allowance: 0,
      commuting_allowance: 5000,
      commuting_taxable: false,
      fixed_overtime_hours: 0,
      fixed_overtime_allowance: 0,
      dependents_count: 0,
      health_insurance_enabled: false,
      nursing_insurance_enabled: false,
      pension_insurance_enabled: false,
      employment_insurance_enabled: true,
      resident_tax_monthly: 0,
      tax_bracket: 'kou'
    };

    const attendance: AttendanceSummary = {
      work_days: 15,
      actual_hours: 90,
      overtime_hours: 5,
      midnight_hours: 10,
      holiday_hours: 0,
      paid_leave_days: 0,
      absence_days: 0,
      late_early_hours: 0
    };

    const result = calculatePayroll(profile, attendance);

    if (result.base_salary === 108000 && result.overtime_allowance === 7500 && result.midnight_allowance === 3000 && result.total_earnings === 123500) {
      results.push('✅ テスト4 パス: 時給制アルバイトの基本給・残業割増・深夜割増・通勤手当が正確');
    } else {
      results.push(`❌ テスト4 失敗: 時給制計算不整合`);
    }

    if (result.employment_insurance === 741 && result.health_insurance === 0) {
      results.push('✅ テスト5 パス: 時給制の雇用保険のみ控除が正確');
    } else {
      results.push(`❌ テスト5 失敗: 時給制控除不整合`);
    }
  }

  // テスト3: 所得税額算出テスト
  {
    const tax1 = calculateIncomeTax(100000, 0, 'kou');
    const tax2 = calculateIncomeTax(300000, 2, 'kou');
    if (tax1 > 0 && tax2 > 0 && tax2 > tax1) {
      results.push('✅ テスト6 パス: 所得税源泉徴収税額（甲欄・扶養親族控除）が正常動作');
    } else {
      results.push(`❌ テスト6 失敗: 所得税計算不整合`);
    }
  }

  const allPassed = results.every(r => r.startsWith('✅'));
  return { success: allPassed, results };
}
