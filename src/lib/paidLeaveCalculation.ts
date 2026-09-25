// ==============================================================================
// 労働基準法第39条第3項・施行規則第24条の3 準拠
// パート・アルバイト有給休暇「契約日数固定 ＆ 打刻実績逆算」ハイブリッド算定エンジン (SSOT)
// ==============================================================================

export type PaidLeaveCalcMode = 'contract_fixed' | 'actual_worked';

// 労基法施行規則第24条の3 年間所定労働日数と比例付与テーブル
export interface StatutoryTier {
  tier: string;
  label: string;
  minAnnualDays: number;
  maxAnnualDays: number;
  equivalentWeeklyDays: number;
  grants: { months: number; days: number }[];
}

export const STATUTORY_PAID_LEAVE_TIERS: StatutoryTier[] = [
  {
    tier: 'weekly_5_or_more',
    label: '週5日（年間217日以上 / フルタイム）',
    minAnnualDays: 217,
    maxAnnualDays: 366,
    equivalentWeeklyDays: 5,
    grants: [
      { months: 6, days: 10 },
      { months: 18, days: 11 },
      { months: 30, days: 12 },
      { months: 42, days: 14 },
      { months: 54, days: 16 },
      { months: 66, days: 18 },
      { months: 78, days: 20 },
    ]
  },
  {
    tier: 'weekly_4',
    label: '週4日（年間169〜216日）',
    minAnnualDays: 169,
    maxAnnualDays: 216,
    equivalentWeeklyDays: 4,
    grants: [
      { months: 6, days: 7 },
      { months: 18, days: 8 },
      { months: 30, days: 9 },
      { months: 42, days: 10 },
      { months: 54, days: 12 },
      { months: 66, days: 13 },
      { months: 78, days: 14 },
    ]
  },
  {
    tier: 'weekly_3',
    label: '週3日（年間121〜168日）',
    minAnnualDays: 121,
    maxAnnualDays: 168,
    equivalentWeeklyDays: 3,
    grants: [
      { months: 6, days: 5 },
      { months: 18, days: 6 },
      { months: 30, days: 6 },
      { months: 42, days: 8 },
      { months: 54, days: 9 },
      { months: 66, days: 10 },
      { months: 78, days: 11 },
    ]
  },
  {
    tier: 'weekly_2',
    label: '週2日（年間73〜120日）',
    minAnnualDays: 73,
    maxAnnualDays: 120,
    equivalentWeeklyDays: 2,
    grants: [
      { months: 6, days: 3 },
      { months: 18, days: 4 },
      { months: 30, days: 4 },
      { months: 42, days: 5 },
      { months: 54, days: 6 },
      { months: 66, days: 6 },
      { months: 78, days: 7 },
    ]
  },
  {
    tier: 'weekly_1',
    label: '週1日（年間48〜72日）',
    minAnnualDays: 48,
    maxAnnualDays: 72,
    equivalentWeeklyDays: 1,
    grants: [
      { months: 6, days: 1 },
      { months: 18, days: 2 },
      { months: 30, days: 2 },
      { months: 42, days: 2 },
      { months: 54, days: 3 },
      { months: 66, days: 3 },
      { months: 78, days: 3 },
    ]
  }
];

/**
 * 年間実労働日数から週相当日数（1〜5日）を逆算
 */
export function convertAnnualDaysToWeeklyEquivalent(annualDays: number): number {
  if (annualDays >= 217) return 5;
  if (annualDays >= 169) return 4;
  if (annualDays >= 121) return 3;
  if (annualDays >= 73) return 2;
  if (annualDays >= 48) return 1;
  return 0; // 48日未満は比例付与対象外（0日）
}

/**
 * 勤怠打刻レコードから直近の実労働日数を集計し、年間換算日数を算出
 * （厚労省通達 昭63.1.1基発第1号 準拠）
 */
export function calculateAnnualWorkedDaysFromRecords(
  joinDateStr?: string | null,
  records: any[] = [],
  targetDate: Date = new Date()
): {
  actualDaysCount: number;
  annualConvertedDays: number;
  periodText: string;
  isExtrapolated: boolean;
} {
  if (!joinDateStr || joinDateStr === '-') {
    return { actualDaysCount: 0, annualConvertedDays: 0, periodText: '入社日未設定', isExtrapolated: false };
  }
  const joinDate = new Date(joinDateStr);
  if (isNaN(joinDate.getTime())) {
    return { actualDaysCount: 0, annualConvertedDays: 0, periodText: '入社日無効', isExtrapolated: false };
  }

  // 直近1年前の日付
  const oneYearAgo = new Date(targetDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // 評価期間開始日（入社日と1年前の遅い方）
  const periodStart = joinDate > oneYearAgo ? joinDate : oneYearAgo;
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const targetDateStr = targetDate.toISOString().split('T')[0];

  // 期間内の有効な出勤打刻数（check_in_timeが存在する日）
  const workedDays = records.filter(r => {
    if (!r.check_in_time) return false;
    const d = r.date;
    return d >= periodStartStr && d <= targetDateStr;
  }).length;

  const diffDays = Math.max(1, Math.round((targetDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffDays < 365) {
    // 勤続1年未満の場合（厚労省通達: 半年実績×2、または日割り×365換算）
    const converted = Math.round((workedDays / diffDays) * 365);
    return {
      actualDaysCount: workedDays,
      annualConvertedDays: Math.min(365, converted),
      periodText: `直近${diffDays}日実績(${workedDays}日)から年換算`,
      isExtrapolated: true
    };
  } else {
    // 勤続1年以上の場合: 直近365日間の実労働日数
    return {
      actualDaysCount: workedDays,
      annualConvertedDays: workedDays,
      periodText: `直近1年間の実労働日数(${workedDays}日)`,
      isExtrapolated: false
    };
  }
}

export interface DetailedStatutoryLeave {
  statutoryGrant: number;
  prevStatutoryGrant: number;
  serviceMonths: number;
  serviceText: string;
  lastGrantDate: string | null;
  nextGrantDate: string | null;
  nextGrantDays: number;
  daysUntilNextGrant: number | null;
  isTarget: boolean;
  isObligated: boolean; // 労基法第39条第7項 年5日取得義務対象（付与日数10日以上）
  obligationPeriodStart: string | null;
  obligationPeriodEnd: string | null;

  // 逆算・ハイブリッド詳細
  calcMode: PaidLeaveCalcMode;
  contractWeeklyDays: number;
  actualWorkedDaysAnnual: number;
  actualDaysCount: number;
  actualEquivalentWeeklyDays: number;
  effectiveWeeklyDays: number;
  periodText: string;
  isDiffFromContract: boolean;
  diffDaysText: string;
}

/**
 * 指定期間内の有給休暇取得（消化）日数を集計
 * （単日申請・期間申請・全休・半休を完全網羅、NaN・集計漏れを防止）
 */
export function calculateUsedPaidLeaveDaysInPeriod(
  leaveRequests: any[],
  periodStart?: string | null,
  periodEnd?: string | null
): number {
  let used = 0;
  if (!Array.isArray(leaveRequests)) return 0;

  leaveRequests.forEach(req => {
    // 承認済みの有休のみ対象
    if (req.status !== '承認') return;
    const typeStr = String(req.type || '');
    if (!typeStr.includes('有給') && !typeStr.includes('年休')) return;

    const startStr = req.start_date;
    if (!startStr) return;
    const endStr = req.end_date || startStr; // 単日申請の場合の安全フォールバック

    // 期間指定がある場合のフィルタ
    if (periodStart && endStr < periodStart) return;
    if (periodEnd && startStr > periodEnd) return;

    if (typeStr.includes('半休')) {
      used += 0.5;
    } else {
      const s = new Date(startStr);
      const e = new Date(endStr);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const diffTime = e.getTime() - s.getTime();
        const days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
        used += days;
      } else {
        used += 1.0;
      }
    }
  });
  return used;
}

/**
 * 労働基準法に基づく有給休暇の総合算定（契約固定 ＆ 実績逆算ハイブリッド対応）
 */
export function calculateStatutoryLeaveWithMode(
  joinDateStr: string | null | undefined,
  employmentType: string = '正社員',
  contractWeeklyDays: number = 5,
  calcMode: PaidLeaveCalcMode = 'actual_worked',
  empAttendanceRecords: any[] = [],
  targetDate: Date = new Date()
): DetailedStatutoryLeave {
  const baseResult: DetailedStatutoryLeave = {
    statutoryGrant: 0,
    prevStatutoryGrant: 0,
    serviceMonths: 0,
    serviceText: '入社日未設定',
    lastGrantDate: null,
    nextGrantDate: null,
    nextGrantDays: 0,
    daysUntilNextGrant: null,
    isTarget: false,
    isObligated: false,
    obligationPeriodStart: null,
    obligationPeriodEnd: null,
    calcMode,
    contractWeeklyDays,
    actualWorkedDaysAnnual: 0,
    actualDaysCount: 0,
    actualEquivalentWeeklyDays: contractWeeklyDays,
    effectiveWeeklyDays: contractWeeklyDays,
    periodText: '',
    isDiffFromContract: false,
    diffDaysText: ''
  };

  if (!joinDateStr || joinDateStr === '-') {
    return baseResult;
  }

  const joinDate = new Date(joinDateStr);
  if (isNaN(joinDate.getTime())) {
    baseResult.serviceText = '入社日無効';
    return baseResult;
  }

  const now = targetDate;
  let months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
  if (now.getDate() < joinDate.getDate()) {
    months -= 1;
  }
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const serviceText = years > 0 ? `${years}年${remMonths}ヶ月` : `${remMonths}ヶ月`;

  const isFullTime = employmentType === '正社員' || employmentType === 'full-time' || contractWeeklyDays >= 5;

  // 実績逆算の計算
  const actualStats = calculateAnnualWorkedDaysFromRecords(joinDateStr, empAttendanceRecords, targetDate);
  const actualEquivalent = convertAnnualDaysToWeeklyEquivalent(actualStats.annualConvertedDays);

  // 適用する週日数の決定
  let effectiveWeeklyDays = contractWeeklyDays;
  if (!isFullTime) {
    if (calcMode === 'actual_worked' && actualStats.annualConvertedDays > 0) {
      effectiveWeeklyDays = actualEquivalent;
    } else {
      effectiveWeeklyDays = contractWeeklyDays;
    }
  } else {
    effectiveWeeklyDays = 5;
  }

  // 該当する付与テーブルの選択
  let tier = STATUTORY_PAID_LEAVE_TIERS.find(t => t.equivalentWeeklyDays === effectiveWeeklyDays);
  if (!tier) {
    tier = STATUTORY_PAID_LEAVE_TIERS[0];
  }
  const schedule = tier.grants;

  let currentGrant = 0;
  let prevGrant = 0;
  let currentGrantMonths = 0;
  let nextGrantMonths = schedule[0].months;
  let nextGrantDays = schedule[0].days;

  for (let i = 0; i < schedule.length; i++) {
    if (months >= schedule[i].months) {
      prevGrant = currentGrant;
      currentGrant = schedule[i].days;
      currentGrantMonths = schedule[i].months;
      if (i + 1 < schedule.length) {
        nextGrantMonths = schedule[i + 1].months;
        nextGrantDays = schedule[i + 1].days;
      } else {
        const maxMonths = schedule[schedule.length - 1].months;
        const cycles = Math.floor((months - maxMonths) / 12) + 1;
        currentGrantMonths = maxMonths + (cycles - 1) * 12;
        nextGrantMonths = maxMonths + cycles * 12;
        nextGrantDays = schedule[schedule.length - 1].days;
      }
    }
  }

  // 直近付与日（基準日）および次回付与予定日
  let lastGrantDateStr: string | null = null;
  let obligationPeriodStart: string | null = null;
  let obligationPeriodEnd: string | null = null;
  const isObligated = currentGrant >= 10;

  const nextGrantDate = new Date(joinDate);
  nextGrantDate.setMonth(nextGrantDate.getMonth() + nextGrantMonths);
  const nextGrantDateStr = nextGrantDate.toISOString().split('T')[0];
  const diffTime = nextGrantDate.getTime() - now.getTime();
  const daysUntilNextGrant = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  if (months >= schedule[0].months) {
    const lastGrantDate = new Date(joinDate);
    lastGrantDate.setMonth(lastGrantDate.getMonth() + currentGrantMonths);
    lastGrantDateStr = lastGrantDate.toISOString().split('T')[0];
    obligationPeriodStart = lastGrantDateStr;
    obligationPeriodEnd = nextGrantDateStr;
  }

  // 契約と実績の差分判定
  let isDiffFromContract = false;
  let diffDaysText = '';
  if (!isFullTime) {
    if (actualEquivalent !== contractWeeklyDays && actualStats.annualConvertedDays > 0) {
      isDiffFromContract = true;
      if (actualEquivalent > contractWeeklyDays) {
        diffDaysText = `実労働(年${actualStats.annualConvertedDays}日=週${actualEquivalent}日相当)が契約(週${contractWeeklyDays}日)を上回っています`;
      } else {
        diffDaysText = `実労働(年${actualStats.annualConvertedDays}日=週${actualEquivalent}日相当)が契約(週${contractWeeklyDays}日)を下回っています`;
      }
    }
  }

  return {
    statutoryGrant: currentGrant,
    prevStatutoryGrant: prevGrant,
    serviceMonths: months,
    serviceText,
    lastGrantDate: lastGrantDateStr,
    nextGrantDate: nextGrantDateStr,
    nextGrantDays,
    daysUntilNextGrant,
    isTarget: true,
    isObligated,
    obligationPeriodStart,
    obligationPeriodEnd,
    calcMode,
    contractWeeklyDays,
    actualWorkedDaysAnnual: actualStats.annualConvertedDays,
    actualDaysCount: actualStats.actualDaysCount,
    actualEquivalentWeeklyDays: actualEquivalent,
    effectiveWeeklyDays,
    periodText: actualStats.periodText,
    isDiffFromContract,
    diffDaysText
  };
}

// -------------------------------------------------------------------------
// LocalStorage / テナント設定 保存・取得ヘルパー
// -------------------------------------------------------------------------

export const getCompanyPaidLeaveCalcMode = (tenantId?: string | null): PaidLeaveCalcMode => {
  if (!tenantId) return 'actual_worked'; // デフォルトは現場即応の実績逆算
  try {
    const saved = localStorage.getItem(`company_paid_leave_calc_mode_${tenantId}`);
    if (saved === 'contract_fixed' || saved === 'actual_worked') {
      return saved;
    }
  } catch {}
  return 'actual_worked';
};

export const saveCompanyPaidLeaveCalcMode = (tenantId: string, mode: PaidLeaveCalcMode) => {
  try {
    localStorage.setItem(`company_paid_leave_calc_mode_${tenantId}`, mode);
  } catch {}
};

export const getUserPaidLeaveCalcModeMap = (tenantId?: string | null): Record<string, PaidLeaveCalcMode | 'default'> => {
  if (!tenantId) return {};
  try {
    const raw = localStorage.getItem(`user_paid_leave_calc_modes_${tenantId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const saveUserPaidLeaveCalcMode = (tenantId: string, userId: string, mode: PaidLeaveCalcMode | 'default') => {
  try {
    const map = getUserPaidLeaveCalcModeMap(tenantId);
    map[userId] = mode;
    localStorage.setItem(`user_paid_leave_calc_modes_${tenantId}`, JSON.stringify(map));
  } catch {}
};
