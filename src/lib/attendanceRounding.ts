// =========================================================================
// 現場即応 打刻丸め（マル目）＆勤務時間計算 共通エンジン (SSOT)
import { supabase } from './supabase';

export interface AttendanceRoundingRules {
  // 1. 始業前打刻の扱い
  // 'clip_to_start': 始業時刻前の打刻は始業時刻に自動補正（推奨・早出残業の勝手な発生を防止）
  // 'exact': 実打刻通りに計算
  check_in_before_start: 'clip_to_start' | 'exact';

  // 2. 出退勤の端数丸め（マル目）
  // 出勤: 切り上げ（例: 15分なら 09:02 -> 09:15）
  check_in_rounding_minutes: 1 | 5 | 10 | 15 | 30;
  // 退勤: 切り捨て（例: 15分なら 18:14 -> 18:00, 18:16 -> 18:15）
  check_out_rounding_minutes: 1 | 5 | 10 | 15 | 30;

  // 3. 定時退勤バッファ（着替え・退勤混雑の考慮）
  // 終業時刻後、指定分以内の退勤打刻は「定時終業時刻」とみなす（例: 10分なら 18:08 -> 18:00）
  overtime_buffer_minutes: number; // 0, 5, 10, 15, 30

  // 4. 遅刻猶予バッファ（打刻端末混雑・エレベーター遅延対策）
  // 始業時刻後、指定分以内の打刻は遅刻と判定しない（例: 5分なら 09:04 は遅刻なし）
  late_grace_minutes: number; // 0, 3, 5, 10

  // 5. 休憩時間の控除方式
  // 'statutory': 法定基準（実働6h超で45分、8h超で60分自動控除）
  // 'pattern_fixed': パターン設定値で固定控除
  // 'actual_punches': 実打刻のみ控除
  break_deduction_mode: 'statutory' | 'pattern_fixed' | 'actual_punches';

  // 6. 深夜労働集計
  night_work_enabled: boolean; // 22:00〜05:00
}

// 🏢 業界・現場別プリセット
export const ATTENDANCE_PRESETS: { [key: string]: { name: string; description: string; rules: AttendanceRoundingRules } } = {
  store_shift: {
    name: '🏪 店舗・シフト現場（15分丸め＋始業前カット）',
    description: '始業前の早出カット、15分単位の端数丸め、退勤10分バッファ、法定休憩自動控除（現場一番人気）',
    rules: {
      check_in_before_start: 'clip_to_start',
      check_in_rounding_minutes: 15,
      check_out_rounding_minutes: 15,
      overtime_buffer_minutes: 10,
      late_grace_minutes: 3,
      break_deduction_mode: 'statutory',
      night_work_enabled: true
    }
  },
  office_standard: {
    name: '🏢 オフィス・本社標準（定時補正＋1分単位＋法定休憩）',
    description: '始業前は定時補正、残業は15分バッファ後1分単位、法定休憩自動控除（一般企業標準）',
    rules: {
      check_in_before_start: 'clip_to_start',
      check_in_rounding_minutes: 1,
      check_out_rounding_minutes: 1,
      overtime_buffer_minutes: 15,
      late_grace_minutes: 5,
      break_deduction_mode: 'statutory',
      night_work_enabled: true
    }
  },
  exact_strict: {
    name: '⏱️ 厳密1分単位（補正なし・労基法最厳格）',
    description: '丸め・補正を一切行わず、打刻された通りの時間を1分単位でそのまま集計します',
    rules: {
      check_in_before_start: 'exact',
      check_in_rounding_minutes: 1,
      check_out_rounding_minutes: 1,
      overtime_buffer_minutes: 0,
      late_grace_minutes: 0,
      break_deduction_mode: 'statutory',
      night_work_enabled: true
    }
  }
};

// デフォルト設定（店舗・シフト標準）
export const DEFAULT_ROUNDING_RULES: AttendanceRoundingRules = ATTENDANCE_PRESETS.store_shift.rules;

// 🎨 自社専用カスタムプリセット定義
export interface CustomAttendancePreset {
  id: string;
  name: string;
  description?: string;
  rules: AttendanceRoundingRules;
  created_at: string;
}

export const getCustomPresetsFromStorage = (tenantId?: string | null): CustomAttendancePreset[] => {
  if (!tenantId) return [];
  try {
    const raw = localStorage.getItem(`attendance_custom_presets_${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const saveCustomPresetsToStorage = (tenantId: string, presets: CustomAttendancePreset[]) => {
  try {
    localStorage.setItem(`attendance_custom_presets_${tenantId}`, JSON.stringify(presets));
  } catch {}
};

// ストレージからルールを取得
export const getAttendanceRoundingRules = (tenantId?: string | null): AttendanceRoundingRules => {
  if (!tenantId) return DEFAULT_ROUNDING_RULES;
  try {
    const raw = localStorage.getItem(`attendance_rounding_rules_${tenantId}`);
    if (raw) {
      return { ...DEFAULT_ROUNDING_RULES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to parse attendance_rounding_rules:', e);
  }
  return DEFAULT_ROUNDING_RULES;
};

// ストレージへ保存
export const saveAttendanceRoundingRules = (tenantId: string, rules: AttendanceRoundingRules) => {
  try {
    localStorage.setItem(`attendance_rounding_rules_${tenantId}`, JSON.stringify(rules));
  } catch (e) {
    console.warn('Failed to save attendance_rounding_rules:', e);
  }
};

/**
 * 実DB（tenantsテーブルのwork_calendar_settings JSONB）から打刻丸めルールを取得（SSOT）
 */
export const fetchAttendanceRoundingRulesFromDb = async (tenantId?: string | null): Promise<AttendanceRoundingRules> => {
  if (!tenantId) return DEFAULT_ROUNDING_RULES;
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('work_calendar_settings')
      .eq('id', tenantId)
      .maybeSingle();

    if (!error && data?.work_calendar_settings) {
      const cal = data.work_calendar_settings;
      if (cal.attendance_rounding_rules) {
        const rules = { ...DEFAULT_ROUNDING_RULES, ...cal.attendance_rounding_rules };
        saveAttendanceRoundingRules(tenantId, rules);
        return rules;
      }
    }
  } catch (e) {
    console.warn('fetchAttendanceRoundingRulesFromDb note:', e);
  }
  return getAttendanceRoundingRules(tenantId);
};

// -------------------------------------------------------------------------
// 計算補助関数
// -------------------------------------------------------------------------

/**
 * 時刻文字列 "HH:MM" または "HH:MM:SS" を分単位の数値に変換
 */
export const timeToMinutes = (timeStr?: string | null): number | null => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
};

/**
 * 分単位の数値を "HH:MM" 形式の文字列に変換
 */
export const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * 出勤打刻の丸め・補正処理
 * @param rawTime 実打刻時刻 ("08:42" 等)
 * @param scheduledStartTime 就業パターンの始業予定時刻 ("09:00" 等)
 * @param rules 丸めルール
 * @returns 補正後の時刻文字列 ("09:00" 等)
 */
export const roundCheckInTime = (
  rawTime?: string | null,
  scheduledStartTime?: string | null,
  rules: AttendanceRoundingRules = DEFAULT_ROUNDING_RULES
): string | null => {
  const rawMins = timeToMinutes(rawTime);
  if (rawMins === null) return null;

  const schedMins = timeToMinutes(scheduledStartTime);

  // 1. 始業時刻前の出勤打刻
  if (schedMins !== null && rawMins < schedMins) {
    if (rules.check_in_before_start === 'clip_to_start') {
      // 始業時刻に自動補正（推奨）
      return minutesToTime(schedMins);
    }
  }

  // 2. 出勤端数丸め（切り上げ）
  const roundUnit = rules.check_in_rounding_minutes;
  if (roundUnit <= 1) {
    return minutesToTime(rawMins);
  }

  const rounded = Math.ceil(rawMins / roundUnit) * roundUnit;
  return minutesToTime(rounded);
};

/**
 * 退勤打刻の丸め・補正処理
 * @param rawTime 実打刻時刻 ("18:08" 等)
 * @param scheduledEndTime 就業パターンの終業予定時刻 ("18:00" 等)
 * @param rules 丸めルール
 * @returns 補正後の時刻文字列 ("18:00" 等)
 */
export const roundCheckOutTime = (
  rawTime?: string | null,
  scheduledEndTime?: string | null,
  rules: AttendanceRoundingRules = DEFAULT_ROUNDING_RULES
): string | null => {
  const rawMins = timeToMinutes(rawTime);
  if (rawMins === null) return null;

  const schedMins = timeToMinutes(scheduledEndTime);

  // 1. 定時退勤バッファ判定（終業後、指定分以内なら定時退勤とみなす）
  if (schedMins !== null && rawMins > schedMins && rules.overtime_buffer_minutes > 0) {
    const diff = rawMins - schedMins;
    if (diff <= rules.overtime_buffer_minutes) {
      return minutesToTime(schedMins);
    }
  }

  // 2. 退勤端数丸め（切り捨て）
  const roundUnit = rules.check_out_rounding_minutes;
  if (roundUnit <= 1) {
    return minutesToTime(rawMins);
  }

  const rounded = Math.floor(rawMins / roundUnit) * roundUnit;
  return minutesToTime(rounded);
};

/**
 * 遅刻判定（猶予バッファ考慮）
 */
export const checkIsLate = (
  rawCheckIn?: string | null,
  scheduledStartTime?: string | null,
  lateGraceMinutes: number = 0
): boolean => {
  const inM = timeToMinutes(rawCheckIn);
  const startM = timeToMinutes(scheduledStartTime);
  if (inM === null || startM === null) return false;

  // 始業時刻 + 猶予分 より遅い場合は遅刻
  return inM > (startM + lateGraceMinutes);
};

/**
 * 1日の実労働時間・残業時間・控除休憩時間の総合算出
 */
export interface CalculatedDailyAttendance {
  roundedCheckIn: string | null;
  roundedCheckOut: string | null;
  actualWorkMinutes: number;
  actualWorkHoursText: string;
  overtimeMinutes: number;
  overtimeHoursText: string;
  midnightMinutes: number;
  midnightHoursText: string;
  breakMinutes: number;
  isLate: boolean;
  isEarlyLeave: boolean;
}

export const calculateDailyAttendanceDetails = (
  rawCheckIn?: string | null,
  rawCheckOut?: string | null,
  recordedBreakMinutes?: number | null,
  scheduledStartTime?: string | null,
  scheduledEndTime?: string | null,
  patternBreakMinutes: number = 60,
  rules: AttendanceRoundingRules = DEFAULT_ROUNDING_RULES
): CalculatedDailyAttendance => {
  const result: CalculatedDailyAttendance = {
    roundedCheckIn: null,
    roundedCheckOut: null,
    actualWorkMinutes: 0,
    actualWorkHoursText: '-',
    overtimeMinutes: 0,
    overtimeHoursText: '-',
    midnightMinutes: 0,
    midnightHoursText: '-',
    breakMinutes: 0,
    isLate: false,
    isEarlyLeave: false
  };

  if (!rawCheckIn) return result;

  // 出勤・退勤の丸め適用
  const roundedIn = roundCheckInTime(rawCheckIn, scheduledStartTime, rules);
  const roundedOut = roundCheckOutTime(rawCheckOut, scheduledEndTime, rules);

  result.roundedCheckIn = roundedIn;
  result.roundedCheckOut = roundedOut;

  // 遅刻判定（実打刻と猶予バッファで判定）
  result.isLate = checkIsLate(rawCheckIn, scheduledStartTime, rules.late_grace_minutes);

  // 早退判定
  if (rawCheckOut && scheduledEndTime) {
    const outM = timeToMinutes(rawCheckOut);
    const endM = timeToMinutes(scheduledEndTime);
    const startM = timeToMinutes(scheduledStartTime);
    if (outM !== null && endM !== null) {
      if (startM !== null && startM > endM) {
        // 日跨ぎシフト（例: 22:00〜翌07:00）
        const normalizedEndM = endM + 24 * 60;
        const normalizedOutM = (outM < startM) ? (outM + 24 * 60) : outM;
        if (normalizedOutM < normalizedEndM) {
          result.isEarlyLeave = true;
        }
      } else if (outM < endM) {
        result.isEarlyLeave = true;
      }
    }
  }

  // 退勤がない場合はここで終了
  if (!roundedIn || !roundedOut) return result;

  const inM = timeToMinutes(roundedIn);
  const outM = timeToMinutes(roundedOut);
  if (inM === null || outM === null) return result;

  // 🌙 日跨ぎ夜勤対応（退勤時刻の方が出勤時刻より小さい場合は翌日退勤として24時間を加算）
  let totalStayMinutes = outM - inM;
  if (totalStayMinutes < 0) {
    totalStayMinutes += 24 * 60;
  }
  if (totalStayMinutes <= 0) return result;

  // 休憩時間の決定（労働基準法第34条厳格準拠）
  let breakMins = 0;
  if (recordedBreakMinutes !== null && recordedBreakMinutes !== undefined && !isNaN(recordedBreakMinutes)) {
    // 手動入力または実打刻休憩
    breakMins = Number(recordedBreakMinutes);
  } else if (rules.break_deduction_mode === 'statutory') {
    // 🛡️ 労働基準法第34条第1項厳格準拠:
    // 労働時間が6時間を超える場合は45分以上、8時間を超える場合は1時間以上の休憩を労働時間の途中に与える義務
    // ※6時間以下の短時間勤務（パート・アルバイト等）に対する勝手な休憩控除を完全排除（労基法第24条全額払いの原則）
    if (totalStayMinutes > 480) {
      breakMins = 60;
    } else if (totalStayMinutes > 360) {
      breakMins = 45;
    } else {
      breakMins = 0;
    }
  } else if (rules.break_deduction_mode === 'pattern_fixed') {
    // 就業パターン固定
    breakMins = patternBreakMinutes || 60;
  }

  result.breakMinutes = breakMins;

  // 実働時間
  const actualMins = Math.max(0, totalStayMinutes - breakMins);
  result.actualWorkMinutes = actualMins;
  result.actualWorkHoursText = (actualMins / 60).toFixed(1);

  // 残業時間（法定8時間超過、または所定終業時刻超過）
  // 労基法原則: 実働8時間（480分）超過を残業とする
  if (actualMins > 480) {
    const ot = actualMins - 480;
    result.overtimeMinutes = ot;
    result.overtimeHoursText = (ot / 60).toFixed(1);
  } else {
    result.overtimeMinutes = 0;
    result.overtimeHoursText = '0.0';
  }

  // 🌙 深夜労働時間（22:00〜翌05:00・労働基準法第37条第4項）の自動集計
  let midnightMins = 0;
  let normalizedOutM = outM;
  if (normalizedOutM < inM) {
    normalizedOutM += 24 * 60;
  }
  for (let m = inM; m < normalizedOutM; m++) {
    const h = Math.floor(m / 60) % 24;
    if (h >= 22 || h < 5) {
      midnightMins++;
    }
  }
  // 休憩時間が深夜帯に重なる場合の簡易按分（深夜滞在比率に基づく控除）
  if (breakMins > 0 && totalStayMinutes > 0 && midnightMins > 0) {
    const nightRatio = midnightMins / totalStayMinutes;
    midnightMins = Math.max(0, Math.round(midnightMins - breakMins * nightRatio));
  }
  result.midnightMinutes = midnightMins;
  result.midnightHoursText = (midnightMins / 60).toFixed(1);

  return result;
};

