import { 
  checkMonthlyRevisionEligibility, 
  HEALTH_REMUNERATION_TABLE, 
  lookupStandardMonthlyRemuneration 
} from './socialInsurance';
import type { EmployeePayrollProfile } from './payrollEngine';

export interface MonthlyRevisionMonthData {
  yearMonth: string; // YYYY-MM
  monthNum: number;  // 1〜12
  baseDays: number;  // 支払基礎日数
  cashAmount: number; // 通貨によるものの額
  inKindAmount: number; // 現物によるものの額
  totalAmount: number; // 合計 (通貨 + 現物)
}

export interface MonthlyRevisionCandidate {
  userId: string;
  userName: string;
  employeeNumber?: string;
  birthDate?: string;
  myNumber?: string;
  is70Over: boolean;
  isShortTimeWorker: boolean;
  
  // 改定情報
  revisionYearMonth: string; // 改定年月（YYYY-MM、例: 2026-09）
  changeType: '昇給' | '降給'; // 昇給 or 降給
  changeMonth: string;       // 変動月（YYYY-MM、例: 2026-06）
  
  // 従前標準報酬月額
  currentHealthStandard: number;
  currentPensionStandard: number;
  currentHealthGrade: number;
  currentPensionGrade: number;
  previousRevisionYM: string; // 従前改定年月（例: 2025-09）

  // 3ヶ月実績データ
  consecutiveMonths: [MonthlyRevisionMonthData, MonthlyRevisionMonthData, MonthlyRevisionMonthData];
  totalWage: number;         // 3ヶ月総計
  averageWage: number;       // 3ヶ月平均額（1円未満切捨）
  
  // 新標準報酬月額
  newHealthStandard: number;
  newPensionStandard: number;
  newHealthGrade: number;
  newPensionGrade: number;
  
  // 等級差
  healthGradeDiff: number;
  pensionGradeDiff: number;
  
  // 判定理由・ステータス
  isEligible: boolean;
  isHealthEligible: boolean;
  isPensionEligible: boolean;
  reason: string;
  remarks: string; // 備考（例: 基本給改定のため、短時間労働者など）
}

export interface MonthlyRevisionPayslipItem {
  user_id: string;
  year_month: string;
  work_days?: number;
  total_earnings?: number;
  base_salary?: number;
  overtime_allowance?: number;
  [key: string]: any;
}

/**
 * 対象月度（例: '2026-09'）において、被保険者報酬月額変更届（随時改定・月変）の対象となる従業員を全自動スキャン・判定する
 * 
 * 法律要件（健保法43条・厚年法23条）：
 * 1. 固定的賃金の変動（昇給または降給）
 * 2. 変動月から3ヶ月間の支払基礎日数がすべて17日以上（短時間労働者は11日以上）
 * 3. 3ヶ月の平均報酬月額から算定した新等級と、従前等級に「2等級以上の差」が生じている
 * 4. 変動方向（昇給なら新等級も上、降給なら新等級も下）と等級変動が一致している
 */
export function detectMonthlyRevisionCandidates(params: {
  targetYearMonth?: string;
  revisionYearMonth?: string;
  employees: any[];
  payrollProfiles: Record<string, EmployeePayrollProfile>;
  payslips?: MonthlyRevisionPayslipItem[];
  allPayslips?: MonthlyRevisionPayslipItem[];
}): MonthlyRevisionCandidate[] {
  const { employees, payrollProfiles } = params;
  const targetYM = params.revisionYearMonth || params.targetYearMonth || '';
  const payslips = params.allPayslips || params.payslips || [];

  const [tYear, tMonth] = targetYM.split('-').map(Number);
  if (!tYear || !tMonth) return [];

  // 改定月（例: 9月）の対象となる3ヶ月給与実績は「6月、7月、8月」（4ヶ月前が変動月、1〜3ヶ月前が実績）
  // 基準月1 = 3ヶ月前、月2 = 2ヶ月前、月3 = 1ヶ月前
  const getPrevYM = (y: number, m: number, offsetMonths: number): string => {
    const d = new Date(y, m - 1 - offsetMonths, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const m1YM = getPrevYM(tYear, tMonth, 3);
  const m2YM = getPrevYM(tYear, tMonth, 2);
  const m3YM = getPrevYM(tYear, tMonth, 1);

  const candidates: MonthlyRevisionCandidate[] = [];

  for (const emp of employees) {
    const prof = payrollProfiles[emp.id];
    if (!prof) continue;

    // 社会保険（健康保険または厚生年金）が有効でない社員はスキップ
    if (!prof.health_insurance_enabled && !prof.pension_insurance_enabled) continue;

    // 従前の標準報酬月額（マスタまたは登録値）
    const curHealthStd = prof.health_standard_monthly_remuneration || prof.base_salary || 300000;
    const curPensionStd = prof.pension_standard_monthly_remuneration || curHealthStd;

    // 3ヶ月分の給与明細を抽出
    const slip1 = payslips.find(s => s.user_id === emp.id && s.year_month === m1YM);
    const slip2 = payslips.find(s => s.user_id === emp.id && s.year_month === m2YM);
    const slip3 = payslips.find(s => s.user_id === emp.id && s.year_month === m3YM);

    // 3ヶ月分の実績データが最低1件もない場合はスキップ
    if (!slip1 && !slip2 && !slip3) continue;

    // 各月のデータ生成（未計算月は0補完）
    const formatMonthData = (ym: string, slip?: MonthlyRevisionPayslipItem): MonthlyRevisionMonthData => {
      const monthNum = parseInt(ym.split('-')[1], 10);
      if (!slip) {
        return { yearMonth: ym, monthNum, baseDays: 0, cashAmount: 0, inKindAmount: 0, totalAmount: 0 };
      }
      const days = slip.work_days || 20;
      const cash = (slip.total_earnings || ((slip.base_salary || 0) + (slip.overtime_allowance || 0)));
      return {
        yearMonth: ym,
        monthNum,
        baseDays: days,
        cashAmount: cash,
        inKindAmount: 0,
        totalAmount: cash
      };
    };

    const month1Data = formatMonthData(m1YM, slip1);
    const month2Data = formatMonthData(m2YM, slip2);
    const month3Data = formatMonthData(m3YM, slip3);
    const consecutiveMonths: [MonthlyRevisionMonthData, MonthlyRevisionMonthData, MonthlyRevisionMonthData] = [
      month1Data, month2Data, month3Data
    ];

    // 短時間労働者判定（週所定20時間以上30時間未満など）
    const isShortTime = emp.employment_type === 'part_time' || emp.employment_type === 'contract';

    // 3ヶ月総計および平均額
    const totalWage = month1Data.totalAmount + month2Data.totalAmount + month3Data.totalAmount;
    const averageWage = Math.round(totalWage / 3);

    // 新等級の算定
    const newHealthStd = lookupStandardMonthlyRemuneration(averageWage, 'health');
    const newPensionStd = lookupStandardMonthlyRemuneration(averageWage, 'pension');

    // 変動方向（新平均 > 従前なら昇給、新平均 < 従前なら降給）
    const isIncrease = newHealthStd > curHealthStd;
    const changeType: '昇給' | '降給' = isIncrease ? '昇給' : '降給';

    // 随時改定判定エンジンの実行
    const checkResult = checkMonthlyRevisionEligibility({
      currentHealthStandard: curHealthStd,
      currentPensionStandard: curPensionStd,
      consecutiveMonths: [
        { baseDays: month1Data.baseDays, totalWage: month1Data.totalAmount },
        { baseDays: month2Data.baseDays, totalWage: month2Data.totalAmount },
        { baseDays: month3Data.baseDays, totalWage: month3Data.totalAmount }
      ],
      fixedWageChangeType: isIncrease ? 'increase' : 'decrease',
      isShortTimeWorker: isShortTime
    });

    // 等級の計算
    const curHealthRow = HEALTH_REMUNERATION_TABLE.find(r => r.standard === curHealthStd);
    const newHealthRow = HEALTH_REMUNERATION_TABLE.find(r => r.standard === newHealthStd);
    const curHealthGrade = curHealthRow?.grade || 1;
    const newHealthGrade = newHealthRow?.grade || 1;
    const curPensionGrade = Math.max(1, Math.min(32, curHealthGrade - 3));
    const newPensionGrade = Math.max(1, Math.min(32, newHealthGrade - 3));

    // 70歳以上判定
    let is70Over = false;
    if (prof.birth_date) {
      const birthYear = new Date(prof.birth_date).getFullYear();
      if (tYear - birthYear >= 70) is70Over = true;
    }

    // 従前改定年月（1年前の9月など）
    const prevRevYM = `${tYear - 1}-09`;

    candidates.push({
      userId: emp.id,
      userName: emp.name,
      employeeNumber: emp.employee_number || emp.id.substring(0, 4),
      birthDate: prof.birth_date ? String(prof.birth_date) : undefined,
      myNumber: emp.my_number || '',
      is70Over,
      isShortTimeWorker: isShortTime,
      revisionYearMonth: targetYM,
      changeType,
      changeMonth: m1YM,
      currentHealthStandard: curHealthStd,
      currentPensionStandard: curPensionStd,
      currentHealthGrade: curHealthGrade,
      currentPensionGrade: curPensionGrade,
      previousRevisionYM: prevRevYM,
      consecutiveMonths,
      totalWage,
      averageWage,
      newHealthStandard: newHealthStd,
      newPensionStandard: newPensionStd,
      newHealthGrade,
      newPensionGrade,
      healthGradeDiff: checkResult.healthGradeDiff,
      pensionGradeDiff: checkResult.pensionGradeDiff,
      isEligible: checkResult.isEligible,
      isHealthEligible: checkResult.isHealthEligible,
      isPensionEligible: checkResult.isPensionEligible,
      reason: checkResult.reason,
      remarks: isShortTime ? '短時間労働者' : '基本給改定のため'
    });
  }

  return candidates;
}
