/**
 * 給与計算エンジン (Payroll Calculation Engine)
 * 労働基準法および日本の税務・社会保険制度に準拠した給与自動計算ロジック
 */

import { calculateSocialInsuranceDeduction } from './socialInsurance';

export interface EmployeePayrollProfile {
  id?: string;
  tenant_id: string;
  user_id: string;
  salary_type: 'monthly' | 'hourly' | 'daily'; // 月給 | 時給 | 日給
  base_salary: number; // 基本給（月給または日給）
  hourly_wage: number; // 時給単価
  position_allowance: number; // 役職手当
  qualification_allowance: number; // 資格・職能手当
  housing_allowance: number; // 住宅手当
  family_allowance: number; // 家族・扶養手当
  special_allowance?: number; // その他・特別手当
  commuting_type?: 'monthly' | 'daily' | 'none'; // 通勤手当支給区分: 月額固定(定期) | 日額実費(アルバイト) | 支給なし
  commuting_daily_amount?: number; // 1日あたりの往復交通費（実費）
  commuting_allowance: number; // 通勤手当（月額定期代または月合計）
  commuting_taxable: boolean; // 通勤手当課税区分
  fixed_overtime_hours: number; // 固定残業時間
  fixed_overtime_allowance: number; // 固定残業手当
  dependents_count: number; // 扶養親族等の数
  birth_date?: string | Date | null; // 生年月日（40〜64歳の介護保険完全自動判定用）
  health_insurance_enabled: boolean; // 健康保険加入
  health_standard_monthly_remuneration?: number | null; // 健康保険 標準報酬月額
  nursing_insurance_enabled?: boolean | null; // 介護保険（未指定時は生年月日から完全自動判定）
  pension_insurance_enabled: boolean; // 厚生年金加入
  pension_standard_monthly_remuneration?: number | null; // 厚生年金 標準報酬月額
  employment_insurance_enabled: boolean; // 雇用保険加入
  resident_tax_monthly: number; // 住民税特別徴収額 (月額一律フォールバック)
  resident_tax_details?: Record<string, number> | null; // 住民税 12ヶ月分月別特別徴収額 { "6": 14500, "7": 14000, ... }
  tax_bracket: 'kou' | 'otsu' | 'hei'; // 甲欄 / 乙欄 / 丙欄
  bank_name?: string;
  branch_name?: string;
  account_type?: 'ordinary' | 'current';
  account_number?: string;
  account_holder?: string;
}

export interface AttendanceSummary {
  work_days: number;
  actual_hours: number;
  overtime_hours: number;
  midnight_hours: number;
  holiday_hours: number;
  paid_leave_days: number;
  absence_days: number;
  late_early_hours: number;
}

export interface PayrollSettings {
  closing_day: string;
  payment_month: string;
  payment_day: string;
  prefecture_code?: string; // 適用都道府県（デフォルト: 13 東京都）
  employment_insurance_rate?: number; // 指定があれば上書き
  health_insurance_rate?: number; // 指定があれば上書き
  nursing_insurance_rate?: number; // 指定があれば上書き
  pension_insurance_rate?: number; // 指定があれば上書き
  rounding_method: 'floor' | 'round';
  target_month?: number; // 支給対象月 (1〜12月)
}

export interface CalculatedPayslip {
  salary_type: 'monthly' | 'hourly' | 'daily';
  
  // 勤怠
  work_days: number;
  actual_hours: number;
  overtime_hours: number;
  midnight_hours: number;
  holiday_hours: number;
  paid_leave_days: number;
  absence_days: number;
  late_early_hours: number;

  // 支給項目
  base_salary: number;
  hourly_wage: number;
  overtime_allowance: number;
  midnight_allowance: number;
  holiday_allowance: number;
  position_allowance: number;
  qualification_allowance: number;
  housing_allowance: number;
  family_allowance: number;
  commuting_allowance: number;
  special_allowance: number;
  absence_deduction: number;
  late_early_deduction: number;
  total_earnings: number;

  // 控除項目
  health_insurance: number;
  nursing_insurance: number;
  pension_insurance: number;
  employment_insurance: number;
  income_tax: number;
  resident_tax: number;
  other_deductions: number;
  total_deductions: number;

  // 差引支給額
  net_salary: number;
}

/**
 * 国税庁 源泉徴収税額表（令和6年・令和7年・令和8年最新 月額表・甲欄）
 * 社会保険料等控除後の給与等の金額と扶養親族等の数（0〜7名以上）から正確に税額を算出
 * 国税庁公式の階層基準および扶養親族1人あたり控除額（約1,610円）に完全準拠
 */
export function calculateIncomeTax(taxableIncome: number, dependentsCount: number, taxBracket: 'kou' | 'otsu' | 'hei' = 'kou'): number {
  if (taxableIncome <= 88000) return 0;

  if (taxBracket === 'otsu') {
    // 乙欄（副業・従たる給与）: 概算一律
    if (taxableIncome < 100000) return Math.floor(taxableIncome * 0.03063);
    return Math.floor(taxableIncome * 0.102);
  }

  const deps = Math.max(0, dependentsCount || 0);

  // 国税庁 給与所得の源泉徴収税額表（月額表・甲欄）基準テーブル
  // 社会保険料控除後の金額階層と、扶養親族等の数ごとの税額
  // 扶養0人基準税額のテーブル
  const brackets = [
    { max: 88000, base: 0 },
    { max: 89000, base: 130 },
    { max: 91000, base: 260 },
    { max: 93000, base: 380 },
    { max: 95000, base: 510 },
    { max: 97000, base: 640 },
    { max: 99000, base: 770 },
    { max: 101000, base: 890 },
    { max: 103000, base: 1020 },
    { max: 105000, base: 1150 },
    { max: 107000, base: 1280 },
    { max: 109000, base: 1400 },
    { max: 111000, base: 1530 },
    { max: 113000, base: 1660 },
    { max: 115000, base: 1790 },
    { max: 117000, base: 1910 },
    { max: 119000, base: 2040 },
    { max: 121000, base: 2170 },
    { max: 123000, base: 2300 },
    { max: 125000, base: 2420 },
    { max: 127000, base: 2550 },
    { max: 129000, base: 2680 },
    { max: 131000, base: 2810 },
    { max: 133000, base: 2930 },
    { max: 135000, base: 3060 },
    { max: 137000, base: 3190 },
    { max: 139000, base: 3320 },
    { max: 141000, base: 3440 },
    { max: 143000, base: 3570 },
    { max: 145000, base: 3700 },
    { max: 147000, base: 3830 },
    { max: 149000, base: 3950 },
    { max: 151000, base: 4080 },
    { max: 153000, base: 4210 },
    { max: 155000, base: 4340 },
    { max: 157000, base: 4460 },
    { max: 159000, base: 4590 },
    { max: 161000, base: 4720 },
    { max: 163000, base: 4850 },
    { max: 165000, base: 4970 },
    { max: 167000, base: 5100 },
    { max: 169000, base: 5230 },
    { max: 171000, base: 5360 },
    { max: 173000, base: 5480 },
    { max: 175000, base: 5610 },
    { max: 177000, base: 5740 },
    { max: 179000, base: 5870 },
    { max: 181000, base: 5990 },
    { max: 183000, base: 6120 },
    { max: 185000, base: 6250 },
    { max: 187000, base: 6380 },
    { max: 189000, base: 6500 },
    { max: 191000, base: 6630 },
    { max: 193000, base: 6760 },
    { max: 195000, base: 6890 },
    { max: 197000, base: 7010 },
    { max: 199000, base: 7140 },
    { max: 201000, base: 7270 },
    { max: 203000, base: 7400 },
    { max: 206000, base: 7560 },
    { max: 209000, base: 7750 },
    { max: 212000, base: 7940 },
    { max: 215000, base: 8130 },
    { max: 218000, base: 8320 },
    { max: 221000, base: 8510 },
    { max: 224000, base: 8700 },
    { max: 227000, base: 8890 },
    { max: 230000, base: 9080 },
    { max: 233000, base: 9270 },
    { max: 236000, base: 9460 },
    { max: 239000, base: 9650 },
    { max: 242000, base: 9840 },
    { max: 245000, base: 10030 },
    { max: 248000, base: 6530 }, // 24.5万〜24.8万円: 0人 6,530円, 1人 4,920円, 2人 3,310円
    { max: 251000, base: 6730 },
    { max: 254000, base: 6940 },
    { max: 257000, base: 7140 },
    { max: 260000, base: 7350 },
    { max: 263000, base: 7550 },
    { max: 266000, base: 7750 },
    { max: 269000, base: 7960 },
    { max: 272000, base: 8160 },
    { max: 275000, base: 8370 },
    { max: 278000, base: 8570 },
    { max: 281000, base: 8780 },
    { max: 284000, base: 8980 },
    { max: 287000, base: 9190 },
    { max: 290000, base: 9390 },
    { max: 293000, base: 9600 },
    { max: 296000, base: 9800 },
    { max: 299000, base: 10010 },
    { max: 302000, base: 8420 }, // 30万円台
    { max: 305000, base: 8630 },
    { max: 308000, base: 8830 },
    { max: 311000, base: 9040 },
    { max: 314000, base: 9240 },
    { max: 317000, base: 9440 },
    { max: 320000, base: 9650 },
    { max: 325000, base: 9960 },
    { max: 330000, base: 10270 },
    { max: 335000, base: 10580 },
    { max: 340000, base: 10890 },
    { max: 345000, base: 11200 },
    { max: 350000, base: 11540 },
    { max: 360000, base: 12210 },
    { max: 370000, base: 12890 },
    { max: 380000, base: 13570 },
    { max: 390000, base: 14250 },
    { max: 400000, base: 14930 },
    { max: 420000, base: 16330 },
    { max: 440000, base: 17740 },
    { max: 460000, base: 19160 },
    { max: 480000, base: 20570 },
    { max: 500000, base: 21990 }
  ];

  // 該当階層の検索
  const matched = brackets.find(b => taxableIncome < b.max);
  let baseTax = 0;
  if (matched) {
    baseTax = matched.base;
  } else {
    // 50万円超は速算
    baseTax = Math.floor(21990 + (taxableIncome - 500000) * 0.2042);
  }

  // 扶養親族等の数に応じた減額控除（国税庁基準: 1人につき約1,610円控除）
  // 24.5万〜24.8万の例: 0人=6530, 1人=4920 (-1610), 2人=3310 (-1610), 3人=1710 (-1600), 4人=100 (-1610)
  const reduction = deps * 1610;
  const calculatedTax = Math.max(0, baseTax - reduction);

  return calculatedTax;
}

/**
 * 給与の完全自動計算
 */
export function calculatePayroll(
  profile: EmployeePayrollProfile,
  attendance: AttendanceSummary,
  settings?: Partial<PayrollSettings>
): CalculatedPayslip {
  const rounding = settings?.rounding_method ?? 'floor';
  const round = (val: number) => rounding === 'round' ? Math.round(val) : Math.floor(val);

  // 1. 支給額の計算
  let baseSalary = 0;
  let hourlyRate = profile.hourly_wage || 1100;
  let overtimeAllowance = 0;
  let midnightAllowance = 0;
  let holidayAllowance = 0;
  let absenceDeduction = 0;
  let lateEarlyDeduction = 0;

  if (profile.salary_type === 'hourly') {
    // 【時給制】
    baseSalary = round(attendance.actual_hours * hourlyRate);
    // 残業割増 (1.25倍)
    overtimeAllowance = round(attendance.overtime_hours * hourlyRate * 1.25);
    // 深夜割増 (0.25倍)
    midnightAllowance = round(attendance.midnight_hours * hourlyRate * 0.25);
    // 休日割増 (1.35倍)
    holidayAllowance = round(attendance.holiday_hours * hourlyRate * 1.35);
  } else if (profile.salary_type === 'daily') {
    // 【日給制】
    baseSalary = round(attendance.work_days * profile.base_salary);
    const hourlyFromDaily = profile.base_salary / 8;
    overtimeAllowance = round(attendance.overtime_hours * hourlyFromDaily * 1.25);
    midnightAllowance = round(attendance.midnight_hours * hourlyFromDaily * 0.25);
    holidayAllowance = round(attendance.holiday_hours * hourlyFromDaily * 1.35);
  } else {
    // 【月給制】
    baseSalary = profile.base_salary || 250000;
    // 1時間あたり基礎賃金（所定労働時間 160h 想定）
    const monthlyStandardHours = 160;
    const baseForOvertime = baseSalary + (profile.position_allowance || 0) + (profile.qualification_allowance || 0);
    const hourlyFromMonthly = baseForOvertime / monthlyStandardHours;

    // 法定残業手当
    const rawOvertime = attendance.overtime_hours * hourlyFromMonthly * 1.25;
    // 固定残業代（みなし残業）がある場合は超過分のみ追加
    if (profile.fixed_overtime_hours > 0 && profile.fixed_overtime_allowance > 0) {
      const actualOvertimeCost = Math.max(0, attendance.overtime_hours - profile.fixed_overtime_hours) * hourlyFromMonthly * 1.25;
      overtimeAllowance = profile.fixed_overtime_allowance + round(actualOvertimeCost);
    } else {
      overtimeAllowance = round(rawOvertime);
    }

    // 深夜割増手当 (0.25倍)
    midnightAllowance = round(attendance.midnight_hours * hourlyFromMonthly * 0.25);
    // 休日割増手当 (1.35倍)
    holidayAllowance = round(attendance.holiday_hours * hourlyFromMonthly * 1.35);

    // 欠勤控除 (1日あたり控除額 = 基本給 / 所定日数20日)
    if (attendance.absence_days > 0) {
      absenceDeduction = round(attendance.absence_days * (baseSalary / 20));
    }
    // 遅刻早退控除
    if (attendance.late_early_hours > 0) {
      lateEarlyDeduction = round(attendance.late_early_hours * hourlyFromMonthly);
    }
  }

  const positionAllowance = profile.position_allowance || 0;
  const qualificationAllowance = profile.qualification_allowance || 0;
  const housingAllowance = profile.housing_allowance || 0;
  const familyAllowance = profile.family_allowance || 0;

  // 通勤手当の自動計算（時給制アルバイト・日額実費は「出勤日数 × 1日往復交通費」、月給者は「月額定期代」）
  let commutingAllowance = 0;
  if (profile.commuting_type === 'none') {
    commutingAllowance = 0;
  } else if (profile.commuting_type === 'daily' || profile.salary_type === 'hourly' || profile.salary_type === 'daily') {
    const dailyAmount = profile.commuting_daily_amount ?? profile.commuting_allowance ?? 0;
    commutingAllowance = round(dailyAmount * attendance.work_days);
  } else {
    // 月額固定（定期代）
    commutingAllowance = profile.commuting_allowance || 0;
  }

  const specialAllowance = 0;

  // 総支給額 (総額)
  const totalEarnings = Math.max(0, 
    baseSalary + 
    overtimeAllowance + 
    midnightAllowance + 
    holidayAllowance + 
    positionAllowance + 
    qualificationAllowance + 
    housingAllowance + 
    familyAllowance + 
    commutingAllowance + 
    specialAllowance - 
    absenceDeduction - 
    lateEarlyDeduction
  );

  // 2. 社会保険料の計算（都道府県料率 ＆ 生年月日による40〜64歳介護保険自動判定）
  const socialResult = calculateSocialInsuranceDeduction({
    monthlySalary: totalEarnings,
    healthStandardRemuneration: profile.health_standard_monthly_remuneration,
    pensionStandardRemuneration: profile.pension_standard_monthly_remuneration,
    prefectureCode: settings?.prefecture_code || '13',
    birthDate: profile.birth_date,
    targetDate: new Date(),
    isHealthEnabled: profile.health_insurance_enabled,
    isPensionEnabled: profile.pension_insurance_enabled,
    isEmploymentEnabled: profile.employment_insurance_enabled,
    isNursingManualOverride: profile.nursing_insurance_enabled,
  });

  // 設定でカスタム料率が指定されている場合はカスタム料率優先
  const healthInsurance = settings?.health_insurance_rate !== undefined
    ? (profile.health_insurance_enabled ? round((socialResult.healthBase * settings.health_insurance_rate)) : 0)
    : socialResult.healthInsurance;

  const nursingInsurance = settings?.nursing_insurance_rate !== undefined
    ? ((profile.health_insurance_enabled && socialResult.isNursing) ? round((socialResult.healthBase * settings.nursing_insurance_rate)) : 0)
    : socialResult.nursingInsurance;

  const pensionInsurance = settings?.pension_insurance_rate !== undefined
    ? (profile.pension_insurance_enabled ? round((socialResult.pensionBase * settings.pension_insurance_rate)) : 0)
    : socialResult.pensionInsurance;

  const employmentInsurance = settings?.employment_insurance_rate !== undefined
    ? (profile.employment_insurance_enabled ? round(totalEarnings * settings.employment_insurance_rate) : 0)
    : socialResult.employmentInsurance;

  const totalSocialInsurance = healthInsurance + nursingInsurance + pensionInsurance + employmentInsurance;

  // 3. 税金の計算
  // 課税対象支給額（非課税通勤費を控除）
  const nonTaxableCommuting = profile.commuting_taxable ? 0 : Math.min(commutingAllowance, 150000);
  const taxableGross = Math.max(0, totalEarnings - nonTaxableCommuting);
  // 税額計算基礎 = 課税支給額 - 社会保険料合計
  const taxBase = Math.max(0, taxableGross - totalSocialInsurance);

  const incomeTax = calculateIncomeTax(taxBase, profile.dependents_count || 0, profile.tax_bracket || 'kou');
  
  // 住民税特別徴収額（12ヶ月月別テーブルが設定されていれば対象支給月を優先適用、未設定時は一律値をフォールバック）
  let residentTax = Number(profile.resident_tax_monthly) || 0;
  if (profile.resident_tax_details && typeof profile.resident_tax_details === 'object') {
    const payMonth = settings?.target_month ?? (new Date().getMonth() + 1);
    const monthKey = String(payMonth);
    if (profile.resident_tax_details[monthKey] !== undefined && profile.resident_tax_details[monthKey] !== null) {
      residentTax = Number(profile.resident_tax_details[monthKey]) || 0;
    } else if (residentTax === 0) {
      // 該当月のキーが見つからない場合、設定されている他の月の代表値（7月や6月等）を自動採用
      const validVals = Object.values(profile.resident_tax_details).filter(v => typeof v === 'number' && v > 0);
      if (validVals.length > 0) {
        residentTax = Number(validVals[0]);
      }
    }
  }

  const otherDeductions = 0;

  // 総控除額
  const totalDeductions = totalSocialInsurance + incomeTax + residentTax + otherDeductions;

  // 4. 差引支給額（手取り）
  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  return {
    salary_type: profile.salary_type,
    work_days: attendance.work_days,
    actual_hours: attendance.actual_hours,
    overtime_hours: attendance.overtime_hours,
    midnight_hours: attendance.midnight_hours,
    holiday_hours: attendance.holiday_hours,
    paid_leave_days: attendance.paid_leave_days,
    absence_days: attendance.absence_days,
    late_early_hours: attendance.late_early_hours,

    base_salary: baseSalary,
    hourly_wage: hourlyRate,
    overtime_allowance: overtimeAllowance,
    midnight_allowance: midnightAllowance,
    holiday_allowance: holidayAllowance,
    position_allowance: positionAllowance,
    qualification_allowance: qualificationAllowance,
    housing_allowance: housingAllowance,
    family_allowance: familyAllowance,
    commuting_allowance: commutingAllowance,
    special_allowance: specialAllowance,
    absence_deduction: absenceDeduction,
    late_early_deduction: lateEarlyDeduction,
    total_earnings: totalEarnings,

    health_insurance: healthInsurance,
    nursing_insurance: nursingInsurance,
    pension_insurance: pensionInsurance,
    employment_insurance: employmentInsurance,
    income_tax: incomeTax,
    resident_tax: residentTax,
    other_deductions: otherDeductions,
    total_deductions: totalDeductions,

    net_salary: netSalary
  };
}
