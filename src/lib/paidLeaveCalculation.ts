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

  // 期間内の有効な出勤打刻レコード（check_in_timeが存在する日）
  const validRecords = records.filter(r => {
    if (!r.check_in_time) return false;
    const d = r.date;
    return d >= periodStartStr && d <= targetDateStr;
  });
  const workedDays = validRecords.length;

  if (workedDays === 0) {
    return {
      actualDaysCount: 0,
      annualConvertedDays: 0,
      periodText: '打刻実績なし',
      isExtrapolated: false
    };
  }

  // 打刻データの記録範囲（最古〜最新）から実際の記録スパンを算出
  const recordDates = validRecords.map(r => r.date).sort();
  const earliestDateStr = recordDates[0];
  const latestDateStr = recordDates[recordDates.length - 1];
  const earliestDate = new Date(earliestDateStr);
  const latestDate = new Date(latestDateStr);
  const recordSpanDays = Math.max(1, Math.round((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // 評価期間の日数
  const totalPeriodDays = Math.max(1, Math.round((targetDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

  // システム導入初期等で打刻レコードの期間が1年未満（300日未満）の場合は、実記録スパンから高精度に年換算
  if (recordSpanDays < 300 && recordSpanDays >= 7) {
    const converted = Math.round((workedDays / recordSpanDays) * 365);
    return {
      actualDaysCount: workedDays,
      annualConvertedDays: Math.min(365, converted),
      periodText: `実打刻期間(${recordSpanDays}日間・${workedDays}日出勤)から年換算`,
      isExtrapolated: true
    };
  } else if (totalPeriodDays < 365) {
    // 勤続1年未満の場合（厚労省通達: 半年実績×2、または日割り×365換算）
    const converted = Math.round((workedDays / totalPeriodDays) * 365);
    return {
      actualDaysCount: workedDays,
      annualConvertedDays: Math.min(365, converted),
      periodText: `直近${totalPeriodDays}日実績(${workedDays}日)から年換算`,
      isExtrapolated: true
    };
  } else {
    // 勤続1年以上で十分な打刻がある場合: 直近365日間の実労働日数
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
  isZeroGrant: boolean;
  zeroGrantReason: string;
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

    if (typeof req.days === 'number' && req.days > 0) {
      used += req.days;
    } else if (typeof req.requested_days === 'number' && req.requested_days > 0) {
      used += req.requested_days;
    } else if (typeStr.includes('半休')) {
      used += 0.5;
    } else if (typeStr.includes('時間') && typeof req.hours === 'number' && req.hours > 0) {
      // 時間単位年休（労基法第39条第4項）: 1日8時間換算
      used += Math.round((req.hours / 8) * 100) / 100;
    } else {
      const s = new Date(startStr);
      const e = new Date(endStr);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        // 🎌 労基法第39条・昭27.7.25基収2647号準拠：所定労働日のみに有休が成立するため、期間内の土日を除外して実日数を正確にカウント
        let businessDays = 0;
        const cur = new Date(s);
        while (cur <= e) {
          const dayOfWeek = cur.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDays += 1;
          }
          cur.setDate(cur.getDate() + 1);
        }
        // 週末のみ指定された等の特異ケースでも最低1日（申請が存在するため）
        used += Math.max(1, businessDays);
      } else {
        used += 1.0;
      }
    }
  });
  return used;
}

/**
 * 民法第143条（暦による期間計算）に準拠した月加算ヘルパー
 * （3月31日入社者の6ヶ月後付与日が10月1日にオーバーフローせず正確に9月30日となるよう保護）
 */
function addMonthsCivil(dateStr: string, monthsToAdd: number): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalMonths = (m - 1) + monthsToAdd;
  const newYear = y + Math.floor(totalMonths / 12);
  const newMonth = ((totalMonths % 12) + 12) % 12 + 1;
  const daysInNewMonth = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, daysInNewMonth);
  const yearStr = String(newYear);
  const monthStr = String(newMonth).padStart(2, '0');
  const dayStr = String(newDay).padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
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
  targetDate: Date = new Date(),
  contractWeeklyHours?: number
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
    diffDaysText: '',
    isZeroGrant: false,
    zeroGrantReason: ''
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

  // 労働基準法第39条第3項・施行規則第24条の3：短時間労働者（パート・アルバイト）判定
  const isPartTime = employmentType === 'パート' || 
                     employmentType === 'アルバイト' || 
                     employmentType === 'part-time' || 
                     (employmentType && (employmentType.includes('パート') || employmentType.includes('バイト')));

  // 正社員・フルタイム（比例付与対象外）判定
  const isFullTime = !isPartTime && (employmentType === '正社員' || employmentType === 'full-time' || contractWeeklyDays >= 5 || (typeof contractWeeklyHours === 'number' && contractWeeklyHours >= 30));

  // 実績逆算の計算
  const actualStats = calculateAnnualWorkedDaysFromRecords(joinDateStr, empAttendanceRecords, targetDate);
  const actualEquivalent = convertAnnualDaysToWeeklyEquivalent(actualStats.annualConvertedDays);

  let effectiveWeeklyDays = contractWeeklyDays;
  let isZeroGrant = false;
  let zeroGrantReason = '';

  // ⚖️ 労働基準法第39条第1項・第2項（出勤率8割要件）および施行規則第24条の3（比例付与別表）厳格判定
  if (calcMode === 'actual_worked') {
    if (actualStats.actualDaysCount === 0) {
      // 🚨 打刻実績0日 ➔ 出勤率8割要件未達・実労働なしのため例外なく付与0日
      effectiveWeeklyDays = 0;
      isZeroGrant = true;
      zeroGrantReason = '出勤実績0日のため法定要件（出勤率8割）未達・0日付与';
    } else if (actualStats.annualConvertedDays < 48) {
      // 🚨 年換算労働日数48日未満 ➔ 施行規則第24条の3別表の対象外（週1日未満）のため付与0日
      effectiveWeeklyDays = 0;
      isZeroGrant = true;
      zeroGrantReason = `年間実労働${actualStats.annualConvertedDays}日（48日未満のため比例付与対象外・0日付与）`;
    } else {
      effectiveWeeklyDays = actualEquivalent;
    }
  } else {
    // 契約週日数固定モード（contract_fixed）
    // 打刻データが存在する運用環境で、直近評価期間の実出勤が0日の場合は「長期休職・出勤実績なし」として法定付与0日
    if (empAttendanceRecords.length > 0 && actualStats.actualDaysCount === 0) {
      effectiveWeeklyDays = contractWeeklyDays;
      isZeroGrant = true;
      zeroGrantReason = '出勤実績0日のため法定要件（出勤率8割）未達・0日付与';
    } else {
      effectiveWeeklyDays = isFullTime ? 5 : Math.max(1, contractWeeklyDays);
    }
  }

  // 該当する付与テーブルの選択（次回付与予定日・日数の算定用にも参照）
  const referenceWeeklyDays = effectiveWeeklyDays > 0 ? effectiveWeeklyDays : Math.max(1, isFullTime ? 5 : contractWeeklyDays);
  let tier = STATUTORY_PAID_LEAVE_TIERS.find(t => t.equivalentWeeklyDays === referenceWeeklyDays);
  if (!tier) {
    // 安全下限: 週1日テーブル
    tier = STATUTORY_PAID_LEAVE_TIERS[STATUTORY_PAID_LEAVE_TIERS.length - 1];
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

  // 🚨 法定要件未達（isZeroGrant）の場合は、当期付与および前年分を「0日」に強制遮断！
  if (isZeroGrant) {
    currentGrant = 0;
    prevGrant = 0;
  }

  // 直近付与日（基準日）および次回付与予定日（民法第143条暦計算により月末31日入社の翌月1日オーバーフローを完全防止）
  let lastGrantDateStr: string | null = null;
  let obligationPeriodStart: string | null = null;
  let obligationPeriodEnd: string | null = null;
  const isObligated = currentGrant >= 10;

  const nextGrantDateStr = addMonthsCivil(joinDateStr, nextGrantMonths);
  const nextGrantDate = new Date(nextGrantDateStr + 'T00:00:00');
  const diffTime = nextGrantDate.getTime() - now.getTime();
  const daysUntilNextGrant = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  if (months >= schedule[0].months) {
    lastGrantDateStr = addMonthsCivil(joinDateStr, currentGrantMonths);
    obligationPeriodStart = lastGrantDateStr;
    obligationPeriodEnd = nextGrantDateStr;
  }

  // 契約と実績の差分判定
  let isDiffFromContract = false;
  let diffDaysText = '';
  if (!isFullTime) {
    if (actualStats.actualDaysCount === 0) {
      isDiffFromContract = true;
      diffDaysText = `出勤実績が0日のため、法定付与要件（出勤率8割以上）を満たしていません`;
    } else if (actualStats.annualConvertedDays < 48) {
      isDiffFromContract = true;
      diffDaysText = `年間実労働(${actualStats.annualConvertedDays}日)が法定比例付与の下限(48日)を下回っています`;
    } else if (actualEquivalent !== contractWeeklyDays && actualStats.annualConvertedDays > 0) {
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
    diffDaysText,
    isZeroGrant,
    zeroGrantReason
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
