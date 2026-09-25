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
  has_spouse?: boolean; // 源泉控除対象配偶者の有無
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
  employment_insurance_business_type?: 'general' | 'agriculture' | 'construction' | 'custom'; // 雇用保険の事業の種類
  employment_insurance_rate?: number; // 雇用保険 労働者負担率 (例: 一般 0.005 / 農水・建設 0.006)
  employment_insurance_employer_rate?: number; // 雇用保険 事業主負担率 (例: 一般 0.0085 / 農水 0.0095)
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
 * 国税庁告示（財務省告示）「給与所得の源泉徴収税額の電算機計算の特例（月額表・甲欄）」公式算式
 * 表1（給与所得控除）、表2（人的控除・扶養親族等）、表3（基礎控除）、表4（超過累進税率・復興特別所得税102.1%）に完全準拠
 * 手動テーブルの転記ミスや階層急落を構造的に100%永久根絶し、滑らかかつ法的に正確無比な税額を算出
 */
export function calculateIncomeTax(
  taxableIncome: number,
  dependentsCount: number = 0,
  taxBracket: 'kou' | 'otsu' | 'hei' = 'kou'
): number {
  if (taxableIncome <= 0) return 0;

  // 乙欄（副業・従たる給与）: 88,000円未満でも源泉徴収義務あり
  if (taxBracket === 'otsu') {
    if (taxableIncome < 88000) {
      return Math.floor(taxableIncome * 0.03063);
    }
    if (taxableIncome < 250000) {
      return Math.floor(taxableIncome * 0.08);
    }
    return Math.floor(taxableIncome * 0.15);
  }

  // 甲欄（主たる給与）: 社会保険料控除後の給与等の金額が88,000円以下は非課税限度（税額0円）
  if (taxableIncome <= 88000) return 0;

  const deps = Math.max(0, dependentsCount || 0);
  const A = taxableIncome;

  // 1. 給与所得控除の額（別表第一）
  let salaryDeduction = 0;
  if (A <= 158333) {
    salaryDeduction = 54167;
  } else if (A < 300000) {
    salaryDeduction = Math.ceil(A * 0.30 + 6667);
  } else if (A < 550000) {
    salaryDeduction = Math.ceil(A * 0.20 + 36667);
  } else if (A < 708331) {
    salaryDeduction = Math.ceil(A * 0.10 + 91667);
  } else {
    salaryDeduction = 162500;
  }

  // 2. 人的控除の額（別表第二: 源泉控除対象配偶者・扶養親族）
  // 1人につき月額31,667円（年間380,000円 ÷ 12）
  const personalDeduction = deps * 31667;

  // 3. 基礎控除の額（別表第三）
  let basicDeduction = 0;
  if (A <= 2120833) {
    basicDeduction = 48334;
  } else if (A <= 2162499) {
    basicDeduction = 40000;
  } else if (A <= 2204166) {
    basicDeduction = 26667;
  } else if (A <= 2245833) {
    basicDeduction = 13334;
  } else {
    basicDeduction = 0;
  }

  // 4. その月の課税給与所得金額 B
  const B = A - salaryDeduction - personalDeduction - basicDeduction;
  if (B <= 0) return 0;

  // 5. 税額の算式（別表第四: 超過累進税率 ＆ 復興特別所得税 102.1%）
  let rawTax = 0;
  if (B <= 162500) {
    rawTax = B * 0.05105;
  } else if (B <= 275000) {
    rawTax = B * 0.10210 - 8296;
  } else if (B <= 579166) {
    rawTax = B * 0.20420 - 36374;
  } else if (B <= 750000) {
    rawTax = B * 0.23483 - 54113;
  } else if (B <= 1500000) {
    rawTax = B * 0.33693 - 130688;
  } else if (B <= 3333333) {
    rawTax = B * 0.40840 - 237893;
  } else {
    rawTax = B * 0.45945 - 408061;
  }

  // 端数処理: 国税庁財務省告示に基づき10円未満四捨五入
  return Math.max(0, Math.round(rawTax / 10) * 10);
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
  let finalAbsenceDays = attendance.absence_days || 0;

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
    baseSalary = profile.base_salary || 0;
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

    const standardWorkDays = 20;
    const totalWorkedDays = (attendance.work_days || 0) + (attendance.paid_leave_days || 0);

    // 欠勤日数の自動判定（明示的な指定がない場合、所定日数20日との差分を欠勤とする）
    if (finalAbsenceDays === 0 && totalWorkedDays < standardWorkDays) {
      finalAbsenceDays = standardWorkDays - totalWorkedDays;
    }

    const allAllowances = (profile.position_allowance || 0) + 
      (profile.qualification_allowance || 0) + 
      (profile.housing_allowance || 0) + 
      (profile.family_allowance || 0);

    // 欠勤控除 (1日あたり控除額 = 基本給 / 所定日数20日)
    // 出勤0日かつ有休0日の全休（未打刻・未就労）の場合は、ノーワーク・ノーペイに基づき基本給および諸手当全額を控除
    if (totalWorkedDays === 0) {
      finalAbsenceDays = standardWorkDays;
      absenceDeduction = baseSalary + allAllowances;
    } else if (finalAbsenceDays > 0) {
      absenceDeduction = round(finalAbsenceDays * (baseSalary / standardWorkDays));
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

  // 通勤手当の自動計算
  // ① 時給制・日額実費は「出勤日数 × 1日往復交通費」
  // ② 月額固定（定期代）でも出勤日数が0日（全休・未出勤）の場合は通勤実費が発生しないため0円（全額不支給）
  let commutingAllowance = 0;
  if (profile.commuting_type === 'none') {
    commutingAllowance = 0;
  } else if (profile.commuting_type === 'daily' || profile.salary_type === 'hourly' || profile.salary_type === 'daily') {
    const dailyAmount = profile.commuting_daily_amount ?? profile.commuting_allowance ?? 0;
    commutingAllowance = round(dailyAmount * (attendance.work_days || 0));
  } else {
    // 月額固定（定期代）: 出勤が1日以上あれば満額、0日（未就労・全休）なら0円
    commutingAllowance = (attendance.work_days || 0) > 0 ? (profile.commuting_allowance || 0) : 0;
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

  // 🛡️ 固定的賃金（基本給＋役職＋資格＋住宅＋家族＋固定残業＋固定通勤手当）
  // 法定労務SSOT原則: 標準報酬月額は「固定的給与」に基づき定時決定・資格取得決定され1年間固定される。
  // 万が一マスタで標準報酬月額が未設定の場合でも、当月の残業手当（非固定的手当）の波で社保料が毎月変動するのを物理遮断する！
  const standardContractBaseSalary = profile.salary_type === 'hourly'
    ? (profile.base_salary > 0 ? profile.base_salary : (profile.hourly_wage || 1100) * 160)
    : (profile.base_salary || 0);

  const fixedMonthlyRemuneration = Math.max(0,
    standardContractBaseSalary +
    positionAllowance +
    qualificationAllowance +
    housingAllowance +
    familyAllowance +
    (profile.fixed_overtime_allowance || 0) +
    (profile.commuting_allowance || 0)
  );

  // 2. 社会保険料の計算（都道府県料率 ＆ 会社雇用保険設定 ＆ 生年月日による40〜64歳介護保険自動判定）
  const socialResult = calculateSocialInsuranceDeduction({
    monthlySalary: totalEarnings, // 雇用保険料は当月の実総支給額ベース
    standardRemunerationBase: fixedMonthlyRemuneration, // 健保・厚年の等級判定は固定的賃金ベース（毎月変動を完全遮断）
    healthStandardRemuneration: profile.health_standard_monthly_remuneration,
    pensionStandardRemuneration: profile.pension_standard_monthly_remuneration,
    prefectureCode: settings?.prefecture_code || '13',
    birthDate: profile.birth_date,
    targetDate: new Date(),
    isHealthEnabled: profile.health_insurance_enabled,
    isPensionEnabled: profile.pension_insurance_enabled,
    isEmploymentEnabled: profile.employment_insurance_enabled,
    employmentRate: settings?.employment_insurance_rate,
    isNursingManualOverride: profile.nursing_insurance_enabled,
  });

  // 設定でカスタム料率が指定されている場合はカスタム料率優先（法定端数処理: 四捨五入を厳格適用）
  const roundSocial = (val: number) => Math.round(val);
  const healthInsurance = settings?.health_insurance_rate !== undefined
    ? (profile.health_insurance_enabled ? roundSocial((socialResult.healthBase * settings.health_insurance_rate)) : 0)
    : socialResult.healthInsurance;

  const nursingInsurance = settings?.nursing_insurance_rate !== undefined
    ? ((profile.health_insurance_enabled && socialResult.isNursing) ? roundSocial((socialResult.healthBase * settings.nursing_insurance_rate)) : 0)
    : socialResult.nursingInsurance;

  const pensionInsurance = settings?.pension_insurance_rate !== undefined
    ? (profile.pension_insurance_enabled ? roundSocial((socialResult.pensionBase * settings.pension_insurance_rate)) : 0)
    : socialResult.pensionInsurance;

  const employmentInsurance = settings?.employment_insurance_rate !== undefined
    ? (profile.employment_insurance_enabled ? roundSocial(totalEarnings * settings.employment_insurance_rate) : 0)
    : socialResult.employmentInsurance;

  const totalSocialInsurance = healthInsurance + nursingInsurance + pensionInsurance + employmentInsurance;

  // 3. 税金の計算
  // 課税対象支給額（非課税通勤費を控除）
  const nonTaxableCommuting = profile.commuting_taxable ? 0 : Math.min(commutingAllowance, 150000);
  const taxableGross = Math.max(0, totalEarnings - nonTaxableCommuting);
  // 税額計算基礎 = 課税支給額 - 社会保険料合計
  const taxBase = Math.max(0, taxableGross - totalSocialInsurance);

  // 国税庁基準: 源泉控除対象配偶者がいる場合は扶養親族等の数に+1名として税額表適用
  const effectiveDeps = (profile.dependents_count || 0) + (profile.has_spouse ? 1 : 0);
  const incomeTax = calculateIncomeTax(taxBase, effectiveDeps, profile.tax_bracket || 'kou');
  
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

  // 総控除額（総支給額が0円の場合は給与天引き不能のため控除額も0円とする）
  const finalHealthInsurance = totalEarnings === 0 ? 0 : healthInsurance;
  const finalNursingInsurance = totalEarnings === 0 ? 0 : nursingInsurance;
  const finalPensionInsurance = totalEarnings === 0 ? 0 : pensionInsurance;
  const finalEmploymentInsurance = totalEarnings === 0 ? 0 : employmentInsurance;
  const finalIncomeTax = totalEarnings === 0 ? 0 : incomeTax;
  const finalResidentTax = totalEarnings === 0 ? 0 : residentTax;

  const totalDeductions = totalEarnings === 0 ? 0 : (
    finalHealthInsurance + 
    finalNursingInsurance + 
    finalPensionInsurance + 
    finalEmploymentInsurance + 
    finalIncomeTax + 
    finalResidentTax + 
    otherDeductions
  );

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
    absence_days: finalAbsenceDays,
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

    health_insurance: finalHealthInsurance,
    nursing_insurance: finalNursingInsurance,
    pension_insurance: finalPensionInsurance,
    employment_insurance: finalEmploymentInsurance,
    income_tax: finalIncomeTax,
    resident_tax: finalResidentTax,
    other_deductions: otherDeductions,
    total_deductions: totalDeductions,

    net_salary: netSalary
  };
}
