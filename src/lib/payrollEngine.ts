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
  commuting_allowance: number; // 通勤手当
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
  resident_tax_monthly: number; // 住民税特別徴収額
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
 * 国税庁 源泉徴収税額表（月額表・甲欄）に基づく所得税概算算出
 * 課税対象額（総支給 - 非課税通勤費 - 社会保険料合計）と扶養親族数から算出
 */
export function calculateIncomeTax(taxableIncome: number, dependentsCount: number, taxBracket: 'kou' | 'otsu' | 'hei' = 'kou'): number {
  if (taxableIncome <= 88000) return 0;

  if (taxBracket === 'otsu') {
    // 乙欄（副業等）: 概算一律 10%〜30%
    if (taxableIncome < 100000) return Math.floor(taxableIncome * 0.03063);
    return Math.floor(taxableIncome * 0.102);
  }

  // 甲欄（本業）: 扶養控除考慮
  // 基礎控除後の実質課税対象額
  const dependentDeduction = dependentsCount * 30000;
  const netTaxable = Math.max(0, taxableIncome - dependentDeduction);

  if (netTaxable <= 88000) return 0;
  if (netTaxable <= 150000) return Math.floor((netTaxable - 88000) * 0.05105);
  if (netTaxable <= 250000) return Math.floor(3160 + (netTaxable - 150000) * 0.1021);
  if (netTaxable <= 350000) return Math.floor(13370 + (netTaxable - 250000) * 0.2042);
  if (netTaxable <= 500000) return Math.floor(33790 + (netTaxable - 350000) * 0.23483);
  return Math.floor(69015 + (netTaxable - 500000) * 0.337);
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
  const commutingAllowance = profile.commuting_allowance || 0;
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
  const residentTax = profile.resident_tax_monthly || 0;
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
