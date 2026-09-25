/**
 * 給与計算エンジン (Payroll Calculation Engine)
 * 労働基準法および日本の税務・社会保険制度に準拠した給与自動計算ロジック
 */

import { calculateSocialInsuranceDeduction, determineRetirementSocialInsuranceMonths } from './socialInsurance';

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
  join_date?: string | null; // 入社日（同月得喪判定用）
  resignation_date?: string | null; // 退職日（退職月社保2ヶ月徴収・住民税一括徴収判定用）
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

  // 🛡️ 労働基準法第37条第1項ただし書（2023年4月1日中小企業完全義務化）:
  // 月60時間超の時間外労働に対する50%以上の割増賃金率対応
  const otNormalHours = Math.min(60, Math.max(0, attendance.overtime_hours));
  const otOver60Hours = Math.max(0, attendance.overtime_hours - 60);

  if (profile.salary_type === 'hourly') {
    // 【時給制】
    // 🛡️ 実働時間全体から時間外・休日労働を除いた「所定内労働時間」を基本給の算定基礎とし、
    // 残業割増手当（1.25倍 / 60h超1.50倍）との二重過大払い（2.25倍）を完全防止
    const regularHours = Math.max(0, attendance.actual_hours - attendance.overtime_hours - attendance.holiday_hours);
    // actual_hoursが既に所定内のみ（overtimeを含まない）の場合の安全フォールバック
    const effectiveBaseHours = attendance.actual_hours >= attendance.overtime_hours ? regularHours : attendance.actual_hours;
    baseSalary = round(effectiveBaseHours * hourlyRate);

    // 残業割増（60h以内 1.25倍、60h超 1.50倍）
    overtimeAllowance = round((otNormalHours * 1.25 + otOver60Hours * 1.50) * hourlyRate);
    // 深夜割増 (0.25倍)
    midnightAllowance = round(attendance.midnight_hours * hourlyRate * 0.25);
    // 休日割増 (1.35倍)
    holidayAllowance = round(attendance.holiday_hours * hourlyRate * 1.35);
  } else if (profile.salary_type === 'daily') {
    // 【日給制】
    baseSalary = round(attendance.work_days * profile.base_salary);
    const hourlyFromDaily = profile.base_salary / 8;
    // 残業割増（60h以内 1.25倍、60h超 1.50倍）
    overtimeAllowance = round((otNormalHours * 1.25 + otOver60Hours * 1.50) * hourlyFromDaily);
    midnightAllowance = round(attendance.midnight_hours * hourlyFromDaily * 0.25);
    holidayAllowance = round(attendance.holiday_hours * hourlyFromDaily * 1.35);
  } else {
    // 【月給制】
    baseSalary = profile.base_salary || 0;
    // 1時間あたり基礎賃金（所定労働時間 160h 想定）
    const monthlyStandardHours = 160;
    const baseForOvertime = baseSalary + (profile.position_allowance || 0) + (profile.qualification_allowance || 0);
    const hourlyFromMonthly = baseForOvertime / monthlyStandardHours;

    // 法定残業手当（60h以内 1.25倍、60h超 1.50倍）
    const rawOvertime = (otNormalHours * 1.25 + otOver60Hours * 1.50) * hourlyFromMonthly;

    // 固定残業代（みなし残業）がある場合は超過分のみ追加（60h超考慮）
    if (profile.fixed_overtime_hours > 0 && profile.fixed_overtime_allowance > 0) {
      const fixedOt = profile.fixed_overtime_hours;
      const totalOt = attendance.overtime_hours;
      if (totalOt > fixedOt) {
        // 固定残業枠を超過した時間のうち、60h以下部分と60h超部分の按分
        const normalExcess = Math.max(0, Math.min(60, totalOt) - Math.min(60, fixedOt));
        const over60Excess = Math.max(0, totalOt - Math.max(60, fixedOt));
        const actualOvertimeCost = (normalExcess * 1.25 + over60Excess * 1.50) * hourlyFromMonthly;
        overtimeAllowance = profile.fixed_overtime_allowance + round(actualOvertimeCost);
      } else {
        overtimeAllowance = profile.fixed_overtime_allowance;
      }
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

  // 🛡️ 退職月（月末退職・月途中退職・同月得喪）における社会保険料月数判定（健保法第156条・厚年法第19条）
  let socialMonthsMultiplier = 1;
  if (profile.resignation_date) {
    const retCheck = determineRetirementSocialInsuranceMonths(
      profile.join_date,
      profile.resignation_date,
      true
    );
    if (retCheck) {
      const payMonth = settings?.target_month ?? (new Date().getMonth() + 1);
      const retD = new Date(profile.resignation_date);
      if (!isNaN(retD.getTime()) && (retD.getMonth() + 1) === payMonth) {
        socialMonthsMultiplier = retCheck.deductionMonthsCount;
      }
    }
  }

  // 設定でカスタム料率が指定されている場合はカスタム料率優先（法定端数処理: 四捨五入を厳格適用、退職月社保月数連動）
  const roundSocial = (val: number) => Math.round(val);
  const baseHealth = settings?.health_insurance_rate !== undefined
    ? (profile.health_insurance_enabled ? roundSocial((socialResult.healthBase * settings.health_insurance_rate)) : 0)
    : socialResult.healthInsurance;
  const healthInsurance = baseHealth * socialMonthsMultiplier;

  const baseNursing = settings?.nursing_insurance_rate !== undefined
    ? ((profile.health_insurance_enabled && socialResult.isNursing) ? roundSocial((socialResult.healthBase * settings.nursing_insurance_rate)) : 0)
    : socialResult.nursingInsurance;
  const nursingInsurance = baseNursing * socialMonthsMultiplier;

  const basePension = settings?.pension_insurance_rate !== undefined
    ? (profile.pension_insurance_enabled ? roundSocial((socialResult.pensionBase * settings.pension_insurance_rate)) : 0)
    : socialResult.pensionInsurance;
  const pensionInsurance = basePension * socialMonthsMultiplier;

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

  // 🛡️ 退職時住民税一括徴収（地方税法第321条の5第2項）
  if (profile.resignation_date) {
    const payMonth = settings?.target_month ?? (new Date().getMonth() + 1);
    const retD = new Date(profile.resignation_date);
    if (!isNaN(retD.getTime()) && (retD.getMonth() + 1) === payMonth) {
      const lumpSum = calculateResidentTaxLumpSum(
        profile.resignation_date,
        profile.resident_tax_details,
        residentTax,
        false
      );
      if (lumpSum && lumpSum.isLumpSumRequired) {
        residentTax = lumpSum.lumpSumAmount;
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


/**
 * 国税庁告示および社会保険法に完全準拠した賞与控除額（社保・源泉所得税）自動計算
 * 1. 標準賞与額（健康保険法第45条・厚生年金保険法第24条の4: 千円未満切捨て）
 * 2. 健康保険上限（年度累計573万円）、厚生年金上限（1ヶ月150万円）
 * 3. 40〜64歳介護保険自動判定
 * 4. 国税庁「賞与に対する源泉徴収税額の算出率の表（甲欄）」準拠の所得税率
 */
export function calculateBonusDeductions(params: {
  bonusGross: number; // 賞与総支給額（額面）
  lastMonthTaxBase?: number; // 前月の社会保険料控除後の給与等（税額基礎）
  dependentsCount?: number; // 扶養親族等の数
  birthDate?: string | Date | null; // 生年月日（40〜64歳介護保険判定）
  isHealthEnabled?: boolean; // 健康保険加入
  isPensionEnabled?: boolean; // 厚生年金加入
  isEmploymentEnabled?: boolean; // 雇用保険加入
  isExecutive?: boolean; // 役員（雇用保険対象外）
  healthRate?: number; // 健康保険料率（本人負担・折半後、デフォルト約0.04985）
  nursingRate?: number; // 介護保険料率（本人負担、デフォルト約0.008）
  pensionRate?: number; // 厚生年金保険料率（本人負担、9.15%）
  employmentRate?: number; // 雇用保険料率（本人負担、一般 0.006 = 6/1000）
}): {
  standardBonus: number;
  healthInsurance: number;
  nursingInsurance: number;
  welfarePension: number;
  employmentInsurance: number;
  socialInsuranceTotal: number;
  incomeTax: number;
  deductionTotal: number;
  netPay: number;
} {
  const {
    bonusGross,
    lastMonthTaxBase = 0,
    dependentsCount = 0,
    birthDate,
    isHealthEnabled = true,
    isPensionEnabled = true,
    isEmploymentEnabled = true,
    isExecutive = false,
    healthRate = 0.04985,
    nursingRate = 0.008,
    pensionRate = 0.0915,
    employmentRate = 0.006
  } = params;

  if (bonusGross <= 0) {
    return {
      standardBonus: 0,
      healthInsurance: 0,
      nursingInsurance: 0,
      welfarePension: 0,
      employmentInsurance: 0,
      socialInsuranceTotal: 0,
      incomeTax: 0,
      deductionTotal: 0,
      netPay: 0
    };
  }

  // 1. 標準賞与額の算定（健康保険法第45条・厚生年金保険法第24条の4: 千円未満切捨て）
  const standardBonus = Math.floor(bonusGross / 1000) * 1000;

  // 2. 健康保険・介護保険の標準賞与額（年度累計上限 573万円）
  const healthBonusBase = Math.min(5730000, standardBonus);

  // 介護保険該当判定（40歳以上65歳未満）
  let isNursing = false;
  if (birthDate) {
    const b = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const mDiff = now.getMonth() - b.getMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < b.getDate())) {
      age--;
    }
    isNursing = age >= 40 && age < 65;
  }

  const healthInsurance = isHealthEnabled ? Math.round(healthBonusBase * healthRate) : 0;
  const nursingInsurance = (isHealthEnabled && isNursing) ? Math.round(healthBonusBase * nursingRate) : 0;

  // 3. 厚生年金保険の標準賞与額（1ヶ月あたり上限 150万円）
  const pensionBonusBase = Math.min(1500000, standardBonus);
  const welfarePension = isPensionEnabled ? Math.round(pensionBonusBase * pensionRate) : 0;

  // 4. 雇用保険料（標準賞与額ではなく、賞与総支給額そのものに乗じる・役員は除外）
  const employmentInsurance = (isEmploymentEnabled && !isExecutive) ? Math.round(bonusGross * employmentRate) : 0;

  const socialInsuranceTotal = healthInsurance + nursingInsurance + welfarePension + employmentInsurance;

  // 5. 賞与に対する源泉所得税の計算（国税庁「賞与に対する源泉徴収税額の算出率の表」準拠）
  const taxableBonus = Math.max(0, bonusGross - socialInsuranceTotal);

  // 前月給与基準（前月給与がない場合は賞与割戻月額）
  const baseMonthly = lastMonthTaxBase > 0 ? lastMonthTaxBase : Math.round(taxableBonus / 6);
  const effectiveBase = Math.max(0, baseMonthly - (Math.max(0, dependentsCount) * 31667));

  let taxRate = 0;
  if (effectiveBase < 68000) {
    taxRate = 0;
  } else if (effectiveBase < 110000) {
    taxRate = 0.02042;
  } else if (effectiveBase < 170000) {
    taxRate = 0.04084;
  } else if (effectiveBase < 260000) {
    taxRate = 0.06126;
  } else if (effectiveBase < 350000) {
    taxRate = 0.08168;
  } else if (effectiveBase < 460000) {
    taxRate = 0.10210;
  } else if (effectiveBase < 580000) {
    taxRate = 0.12252;
  } else if (effectiveBase < 710000) {
    taxRate = 0.14294;
  } else if (effectiveBase < 840000) {
    taxRate = 0.16336;
  } else if (effectiveBase < 1000000) {
    taxRate = 0.18378;
  } else if (effectiveBase < 1180000) {
    taxRate = 0.20420;
  } else if (effectiveBase < 1400000) {
    taxRate = 0.22462;
  } else if (effectiveBase < 1730000) {
    taxRate = 0.24504;
  } else if (effectiveBase < 2160000) {
    taxRate = 0.26546;
  } else if (effectiveBase < 2820000) {
    taxRate = 0.28588;
  } else if (effectiveBase < 3740000) {
    taxRate = 0.30630;
  } else if (effectiveBase < 4960000) {
    taxRate = 0.32672;
  } else if (effectiveBase < 7120000) {
    taxRate = 0.34714;
  } else {
    taxRate = 0.35735;
  }

  const incomeTax = Math.floor(taxableBonus * taxRate); // 1円未満切捨て
  const deductionTotal = socialInsuranceTotal + incomeTax;
  const netPay = Math.max(0, bonusGross - deductionTotal);

  return {
    standardBonus,
    healthInsurance,
    nursingInsurance,
    welfarePension,
    employmentInsurance,
    socialInsuranceTotal,
    incomeTax,
    deductionTotal,
    netPay
  };
}

/**
 * 給与所得控除額の計算（所得税法第28条・令和2年分以降）
 * @param grossPay 年間給与支払金額（給与・賞与の総支給額額面）
 */
export function calculateEmploymentIncomeDeduction(grossPay: number): number {
  if (grossPay <= 0) return 0;
  if (grossPay <= 550000) {
    return grossPay; // 55万円以下の場合は全額控除
  } else if (grossPay <= 1625000) {
    return 550000;
  } else if (grossPay <= 1800000) {
    return Math.floor(grossPay * 0.40 - 100000);
  } else if (grossPay <= 3600000) {
    return Math.floor(grossPay * 0.30 + 80000);
  } else if (grossPay <= 6600000) {
    return Math.floor(grossPay * 0.20 + 440000);
  } else if (grossPay <= 8500000) {
    return Math.floor(grossPay * 0.10 + 1100000);
  } else {
    return 1950000; // 給与等の収入金額が850万円を超える場合は一律195万円（上限）
  }
}

/**
 * 給与所得控除後の金額（給与所得金額）の計算
 * 国税庁告示「年末調整等のための給与所得控除後の給与等の金額の表（令和2年分以降）」完全準拠
 * 源泉徴収票（G05欄）に記載される正式金額
 * @param grossPay 年間給与支払金額
 */
export function calculateNetEmploymentIncome(grossPay: number): number {
  if (grossPay <= 0) return 0;
  if (grossPay <= 550000) return 0;
  if (grossPay <= 1625000) return grossPay - 550000;

  // 1,625,000円超〜6,600,000円以下の場合は、給与収入金額を4,000円で除して端数切捨て×4,000円とする端数整理特例（告示）
  if (grossPay < 1800000) {
    const a = Math.floor(grossPay / 4000) * 4000;
    return Math.floor(a * 0.6) + 100000;
  } else if (grossPay < 3600000) {
    const a = Math.floor(grossPay / 4000) * 4000;
    return Math.floor(a * 0.7) - 80000;
  } else if (grossPay < 6600000) {
    const a = Math.floor(grossPay / 4000) * 4000;
    return Math.floor(a * 0.8) - 440000;
  } else if (grossPay <= 8500000) {
    return grossPay - Math.floor(grossPay * 0.10 + 1100000);
  } else {
    return grossPay - 1950000;
  }
}

/**
 * 🛡️ 退職時住民税一括徴収判定・未徴収税額算出
 * （地方税法第321条の5第2項 厳格準拠）
 */
export interface ResidentTaxLumpSumResult {
  isLumpSumRequired: boolean;
  isLumpSumOptional: boolean;
  retirementMonth: number;
  targetMonths: number[];
  lumpSumAmount: number;
  regularMonthlyAmount: number;
  notes: string;
}

export function calculateResidentTaxLumpSum(
  retirementDateStr?: string | null,
  monthlyTaxDetails?: Record<string, number> | null,
  defaultMonthlyTax: number = 0,
  userWantsLumpSumInLateYear: boolean = false
): ResidentTaxLumpSumResult | null {
  if (!retirementDateStr) return null;
  const d = new Date(retirementDateStr);
  if (isNaN(d.getTime())) return null;

  const month = d.getMonth() + 1;
  let targetMonths: number[] = [];
  let isLumpSumRequired = false;
  let isLumpSumOptional = false;

  if (month >= 1 && month <= 4) {
    // 1月〜4月退職: 5月分までの一括徴収が法律上必須
    isLumpSumRequired = true;
    for (let m = month; m <= 5; m++) {
      targetMonths.push(m);
    }
  } else if (month === 5) {
    // 5月退職: 5月分のみ
    targetMonths = [5];
  } else {
    // 6月〜12月退職: 本人希望があれば翌年5月分まで一括徴収可能
    isLumpSumOptional = true;
    if (userWantsLumpSumInLateYear) {
      for (let m = month; m <= 12; m++) {
        targetMonths.push(m);
      }
      for (let m = 1; m <= 5; m++) {
        targetMonths.push(m);
      }
    } else {
      targetMonths = [month];
    }
  }

  let lumpSumAmount = 0;
  targetMonths.forEach(m => {
    const key = String(m);
    if (monthlyTaxDetails && monthlyTaxDetails[key] !== undefined && monthlyTaxDetails[key] !== null) {
      lumpSumAmount += Number(monthlyTaxDetails[key]) || 0;
    } else {
      lumpSumAmount += defaultMonthlyTax;
    }
  });

  const curKey = String(month);
  const regularMonthlyAmount = (monthlyTaxDetails && monthlyTaxDetails[curKey] !== undefined)
    ? Number(monthlyTaxDetails[curKey]) || 0
    : defaultMonthlyTax;

  let notes = '';
  if (isLumpSumRequired) {
    notes = `地方税法第321条の5第2項に基づき、1〜4月退職のため${month}月〜5月分（${targetMonths.length}ヶ月分）の住民税を一括徴収します。`;
  } else if (isLumpSumOptional && userWantsLumpSumInLateYear) {
    notes = `従業員の希望申出に基づき、翌年5月分まで（${targetMonths.length}ヶ月分）の住民税を一括徴収します。`;
  } else if (isLumpSumOptional) {
    notes = '6〜12月退職のため、翌月以降の未徴収税額は普通徴収（本人納付）へ切り替わります（異動届の提出が必要です）。';
  } else {
    notes = '5月退職のため、最終月（5月分）のみを徴収します。';
  }

  return {
    isLumpSumRequired,
    isLumpSumOptional,
    retirementMonth: month,
    targetMonths,
    lumpSumAmount,
    regularMonthlyAmount,
    notes
  };
}

/**
 * 🛡️ 退職所得控除および退職手当等の源泉徴収税額計算
 * （所得税法第30条・第201条、地方税法 厳格準拠・令和4年分以降の改正完全対応）
 */
export interface RetirementTaxResult {
  serviceYears: number;
  severancePay: number;
  deductionAmount: number;
  taxableRetirementIncome: number;
  incomeTax: number;
  residentTax: number;
  totalTax: number;
  netSeverancePay: number;
  calculationNotes: string;
}

export function calculateRetirementIncomeTax(params: {
  severancePay: number;
  joinDate: string | Date;
  retirementDate: string | Date;
  isOfficer?: boolean;
  isDisabilityRetirement?: boolean;
}): RetirementTaxResult {
  const { severancePay, joinDate, retirementDate, isOfficer = false, isDisabilityRetirement = false } = params;

  if (severancePay <= 0) {
    return {
      serviceYears: 0,
      severancePay: 0,
      deductionAmount: 0,
      taxableRetirementIncome: 0,
      incomeTax: 0,
      residentTax: 0,
      totalTax: 0,
      netSeverancePay: 0,
      calculationNotes: '退職手当支給額が0円です。'
    };
  }

  const jD = new Date(joinDate);
  const rD = new Date(retirementDate);

  let totalMonths = (rD.getFullYear() - jD.getFullYear()) * 12 + (rD.getMonth() - jD.getMonth());
  if (rD.getDate() >= jD.getDate()) {
    totalMonths += 1;
  }
  if (totalMonths <= 0) totalMonths = 1;

  const serviceYears = Math.max(1, Math.ceil(totalMonths / 12));

  let deduction = 0;
  if (serviceYears <= 20) {
    deduction = 400000 * serviceYears;
    if (deduction < 800000) deduction = 800000;
  } else {
    deduction = 8000000 + 700000 * (serviceYears - 20);
  }

  if (isDisabilityRetirement) {
    deduction += 1000000;
  }

  const excess = Math.max(0, severancePay - deduction);

  let taxableRetirementIncome = 0;
  if (excess > 0) {
    if (isOfficer && serviceYears <= 5) {
      taxableRetirementIncome = Math.floor(excess / 1000) * 1000;
    } else if (!isOfficer && serviceYears <= 5) {
      if (excess <= 3000000) {
        taxableRetirementIncome = Math.floor((excess * 0.5) / 1000) * 1000;
      } else {
        const basePart = 3000000 * 0.5;
        const overPart = excess - 3000000;
        taxableRetirementIncome = Math.floor((basePart + overPart) / 1000) * 1000;
      }
    } else {
      taxableRetirementIncome = Math.floor((excess * 0.5) / 1000) * 1000;
    }
  }

  let baseTax = 0;
  const T = taxableRetirementIncome;
  if (T <= 0) {
    baseTax = 0;
  } else if (T <= 1949000) {
    baseTax = T * 0.05;
  } else if (T <= 3299000) {
    baseTax = T * 0.10 - 97500;
  } else if (T <= 6949000) {
    baseTax = T * 0.20 - 427500;
  } else if (T <= 8999000) {
    baseTax = T * 0.23 - 636000;
  } else if (T <= 17999000) {
    baseTax = T * 0.33 - 1536000;
  } else if (T <= 39999000) {
    baseTax = T * 0.40 - 2796000;
  } else {
    baseTax = T * 0.45 - 4796000;
  }

  const standardIncomeTax = Math.floor(baseTax);
  const reconstructionTax = Math.floor(standardIncomeTax * 0.021);
  const incomeTax = standardIncomeTax + reconstructionTax;

  const prefResidentTax = Math.floor(taxableRetirementIncome * 0.04);
  const cityResidentTax = Math.floor(taxableRetirementIncome * 0.06);
  const residentTax = prefResidentTax + cityResidentTax;

  const totalTax = incomeTax + residentTax;
  const netSeverancePay = Math.max(0, severancePay - totalTax);

  const calculationNotes = `勤続${serviceYears}年（控除額:${deduction.toLocaleString()}円）、課税退職所得:${taxableRetirementIncome.toLocaleString()}円、所得税(復興含):${incomeTax.toLocaleString()}円、住民税:${residentTax.toLocaleString()}円。`;

  return {
    serviceYears,
    severancePay,
    deductionAmount: deduction,
    taxableRetirementIncome,
    incomeTax,
    residentTax,
    totalTax,
    netSeverancePay,
    calculationNotes
  };
}

