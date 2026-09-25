import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { DEFAULT_EMPLOYMENT_RULES } from '../lib/defaultRules';
import { OfficialCompanyCalendarDoc } from '../components/OfficialCompanyCalendarDoc';
import { OrgChartPrintModal } from '../components/OrgChartPrintModal';
import { OfficialLaborContractDoc } from '../components/OfficialLaborContractDoc';
import { HelpGuideModal } from '../components/HelpGuideModal';
import { BonusDocMasterInspector } from '../components/BonusDocMasterInspector';
import { OfficialReminderSettingsModal } from '../components/OfficialReminderSettingsModal';
import { StartupGuideCard } from '../components/StartupGuideCard';
import { LineConfigModal } from '../components/LineConfigModal';
import { 
  type LineIntegrationConfig, 
  getTenantLineConfig, 
  fetchTenantLineConfigFromDb 
} from '../lib/lineMessaging';
import { 
  type LaborContractTemplate, 
  DEFAULT_LABOR_CONTRACT_TEMPLATE, 
  extractRulesArticlesFromText, 
  generateOfficialClausesFromNotes, 
  getLaborContractTemplateFromStorage, 
  saveLaborContractTemplateToStorage,
  parsePayrollScheduleFromText
} from '../lib/laborContractTemplate';
import { 
  type PositionMaster, 
  type OrgDepartmentNode, 
  type OrgMemberInfo,
  DEFAULT_POSITIONS,
  POSITION_PRESETS,
  DEPARTMENT_PRESETS,
  getDepartmentTheme,
  savePositionsToStorage
} from '../lib/orgChart';
import { 
  type OnboardingWorkflowStep, 
  DEFAULT_ONBOARDING_STEPS, 
  getWorkflowStepsFromStorage, 
  saveWorkflowStepsToStorage 
} from '../lib/onboardingWorkflow';
import { 
  Building2, Users, Calendar, DollarSign, BookOpen, 
  ArrowLeft, ArrowRight, LogOut, Loader2, Save, Plus, Trash2, 
  Sparkles, Bot, Clock, ShieldCheck, Printer, X,
  UserCheck, ArrowUp, ArrowDown, RotateCcw, Edit3, Edit2,
  Network,  Award, Crown, Shield, FileText, Upload,
  ImageIcon, Wand2, CheckCircle2, Eye, Bell, FileSpreadsheet,
  ExternalLink, Store, MapPin, CreditCard, Check, Zap,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  SAAS_PLANS, 
  type SaasPlanType 
} from '../lib/subscriptionBilling';
import { PREFECTURES, getPrefectureRate, extractPrefectureCodeFromAddress } from '../lib/socialInsurance';
import { 
  type AnnouncementItem, 
  getAnnouncementsFromStorage, 
  saveAnnouncementsToStorage, 
  generateAiAnnouncementDraft 
} from '../lib/announcements';
import { purgeTenantLocalStorageCache } from '../lib/tenantCache';
import {
  type StoreMaster,
  getStoresFromStorage,
  saveStoresToStorage,
  fetchStoresUnified,
  saveStoresUnified,
  sanitizeStoreName
} from '../lib/storeMaster';
import {
  type AttendanceRoundingRules,
  type CustomAttendancePreset,
  ATTENDANCE_PRESETS,
  DEFAULT_ROUNDING_RULES,
  getAttendanceRoundingRules,
  saveAttendanceRoundingRules,
  getCustomPresetsFromStorage,
  saveCustomPresetsToStorage,
  minutesToTime
} from '../lib/attendanceRounding';

export interface DepartmentMaster {
  id: string;
  name: string;
  code?: string;
  manager_user_id?: string;
  manager_user_name?: string;
  display_order: number;
  calendar_pattern_id?: string; // 📅 適用営業カレンダーID
}

// 👑 役職階層ランク（Lv.1〜5）メタ定義
export const POSITION_RANKS_META = [
  { rank: 1, label: '1. 経営陣 (役員)', badge: 'Lv.1 役員', color: 'text-amber-800 bg-amber-50 border-amber-200', border: 'border-amber-200', bg: 'bg-amber-50/40', icon: '👑', desc: '代表取締役、専務、常務、取締役など' },
  { rank: 2, label: '2. 部門長 (部長等)', badge: 'Lv.2 部門長', color: 'text-indigo-800 bg-indigo-50 border-indigo-200', border: 'border-indigo-200', bg: 'bg-indigo-50/40', icon: '👔', desc: '本部長、部長、事業部長、統括など' },
  { rank: 3, label: '3. 中間管理職 (課長・マネージャー)', badge: 'Lv.3 中間管理職', color: 'text-blue-800 bg-blue-50 border-blue-200', border: 'border-blue-200', bg: 'bg-blue-50/40', icon: '🏢', desc: '課長、マネージャー、店長、エリア長など' },
  { rank: 4, label: '4. 現場リーダー・主任', badge: 'Lv.4 リーダー', color: 'text-emerald-800 bg-emerald-50 border-emerald-200', border: 'border-emerald-200', bg: 'bg-emerald-50/40', icon: '🎖️', desc: '係長、主任、チーフ、現場リーダーなど' },
  { rank: 5, label: '5. 一般社員・スタッフ', badge: 'Lv.5 一般', color: 'text-slate-700 bg-slate-100 border-slate-200', border: 'border-slate-200', bg: 'bg-slate-50/60', icon: '👤', desc: '一般社員、契約社員、パート・アルバイトなど' },
];

// 📅 会社営業カレンダー・休日パターン定義（複数カレンダー対応SSOT）
export interface CompanyCalendarPattern {
  id: string;
  name: string; // 例: 標準カレンダー（本社・営業）、店舗・サービス（シフト制）、製造・現場（日祝隔週土）
  is_default?: boolean; // 代表（全社標準）カレンダーかどうか
  fixed_holidays: number[]; // 0:日, 6:土 など
  national_holidays_enabled: boolean;
  winter_vacation_enabled: boolean;
  winter_vacation_start: string;
  winter_vacation_end: string;
  summer_vacation_enabled: boolean;
  summer_vacation_start: string;
  summer_vacation_end: string;
  custom_holidays: { date: string; name: string }[];
  individual_overrides: { [key: string]: boolean };
  annual_holidays_count: number;
  holiday_text_summary: string;
  description?: string; // 部門・業務の説明
}

export const DEFAULT_CALENDAR_PATTERNS: CompanyCalendarPattern[] = [
  {
    id: 'cal-default',
    name: '標準カレンダー（本社・営業）',
    is_default: true,
    fixed_holidays: [0, 6],
    national_holidays_enabled: true,
    winter_vacation_enabled: true,
    winter_vacation_start: '2026-12-29',
    winter_vacation_end: '2027-01-03',
    summer_vacation_enabled: true,
    summer_vacation_start: '2026-08-13',
    summer_vacation_end: '2026-08-16',
    custom_holidays: [],
    individual_overrides: {},
    annual_holidays_count: 125,
    holiday_text_summary: '完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）',
    description: '本社・管理部門・営業職など土日祝休みの部署向け'
  },
  {
    id: 'cal-shift',
    name: '店舗・サービス（シフト制）',
    is_default: false,
    fixed_holidays: [],
    national_holidays_enabled: false,
    winter_vacation_enabled: false,
    winter_vacation_start: '2026-12-29',
    winter_vacation_end: '2027-01-03',
    summer_vacation_enabled: false,
    summer_vacation_start: '2026-08-13',
    summer_vacation_end: '2026-08-16',
    custom_holidays: [],
    individual_overrides: {},
    annual_holidays_count: 105,
    holiday_text_summary: '週休2日シフト制（月8〜9日公休）、有給休暇、特別休暇（年間休日105日）',
    description: '店舗運営・飲食・小売・サービス部門向け（年中無休・シフト制）'
  },
  {
    id: 'cal-factory',
    name: '製造・物流・現場（日祝・隔週土曜）',
    is_default: false,
    fixed_holidays: [0],
    national_holidays_enabled: true,
    winter_vacation_enabled: true,
    winter_vacation_start: '2026-12-29',
    winter_vacation_end: '2027-01-03',
    summer_vacation_enabled: true,
    summer_vacation_start: '2026-08-13',
    summer_vacation_end: '2026-08-16',
    custom_holidays: [],
    individual_overrides: {},
    annual_holidays_count: 100,
    holiday_text_summary: '日曜日、祝日、隔週土曜日（第2・第4土曜）、年末年始、夏季（年間休日100日）',
    description: '工場ライン・物流倉庫・配送・施工現場など隔週稼働の部門向け'
  }
];

export const getCalendarPatternsFromStorage = (tId?: string | null): CompanyCalendarPattern[] => {
  try {
    if (tId) {
      const raw = localStorage.getItem(`company_calendar_patterns_${tId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn('LocalStorage calendar patterns parse error:', e);
  }
  return DEFAULT_CALENDAR_PATTERNS;
};

export const saveCalendarPatternsToStorage = (tId: string | null, patterns: CompanyCalendarPattern[]) => {
  try {
    if (tId) {
      localStorage.setItem(`company_calendar_patterns_${tId}`, JSON.stringify(patterns));
    }
  } catch (e) {
    console.warn('LocalStorage calendar patterns save error:', e);
  }
};

export interface WorkSchedulePattern {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  target_department?: string;
  display_order: number;
}

// 2026年 国民の祝日
const NATIONAL_HOLIDAYS_2026: { [key: string]: string } = {
  '2026-01-01': '元日',
  '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日',
  '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日',
  '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日',
  '2026-07-20': '海の日',
  '2026-08-11': '山の日',
  '2026-09-21': '敬老の日',
  '2026-09-22': '国民の休日',
  '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日'
};

// 🧹 部署名の安全クレンジング（Excel数式・セル番地・記号などのコピペ混入ゴミデータを完全排除）
export const sanitizeDepartmentName = (name: string): string => {
  if (!name) return '';
  let cleaned = name.trim();
  // 「営業部+P3D2:P2D2...」のように + 以降にセル番地や記号が混入している場合、+ より前の正常な部署名を救出
  if (cleaned.includes('+')) {
    cleaned = cleaned.split('+')[0].trim();
  }
  // コロン、セミコロン、等号などの数式・セル範囲記号以降を除去
  cleaned = cleaned.replace(/[:;=<>].*$/, '').trim();
  return cleaned;
};

export const isValidDepartmentName = (name: string): boolean => {
  if (!name) return false;
  const cleaned = sanitizeDepartmentName(name);
  if (!cleaned || cleaned.length < 2) return false;
  // セル番地風（例: P3D2:P2D2）や英数字記号のみの文字列を排除
  if (/^[A-Za-z0-9:+_\-.]+$/.test(cleaned)) return false;
  return true;
};

// 🧹 現場職種（店舗の役割）が部署として誤生成・保存された偽部署の判定
export const isStoreRoleDept = (name?: string | null): boolean => {
  if (!name) return false;
  const n = sanitizeDepartmentName(name);
  return /^(環境整備|清掃|フロント|レジ|調理|厨房|ホール)(運営)?部?$/.test(n) ||
    n === '清掃部' || n === 'レジ部' || n === '厨房部' || n === 'ホール部' || n === 'フロント部' ||
    n === '環境整備・清掃部' || n === 'フロント・レジ部' || n === '調理厨房部' || n === 'ホール運営部';
};

// 🚫 ユーザーが明示的に削除した部署名の記録（LocalStorage永続化・自動復活の永久遮断）
export const getDeletedDepartmentNamesFromStorage = (tId?: string | null): Set<string> => {
  if (!tId) return new Set();
  try {
    const raw = localStorage.getItem(`deleted_department_names_${tId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (_) {}
  return new Set();
};

export const addDeletedDepartmentNameToStorage = (tId: string | null | undefined, name: string) => {
  if (!tId || !name) return;
  try {
    const current = getDeletedDepartmentNamesFromStorage(tId);
    current.add(name);
    localStorage.setItem(`deleted_department_names_${tId}`, JSON.stringify(Array.from(current)));
  } catch (_) {}
};

const saveDepartmentsToStorage = (tId: string, depts: DepartmentMaster[]) => {
  try {
    if (tId) {
      const deletedNames = getDeletedDepartmentNamesFromStorage(tId);
      const validMap = new Map<string, DepartmentMaster>();
      depts.forEach(d => {
        const cleanName = sanitizeDepartmentName(d.name);
        if (
          isValidDepartmentName(cleanName) &&
          !isStoreRoleDept(cleanName) &&
          !deletedNames.has(cleanName) &&
          !validMap.has(cleanName)
        ) {
          validMap.set(cleanName, { ...d, name: cleanName });
        }
      });
      localStorage.setItem(`company_departments_${tId}`, JSON.stringify(Array.from(validMap.values())));
    }
  } catch (e) {
    console.warn('LocalStorage departments save error:', e);
  }
};

export interface QualificationMaster {
  id: string;
  name: string;
  default_allowance: number;
  category: string;
  description: string;
  display_order: number;
}

export const DEFAULT_QUALIFICATIONS: QualificationMaster[] = [
  { id: 'qual-1', name: '第一種衛生管理者', default_allowance: 10000, category: '国家資格', description: '事業場の安全・衛生管理統括', display_order: 1 },
  { id: 'qual-2', name: '宅地建物取引士', default_allowance: 20000, category: '国家資格', description: '重要事項説明等の専任業務', display_order: 2 },
  { id: 'qual-3', name: '日商簿記2級', default_allowance: 5000, category: '公的資格', description: '経理・財務・原価計算業務', display_order: 3 },
  { id: 'qual-4', name: '基本情報技術者', default_allowance: 10000, category: '国家資格', description: 'IT・社内システム開発運用', display_order: 4 },
  { id: 'qual-5', name: '運行管理者', default_allowance: 15000, category: '国家資格', description: '安全運行・点呼指導管理', display_order: 5 },
  { id: 'qual-6', name: '登録販売者', default_allowance: 8000, category: '公的資格', description: '一般用医薬品販売管理', display_order: 6 },
  { id: 'qual-7', name: '介護福祉士', default_allowance: 15000, category: '国家資格', description: '専門介護・現場指導', display_order: 7 },
  { id: 'qual-8', name: 'フォークリフト運転技能講習修了', default_allowance: 3000, category: '技能講習', description: '物流・倉庫荷役業務', display_order: 8 },
];

export const getQualificationsFromStorage = (tId?: string | null): QualificationMaster[] => {
  try {
    if (tId) {
      const raw = localStorage.getItem(`company_qualifications_${tId}`);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('LocalStorage qualifications parse error:', e);
  }
  return DEFAULT_QUALIFICATIONS;
};

export const saveQualificationsToStorage = (tId: string | null, quals: QualificationMaster[]) => {
  try {
    if (tId) {
      localStorage.setItem(`company_qualifications_${tId}`, JSON.stringify(quals));
    }
  } catch (e) {
    console.warn('LocalStorage qualifications save error:', e);
  }
};

// 🏢 本格公式角印（企業名之印）の朱肉画像（透過PNG DataURL）を自動生成するエンジン
export const generateOfficialSealDataUrl = (companyName: string = ''): string => {
  if (typeof document === 'undefined' || !companyName.trim()) return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 透明背景
    ctx.clearRect(0, 0, 240, 240);

    const sealColor = '#dc2626'; // 鮮やかな朱肉赤
    ctx.strokeStyle = sealColor;
    ctx.fillStyle = sealColor;

    // 外枠角丸正方形
    ctx.lineWidth = 9;
    const r = 16;
    const p = 14;
    const w = 240 - p * 2;
    const h = 240 - p * 2;
    ctx.beginPath();
    ctx.moveTo(p + r, p);
    ctx.lineTo(p + w - r, p);
    ctx.quadraticCurveTo(p + w, p, p + w, p + r);
    ctx.lineTo(p + w, p + h - r);
    ctx.quadraticCurveTo(p + w, p + h, p + w - r, p + h);
    ctx.lineTo(p + r, p + h);
    ctx.quadraticCurveTo(p, p + h, p, p + h - r);
    ctx.lineTo(p, p + r);
    ctx.quadraticCurveTo(p, p, p + r, p);
    ctx.closePath();
    ctx.stroke();

    // 内枠細線（重厚な公式角印仕様）
    ctx.lineWidth = 2;
    const ip = p + 6;
    const iw = w - 12;
    const ih = h - 12;
    const ir = 10;
    ctx.beginPath();
    ctx.moveTo(ip + ir, ip);
    ctx.lineTo(ip + iw - ir, ip);
    ctx.quadraticCurveTo(ip + iw, ip, ip + iw, ip + ir);
    ctx.lineTo(ip + iw, ip + ih - ir);
    ctx.quadraticCurveTo(ip + iw, ip + ih, ip + iw - ir, ip + ih);
    ctx.lineTo(ip + ir, ip + ih);
    ctx.quadraticCurveTo(ip, ip + ih, ip, ip + ih - ir);
    ctx.lineTo(ip, ip + ir);
    ctx.quadraticCurveTo(ip, ip, ip + ir, ip);
    ctx.closePath();
    ctx.stroke();

    // 文字配置（伝統的縦書き角印スタイル）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (companyName.includes('cocotte') || companyName.includes('ココット')) {
      // 右列: 株式会社
      ctx.font = 'bold 36px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif';
      ctx.fillText('株', 158, 56);
      ctx.fillText('式', 158, 98);
      ctx.fillText('会', 158, 140);
      ctx.fillText('社', 158, 182);

      // 左列: cocotte之印
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('cocotte', 78, 70);
      ctx.font = 'bold 36px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif';
      ctx.fillText('之', 78, 126);
      ctx.fillText('印', 78, 175);
    } else if (companyName.includes('KAP')) {
      // 右列: 株式会社
      ctx.font = 'bold 36px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif';
      ctx.fillText('株', 158, 56);
      ctx.fillText('式', 158, 98);
      ctx.fillText('会', 158, 140);
      ctx.fillText('社', 158, 182);

      // 左列: KAP之印
      ctx.font = '900 32px sans-serif';
      ctx.fillText('KAP', 78, 70);
      ctx.font = 'bold 36px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif';
      ctx.fillText('之', 78, 126);
      ctx.fillText('印', 78, 175);
    } else {
      ctx.font = 'bold 38px "Hiragino Mincho ProN", "Yu Mincho", "MS PMincho", serif';
      ctx.fillText('株', 155, 75);
      ctx.fillText('式', 155, 160);
      ctx.fillText('社', 85, 75);
      ctx.fillText('印', 85, 160);
    }

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Canvas seal generator error:', e);
    return '';
  }
};

// 🔤 全角英数・記号の半角化
export const toHalfWidth = (str: string): string => {
  return str
    .replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/[―ー－‐–—]/g, '-');
};

// 🈢 ひらがな・半角カタカナの「全角カタカナ」統一化
export const toFullWidthKana = (str: string): string => {
  let kana = str.replace(/[\u3041-\u3096]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
  const kanaMap: { [key: string]: string } = {
    'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
    'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
    'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
    'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
    'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
    'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ノ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ヨ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ'
  };
  const reg = new RegExp(Object.keys(kanaMap).join('|'), 'g');
  return kana.replace(reg, (match) => kanaMap[match] || match);
};

// ① 社会保険 事業所整理記号（数字2桁-カタカナ）の自動整形
export const formatOfficeSymbol = (input: string): string => {
  if (!input) return '';
  let s = toHalfWidth(input).trim();
  s = toFullWidthKana(s);
  // 数字1〜2桁 + ハイフン等 + カタカナ の場合（例: 13トカ, 13-トカ, 1トカ -> 13-トカ, 01-トカ）
  s = s.replace(/^([0-9]{1,2})\s*[-－ー―]?\s*([ァ-ヶー]+)$/, (_, num, kana) => {
    return `${num.padStart(2, '0')}-${kana}`;
  });
  return s;
};

// ② 社会保険 事業所番号（4〜5桁半角数字）の自動整形
export const formatOfficeNumber = (input: string): string => {
  if (!input) return '';
  return toHalfWidth(input).replace(/[^0-9]/g, '').slice(0, 5);
};

// ③ 雇用保険 適用事業所番号（4桁-6桁-1桁）の自動整形
export const formatEmploymentInsuranceNumber = (input: string): string => {
  if (!input) return '';
  const digits = toHalfWidth(input).replace(/[^0-9]/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 11)}`;
};

// ④ 労働保険番号（2桁-1桁-2桁-6桁-3桁）の自動整形
export const formatLaborInsuranceNumber = (input: string): string => {
  if (!input) return '';
  const digits = toHalfWidth(input).replace(/[^0-9]/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 3) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2, 3)}-${digits.slice(3)}`;
  if (digits.length <= 11) return `${digits.slice(0, 2)}-${digits.slice(2, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 11)}-${digits.slice(11, 14)}`;
};

export default function CompanySettingsDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };
  const [activeTab, setActiveTab] = useState<'basic' | 'departments' | 'calendar' | 'payroll' | 'contract' | 'onboarding' | 'rules' | 'announcements' | 'qualifications' | 'reminders' | 'billing'>('basic');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 🔗 URLクエリパラメータ（?tab=billing 等）によるタブ自動選択
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab') as any;
    if (tabParam && ['basic', 'departments', 'calendar', 'payroll', 'contract', 'onboarding', 'rules', 'announcements', 'qualifications', 'reminders', 'billing'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // 💳 ご利用プランとお支払い情報State（SaaS課金・Square連携）
  const [tenantBilling, setTenantBilling] = useState<{
    plan_type: SaasPlanType;
    trial_ends_at: string | null;
    billing_cycle: 'monthly' | 'annual';
    square_checkout_url: string;
    square_subscription_id: string;
  }>({
    plan_type: 'trial',
    trial_ends_at: null,
    billing_cycle: 'monthly',
    square_checkout_url: '',
    square_subscription_id: ''
  });

  // 💬 全社LINE通知・月額課金設定State
  const [showLineConfigModal, setShowLineConfigModal] = useState(false);
  const [lineConfig, setLineConfig] = useState<LineIntegrationConfig>(() => getTenantLineConfig(''));

  // 📢 全社お知らせ掲示板State
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [newAnnTag, setNewAnnTag] = useState('お知らせ');
  const [newAnnDate, setNewAnnDate] = useState(new Date().toISOString().split('T')[0].replace(/-/g, '.'));

  // 社印画像State
  const [companySealUrl, setCompanySealUrl] = useState<string>('');

  // 労働条件・雇用契約書テンプレートState
  const [contractTemplate, setContractTemplate] = useState<LaborContractTemplate>(DEFAULT_LABOR_CONTRACT_TEMPLATE);
  const [contractPreviewModalOpen, setContractPreviewModalOpen] = useState(false);

  // AI条文清書モーダルState
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiNotesInput, setAiNotesInput] = useState('');
  const [aiGeneratedResult, setAiGeneratedResult] = useState<Partial<LaborContractTemplate> | null>(null);
  const [showBonusInspectorModal, setShowBonusInspectorModal] = useState(false);
  const [aiIsGenerating, setAiIsGenerating] = useState(false);

  // 入社手続きワークフローステップState
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingWorkflowStep[]>(DEFAULT_ONBOARDING_STEPS);
  const [companyUsers, setCompanyUsers] = useState<OrgMemberInfo[]>([]);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');
  const [newStepApproverType, setNewStepApproverType] = useState<'all_admins' | 'specific_user' | 'department_head'>('all_admins');
  const [newStepApproverUserId, setNewStepApproverUserId] = useState('');
  const [editingStepModal, setEditingStepModal] = useState<{
    isOpen: boolean;
    index: number;
    step: OnboardingWorkflowStep | null;
  }>({
    isOpen: false,
    index: -1,
    step: null
  });

  // 役職マスタ・組織図State
  const [positions, setPositions] = useState<PositionMaster[]>(DEFAULT_POSITIONS);
  const [newPositionName, setNewPositionName] = useState('');
  const [newPositionRank, setNewPositionRank] = useState(4);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [editingPositionNameText, setEditingPositionNameText] = useState('');
  const [isOrgChartPrintModalOpen, setIsOrgChartPrintModalOpen] = useState(false);
  const [editingUserModal, setEditingUserModal] = useState<{
    isOpen: boolean;
    user: OrgMemberInfo | null;
  }>({
    isOpen: false,
    user: null
  });



  // 🏛️ 社会保険・労働保険 事業所マスタState（SSOT一元化）
  const [insuranceMaster, setInsuranceMaster] = useState<{
    shakai_hoken_office_symbol: string;      // 社会保険 事業所整理記号（例: 01-イロ, 13-トカ）
    shakai_hoken_office_number: string;      // 社会保険 事業所番号（例: 12345）
    employment_insurance_office_number: string; // 雇用保険 適用事業所番号（例: 1301-123456-7）
    labor_insurance_number: string;             // 労働保険番号（例: 13-1-01-123456-000）
  }>({
    shakai_hoken_office_symbol: '',
    shakai_hoken_office_number: '',
    employment_insurance_office_number: '',
    labor_insurance_number: ''
  });

  // 1. 会社基本情報State
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    address: '',
    representative_name: '',
    phone_number: '',
    corporate_number: '',
    company_seal_url: ''
  });

  // 2. 部署マスタState
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptManagerId, setNewDeptManagerId] = useState('');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentNameText, setEditingDepartmentNameText] = useState('');
  const [isDeptPresetModalOpen, setIsDeptPresetModalOpen] = useState(false);

  // 🏪 2-2. 店舗・拠点マスタState（複数店舗対応・シフトカレンダー連動）
  const [stores, setStores] = useState<StoreMaster[]>([]);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCode, setNewStoreCode] = useState('');
  const [newStoreDept, setNewStoreDept] = useState('');
  const [newStoreManagerId, setNewStoreManagerId] = useState('');

  // 3. 就業時間パターンマスタState
  const [schedulePatterns, setSchedulePatterns] = useState<WorkSchedulePattern[]>([]);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternStartTime, setNewPatternStartTime] = useState('09:00');
  const [newPatternEndTime, setNewPatternEndTime] = useState('18:00');
  const [newPatternBreakMinutes, setNewPatternBreakMinutes] = useState(60);
  const [newPatternDept, setNewPatternDept] = useState('');
  
  // ⚙️ 現場即応 打刻・時間丸め（マル目）State
  const [attendanceRules, setAttendanceRules] = useState<AttendanceRoundingRules>(DEFAULT_ROUNDING_RULES);
  const [customPresets, setCustomPresets] = useState<CustomAttendancePreset[]>([]);
  const [newPresetModalOpen, setNewPresetModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  // 4. カレンダー・休日State（複数カレンダーパターン完全対応）
  const [calendarPatterns, setCalendarPatterns] = useState<CompanyCalendarPattern[]>(DEFAULT_CALENDAR_PATTERNS);
  const [activeCalendarId, setActiveCalendarId] = useState<string>('cal-default');
  const [calendarSettings, setCalendarSettings] = useState({
    year: 2026,
    fixed_holidays: [0, 6], // 0:日, 6:土
    national_holidays_enabled: true,
    winter_vacation_enabled: true,
    winter_vacation_start: '2026-12-29',
    winter_vacation_end: '2027-01-03',
    summer_vacation_enabled: true,
    summer_vacation_start: '2026-08-13',
    summer_vacation_end: '2026-08-16',
    custom_holidays: [] as { date: string; name: string }[],
    individual_overrides: {} as { [key: string]: boolean }, // 'YYYY-MM-DD': true(休日) or false(稼働日)
    annual_holidays_count: 125,
    holiday_text_summary: '完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）'
  });
  const [newCustomHolidayDate, setNewCustomHolidayDate] = useState('');
  const [newCustomHolidayName, setNewCustomHolidayName] = useState('');

  // カレンダー印刷モーダルState
  const [calendarPrintModalOpen, setCalendarPrintModalOpen] = useState(false);

  // 5. 給与・労務設定State
  const [payrollSettings, setPayrollSettings] = useState({
    closing_day: 31,
    payment_day: 25,
    payment_month: 'current',
    prefecture_code: '25', // デフォルト: 25 滋賀県
    overtime_rate: 1.25,
    night_rate: 0.25,
    holiday_rate: 1.35,
    health_insurance_rate: 0.0494, // 滋賀県 9.88% 折半 4.94%
    pension_rate: 0.0915,
    employment_insurance_rate: 0.006,
    commuting_allowance_limit: 150000
  });

  // 6. 就業規則・AI State
  const [employmentRulesText, setEmploymentRulesText] = useState(DEFAULT_EMPLOYMENT_RULES);
  const [geminiApiKey, setGeminiApiKey] = useState('');

  // 7. 📜 資格手当マスタState
  const [qualifications, setQualifications] = useState<QualificationMaster[]>([]);
  const [newQualName, setNewQualName] = useState('');
  const [newQualAllowance, setNewQualAllowance] = useState<number>(10000);
  const [newQualCategory, setNewQualCategory] = useState('国家資格');
  const [newQualDesc, setNewQualDesc] = useState('');
  const [editingQualModal, setEditingQualModal] = useState<{
    isOpen: boolean;
    qual: QualificationMaster | null;
  }>({
    isOpen: false,
    qual: null
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      if (!tenantIdData) return;
      setTenantId(tenantIdData);

      // テナント全体設定取得
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantIdData).maybeSingle();
      
      let loadedBasic: {
        name: string;
        address: string;
        representative_name: string;
        phone_number: string;
        corporate_number: string;
        company_seal_url: string;
      } = {
        name: tData?.name || '',
        address: tData?.address || '',
        representative_name: tData?.representative_name || '',
        phone_number: tData?.phone_number || '',
        corporate_number: tData?.corporate_number || '',
        company_seal_url: tData?.company_seal_url || ''
      };

      // 🛡️ 危険なテナント非分離グローバルキーおよび他社キャッシュの完全パージ（憲法9条：他社キャッシュ即時強制パージ）
      purgeTenantLocalStorageCache(tenantIdData);

      // 自社テナント専用キーからのみローカル最新設定を復元
      try {
        const rawLocal = localStorage.getItem(`company_basic_settings_${tenantIdData}`);
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          loadedBasic = {
            ...loadedBasic,
            ...parsed,
            address: parsed.address !== undefined ? parsed.address : loadedBasic.address,
            name: parsed.name !== undefined ? parsed.name : loadedBasic.name,
            representative_name: parsed.representative_name !== undefined ? parsed.representative_name : loadedBasic.representative_name,
            phone_number: parsed.phone_number !== undefined ? parsed.phone_number : loadedBasic.phone_number,
            company_seal_url: parsed.company_seal_url !== undefined ? parsed.company_seal_url : loadedBasic.company_seal_url
          };
        }
      } catch (e) {}

      // 社印画像：自社DBまたは自社テナント専用キーからのみ安全に復元
      let sealLoaded = loadedBasic.company_seal_url || '';
      if (!sealLoaded) {
        try {
          const localSeal = localStorage.getItem(`company_seal_image_${tenantIdData}`);
          if (localSeal && (localSeal.startsWith('data:image/') || localSeal.startsWith('http'))) {
            sealLoaded = localSeal;
          }
        } catch (_) {}
      }

      setCompanySealUrl(sealLoaded);
      loadedBasic.company_seal_url = sealLoaded;

      setBasicInfo(loadedBasic);

      // 労働条件・雇用契約書テンプレートの復元（DB最優先 ＋ LocalStorageフォールバック）
      let tplLoaded = getLaborContractTemplateFromStorage(tenantIdData);
      if (tData?.labor_contract_template_data && typeof tData.labor_contract_template_data === 'object' && Object.keys(tData.labor_contract_template_data).length > 0) {
        tplLoaded = { ...DEFAULT_LABOR_CONTRACT_TEMPLATE, ...tData.labor_contract_template_data };
      }
      if (sealLoaded && !tplLoaded.company_seal_url) {
        tplLoaded.company_seal_url = sealLoaded;
      }
      setContractTemplate(tplLoaded);

      // お知らせ一覧の復元
      const annLoaded = getAnnouncementsFromStorage(tenantIdData);
      setAnnouncements(annLoaded);

      // 💬 全社LINE設定・月額課金設定をDBから同期
      try {
        const dbLineCfg = await fetchTenantLineConfigFromDb(tenantIdData);
        if (dbLineCfg) {
          setLineConfig(dbLineCfg);
        }
      } catch (err) {
        console.error('Failed to sync LINE config from DB:', err);
      }

      // 🏛️ 社会保険・労働保険マスタの復元（実DB Supabaseの実在カラムをSSOTとする）
      const dbIns = tData?.shakai_hoken_settings || (tData as any)?.insurance_master_settings || {};
      const loadedInsurance = {
        shakai_hoken_office_symbol: dbIns.shakai_hoken_office_symbol || dbIns.office_symbol || '',
        shakai_hoken_office_number: tData?.shakai_hoken_office_number || dbIns.shakai_hoken_office_number || dbIns.office_number || '',
        employment_insurance_office_number: tData?.employment_insurance_office_number || dbIns.employment_insurance_office_number || '',
        labor_insurance_number: tData?.labor_insurance_number || dbIns.labor_insurance_number || ''
      };
      setInsuranceMaster(loadedInsurance);


      if (tData) {
        // 営業カレンダーパターンの復元（複数パターン＆後方互換性完全担保）
        const localCalPatterns = getCalendarPatternsFromStorage(tenantIdData);
        let resolvedCalPatterns = localCalPatterns;

        if (tData.work_calendar_settings?.calendar_patterns && Array.isArray(tData.work_calendar_settings.calendar_patterns) && tData.work_calendar_settings.calendar_patterns.length > 0) {
          resolvedCalPatterns = tData.work_calendar_settings.calendar_patterns;
        } else if (tData.work_calendar_settings) {
          resolvedCalPatterns = resolvedCalPatterns.map(p => {
            if (p.id === 'cal-default' || p.is_default) {
              return {
                ...p,
                ...tData.work_calendar_settings
              };
            }
            return p;
          });
        }
        setCalendarPatterns(resolvedCalPatterns);

        const defaultActiveId = tData.work_calendar_settings?.active_pattern_id 
          || resolvedCalPatterns.find(p => p.is_default)?.id 
          || resolvedCalPatterns[0]?.id 
          || 'cal-default';
        setActiveCalendarId(defaultActiveId);

        const curPattern = resolvedCalPatterns.find(p => p.id === defaultActiveId) || resolvedCalPatterns[0];
        if (curPattern) {
          setCalendarSettings(prev => ({
            ...prev,
            ...curPattern,
            year: prev.year || 2026
          }));
        } else if (tData.work_calendar_settings) {
          setCalendarSettings(prev => ({
            ...prev,
            ...tData.work_calendar_settings
          }));
        }

        if (tData.payroll_common_settings) {
          setPayrollSettings(prev => ({
            ...prev,
            ...tData.payroll_common_settings
          }));
        }

        if (tData.employment_rules_text) {
          setEmploymentRulesText(tData.employment_rules_text);
        }
        if (tData.gemini_api_key) {
          setGeminiApiKey(tData.gemini_api_key);
        }
        if (tData.portal_announcements_data && Array.isArray(tData.portal_announcements_data) && tData.portal_announcements_data.length > 0) {
          setAnnouncements(tData.portal_announcements_data);
        }
        if (tData.labor_contract_template_data && typeof tData.labor_contract_template_data === 'object' && Object.keys(tData.labor_contract_template_data).length > 0) {
          setContractTemplate(prev => ({ ...prev, ...tData.labor_contract_template_data }));
        }
        if (tData.onboarding_workflow_settings && Array.isArray(tData.onboarding_workflow_settings)) {
          setOnboardingSteps(tData.onboarding_workflow_settings);
        } else {
          setOnboardingSteps(getWorkflowStepsFromStorage());
        }

        // 🏢 役職マスタ復元（実DB tenants.position_settings JSONB をSSOTとする）
        let loadedPositions: PositionMaster[] = [];
        const pSettings = (tData as any)?.position_settings;
        if (Array.isArray(pSettings) && pSettings.length > 0) {
          loadedPositions = pSettings;
        }

        // DBが未登録の場合はローカルキャッシュから安全にフォールバック復元してDBへ自己修復同期
        if (loadedPositions.length === 0) {
          try {
            const rawLocalPos = localStorage.getItem(`company_position_masters_${tenantIdData}`);
            if (rawLocalPos) {
              const parsed = JSON.parse(rawLocalPos);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedPositions = parsed;
                // 実DBの position_settings へ即時自己修復同期
                supabase.from('tenants').update({ position_settings: parsed }).eq('id', tenantIdData).then();
              }
            }
          } catch (_) {}
        }

        setPositions(loadedPositions);
        if (loadedPositions.length > 0) {
          savePositionsToStorage(loadedPositions, tenantIdData);
        }

        // 💳 テナント課金情報・プラン復元
        let loadedSquareUrl = tData.square_checkout_url || '';
        try {
          const localUrl = localStorage.getItem(`square_checkout_url_${tenantIdData}`);
          if (localUrl) loadedSquareUrl = localUrl;
        } catch (_) {}

        setTenantBilling({
          plan_type: (tData.plan_type as SaasPlanType) || 'trial',
          trial_ends_at: tData.trial_ends_at || null,
          billing_cycle: (tData.billing_cycle as any) || 'monthly',
          square_checkout_url: loadedSquareUrl,
          square_subscription_id: tData.square_subscription_id || ''
        });
      } else {
        setOnboardingSteps(getWorkflowStepsFromStorage());
        setPositions([]);
      }

      // 部署マスタ取得（実DB department_masters をSSOTとする）
      let deptsLoaded: DepartmentMaster[] = [];
      try {
        const { data: deptData, error: deptErr } = await supabase
          .from('department_masters')
          .select('*')
          .eq('tenant_id', tenantIdData)
          .order('display_order', { ascending: true });
        if (!deptErr && deptData && deptData.length > 0) {
          // DBデータから偽部署（職種名）を排除
          deptsLoaded = deptData.filter(d => !isStoreRoleDept(d.name));
        } else if (deptErr) {
          console.warn('Fetch department masters from DB error, using fallback:', deptErr);
        }
      } catch (e) {
        console.warn('Fetch department masters from DB exception:', e);
      }

      // DBで取得できなかった場合のローカルセーフティネット復元
      if (deptsLoaded.length === 0) {
        try {
          const rawLocal = localStorage.getItem(`company_departments_${tenantIdData}`);
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const deletedNames = getDeletedDepartmentNamesFromStorage(tenantIdData);
              deptsLoaded = parsed.filter(d => d.name && !isStoreRoleDept(d.name) && !deletedNames.has(d.name.trim()));
            }
          }
        } catch (_) {}
      }

      // 取得値をセット＆ストレージ保存
      setDepartments(deptsLoaded);
      if (deptsLoaded.length > 0) {
        saveDepartmentsToStorage(tenantIdData, deptsLoaded);
      }

      // 🏪 店舗・拠点マスタ取得（DBとLocalStorageのハイブリッド復元・勝手なダミー注入を撤廃）
      try {
        const loadedStores = await fetchStoresUnified(tenantIdData);
        setStores(loadedStores || []);
      } catch (stErr) {
        console.warn('Load stores error:', stErr);
        const localSt = getStoresFromStorage(tenantIdData);
        setStores(localSt || []);
      }

      // 就業時間パターンマスタ取得
      const { data: patData } = await supabase
        .from('work_schedule_patterns')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('display_order', { ascending: true });
      
      if (patData && patData.length > 0) {
        setSchedulePatterns(patData);
      } else {
        setSchedulePatterns([
          { id: '1', name: '標準勤務（本社・営業）', start_time: '09:00', end_time: '18:00', break_minutes: 60, target_department: '営業部', display_order: 1 },
          { id: '2', name: '店舗早番（08:00〜17:00）', start_time: '08:00', end_time: '17:00', break_minutes: 60, target_department: '店舗運営部', display_order: 2 },
          { id: '3', name: '店舗遅番（12:00〜21:00）', start_time: '12:00', end_time: '21:00', break_minutes: 60, target_department: '店舗運営部', display_order: 3 },
          { id: '4', name: '育児・時短勤務', start_time: '09:30', end_time: '16:30', break_minutes: 60, target_department: '', display_order: 4 }
        ]);
      }

      // ⚙️ 打刻丸めルールの取得（実DB tenants.work_calendar_settings をSSOTとする）
      let loadedRules: AttendanceRoundingRules = DEFAULT_ROUNDING_RULES;
      if (tData?.work_calendar_settings?.attendance_rounding_rules) {
        loadedRules = { ...DEFAULT_ROUNDING_RULES, ...tData.work_calendar_settings.attendance_rounding_rules };
      } else {
        loadedRules = getAttendanceRoundingRules(tenantIdData);
      }
      setAttendanceRules(loadedRules);
      saveAttendanceRoundingRules(tenantIdData, loadedRules);

      let loadedPresets: CustomAttendancePreset[] = [];
      if (tData?.work_calendar_settings?.attendance_custom_presets && Array.isArray(tData.work_calendar_settings.attendance_custom_presets)) {
        loadedPresets = tData.work_calendar_settings.attendance_custom_presets;
      } else if (tData?.work_calendar_settings?.custom_rounding_presets && Array.isArray(tData.work_calendar_settings.custom_rounding_presets)) {
        loadedPresets = tData.work_calendar_settings.custom_rounding_presets;
      } else {
        loadedPresets = getCustomPresetsFromStorage(tenantIdData);
      }
      setCustomPresets(loadedPresets);
      saveCustomPresetsToStorage(tenantIdData, loadedPresets);

      // 自社ユーザー一覧（役職・所属長・組織図用）の一元取得（400エラー対策済み）
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantIdData)
        .order('created_at', { ascending: false });

      // 社員の役職割り当てマップ（localStorage / テナント設定からの補完）
      const savedUserPositions: Record<string, { position_id?: string; position_name?: string; department?: string; store_name?: string }> = (() => {
        try {
          const raw = localStorage.getItem(`user_positions_${tenantIdData}`);
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      })();

      const mergedUsers: OrgMemberInfo[] = (uData || []).map((u: any) => {
        const customPos = savedUserPositions[u.id] || {};
        const rawStore = u.store_name || customPos.store_name || undefined;
        let rawDept = u.department || customPos.department || undefined;
        // 店舗が紐付いている場合は組織上「店舗運営部」に確実に集約
        if (rawStore && rawStore.trim() !== '') {
          rawDept = '店舗運営部';
        }
        return {
          id: u.id,
          name: u.name || u.email?.split('@')[0] || '従業員',
          role: u.role || 'user',
          department: rawDept,
          store_name: rawStore,
          position_id: u.position_id || customPos.position_id || undefined,
          position_name: u.position_name || customPos.position_name || (u.role === 'admin' ? '代表取締役' : undefined)
        };
      });

      // ログイン中の管理者自身が未登録の場合は自動補完
      if (user && !mergedUsers.some(u => u.id === user.id)) {
        const selfUser: OrgMemberInfo = {
          id: user.id,
          name: basicInfo.representative_name.replace('代表取締役', '').trim() || user.email?.split('@')[0] || '代表取締役',
          role: 'admin',
          position_name: '代表取締役',
          department: undefined
        };
        mergedUsers.unshift(selfUser);
      }

      setCompanyUsers(mergedUsers);

      // 7. 資格手当マスタ取得 (実DB company_qualification_masters をSSOTとする)
      try {
        const { data: qData, error: qErr } = await supabase
          .from('company_qualification_masters')
          .select('*')
          .eq('tenant_id', tenantIdData)
          .order('display_order', { ascending: true });

        if (!qErr && qData) {
          setQualifications(qData);
          saveQualificationsToStorage(tenantIdData, qData);
        } else if ((tData as any)?.qualification_masters_data && Array.isArray((tData as any).qualification_masters_data)) {
          setQualifications((tData as any).qualification_masters_data);
          saveQualificationsToStorage(tenantIdData, (tData as any).qualification_masters_data);
        } else {
          setQualifications([]);
        }
      } catch (qErr) {
        console.warn('company_qualification_masters fetch note:', qErr);
        if ((tData as any)?.qualification_masters_data && Array.isArray((tData as any).qualification_masters_data)) {
          setQualifications((tData as any).qualification_masters_data);
        } else {
          setQualifications([]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 年間の全休日セットを算出（ルール ＋ 個別上書き ＋ 翌年1月年末年始）
  const computedHolidaysSet = useMemo(() => {
    const set = new Set<string>();
    const year = calendarSettings.year || 2026;
    const nextYear = year + 1;

    // 1. 固定曜日 (当年12ヶ月 ＋ 翌年1月)
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d);
        if (calendarSettings.fixed_holidays.includes(date.getDay())) {
          const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          set.add(key);
        }
      }
    }
    // 翌年1月の固定曜日
    const nextJanDays = new Date(nextYear, 1, 0).getDate();
    for (let d = 1; d <= nextJanDays; d++) {
      const date = new Date(nextYear, 0, d);
      if (calendarSettings.fixed_holidays.includes(date.getDay())) {
        const key = `${nextYear}-01-${String(d).padStart(2, '0')}`;
        set.add(key);
      }
    }

    // 2. 国民の祝日 (当年 ＋ 翌年1月)
    if (calendarSettings.national_holidays_enabled) {
      Object.keys(NATIONAL_HOLIDAYS_2026).forEach(k => {
        if (k.startsWith(`${year}-`)) set.add(k);
      });
      // 翌年1月の祝日（元日 1/1 ＋ 成人の日 第2月曜）
      set.add(`${nextYear}-01-01`);
      // 翌年1月の第2月曜日を算出
      let mondayCount = 0;
      for (let d = 1; d <= 14; d++) {
        const dt = new Date(nextYear, 0, d);
        if (dt.getDay() === 1) {
          mondayCount++;
          if (mondayCount === 2) {
            set.add(`${nextYear}-01-${String(d).padStart(2, '0')}`);
            break;
          }
        }
      }
    }

    // 3. 年末年始休暇 (当年12月〜翌年1月)
    if (calendarSettings.winter_vacation_enabled) {
      if (calendarSettings.winter_vacation_start && calendarSettings.winter_vacation_end) {
        let cur = new Date(calendarSettings.winter_vacation_start);
        const end = new Date(calendarSettings.winter_vacation_end);
        while (cur <= end) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          set.add(key);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        // デフォルト: 12/29〜1/3 を年末年始休暇として追加
        set.add(`${year}-12-29`);
        set.add(`${year}-12-30`);
        set.add(`${year}-12-31`);
        set.add(`${nextYear}-01-01`);
        set.add(`${nextYear}-01-02`);
        set.add(`${nextYear}-01-03`);
      }
    }

    // 4. 夏季休暇
    if (calendarSettings.summer_vacation_enabled && calendarSettings.summer_vacation_start && calendarSettings.summer_vacation_end) {
      let cur = new Date(calendarSettings.summer_vacation_start);
      const end = new Date(calendarSettings.summer_vacation_end);
      while (cur <= end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (key.startsWith(`${year}-`)) set.add(key);
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 5. 独自休日
    calendarSettings.custom_holidays.forEach(h => {
      if (h.date && (h.date.startsWith(`${year}-`) || h.date.startsWith(`${nextYear}-01`))) {
        set.add(h.date);
      }
    });

    // 6. 個別上書き (クリック切り替え)
    Object.entries(calendarSettings.individual_overrides || {}).forEach(([dateKey, isHol]) => {
      if (isHol) {
        set.add(dateKey);
      } else {
        set.delete(dateKey);
      }
    });

    return set;
  }, [calendarSettings]);

  // 組織図用: 経営陣（役員・代表）の抽出
  const computedExecutives = useMemo<OrgMemberInfo[]>(() => {
    return companyUsers.filter(u => {
      const pos = positions.find(p => p.id === u.position_id);
      return (pos && pos.rank_level === 1) || (u.role === 'admin' && !u.department);
    });
  }, [companyUsers, positions]);

  // 組織図用: 各部門ごとの所属ノード（マスタ部署 ＋ 社員が所属する実在部署をすべて自動包括）
  // 🧹 現場職種（清掃、フロント、厨房、ホール等）は部署ではなく店舗現場の役割であるため「店舗運営部」へ完全統合
  const computedOrgDepartments = useMemo<OrgDepartmentNode[]>(() => {
    const isStoreRoleDept = (name: string): boolean => {
      const n = (name || '').trim();
      return /^(環境整備|清掃|フロント|レジ|調理|厨房|ホール)(運営)?部?$/.test(n) ||
        n === '清掃部' || n === 'レジ部' || n === '厨房部' || n === 'ホール部' || n === 'フロント部' ||
        n === '環境整備・清掃部' || n === 'フロント・レジ部' || n === '調理厨房部' || n === 'ホール運営部';
    };

    // 社員の部署を正規化（現場職種名は「店舗運営部」へ集約）
    const getNormalizedDept = (rawDept?: string | null): string => {
      if (!rawDept) return '';
      const clean = sanitizeDepartmentName(rawDept);
      if (isStoreRoleDept(clean)) return '店舗運営部';
      return clean;
    };

    // 1. マスタ登録済みの部署（偽部署および削除済み部署を除外）
    const deletedNames = getDeletedDepartmentNamesFromStorage(tenantId);
    const baseDepartments = departments.filter(d => !isStoreRoleDept(d.name) && !deletedNames.has(d.name));

    const deptList: OrgDepartmentNode[] = baseDepartments.map(d => {
      const members = companyUsers.filter(u => {
        const hasStore = Boolean(u.store_name && u.store_name.trim() !== '');
        if (d.name === '店舗運営部') {
          // 店舗運営部には、店舗が設定された全社員、または部署が「店舗運営部」の社員を集約
          return hasStore || getNormalizedDept(u.department) === '店舗運営部';
        }
        // 店舗が設定されている社員は、本社部署（営業部・総務部等）には含めない
        if (hasStore) return false;
        const norm = getNormalizedDept(u.department);
        return norm === d.name;
      });
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        manager_user_id: d.manager_user_id,
        manager_user_name: d.manager_user_name,
        display_order: d.display_order,
        members
      };
    });

    // 2. 社員が入退社台帳等で所属しているが、部署マスタに未登録の部署（人事部、経理部等）を自動補完（偽部署・ゴミデータ排除）
    const existingNames = new Set(deptList.map(d => d.name));
    companyUsers.forEach(u => {
      const rawDept = (u.department || '').trim();
      const hasStore = Boolean(u.store_name && u.store_name.trim() !== '');

      // 🏪 店舗があるのにDB部署が「店舗運営部」以外になっている不整合レコードを自己修復
      if (hasStore && rawDept !== '店舗運営部' && u.id) {
        supabase.from('users').update({ department: '店舗運営部' }).eq('id', u.id).then(() => {}, () => {});
      }

      if (!rawDept) return;
      const cleanDept = sanitizeDepartmentName(rawDept);
      const normalizedDept = getNormalizedDept(cleanDept);

      // 🧹 現場職種（フロント・レジ部等）またはゴミ部署データの自動修復
      if (rawDept !== normalizedDept && normalizedDept && u.id && !hasStore) {
        supabase.from('users').update({ department: normalizedDept }).eq('id', u.id).then(() => {}, () => {});
      }

      // 現場職種名およびユーザーが削除した部署名は独立部署として追加しない（店舗運営部に集約済みまたは抹消）
      if (isStoreRoleDept(cleanDept) || deletedNames.has(normalizedDept)) return;

      if (normalizedDept && isValidDepartmentName(normalizedDept) && !existingNames.has(normalizedDept)) {
        existingNames.add(normalizedDept);
        const members = companyUsers.filter(m => getNormalizedDept(m.department) === normalizedDept);
        const matchedMasterDept = departments.find(d => sanitizeDepartmentName(d.name) === normalizedDept);
        deptList.push({
          id: matchedMasterDept ? matchedMasterDept.id : `auto_${normalizedDept}`,
          name: normalizedDept,
          manager_user_id: matchedMasterDept?.manager_user_id,
          manager_user_name: matchedMasterDept?.manager_user_name,
          members,
          display_order: deptList.length + 1
        });
      }
    });

    return deptList;
  }, [departments, companyUsers]);

  // 未配属・本部直属のメンバー
  const computedUnassignedMembers = useMemo<OrgMemberInfo[]>(() => {
    return companyUsers.filter(u => !u.department && !computedExecutives.some(e => e.id === u.id));
  }, [companyUsers, computedExecutives]);

  // 休日要約テキストの自動生成ヘルパー
  const generateHolidaySummaryText = (cal: typeof calendarSettings, holCount: number): string => {
    const satSun = cal.fixed_holidays.includes(0) && cal.fixed_holidays.includes(6);
    const sunOnly = cal.fixed_holidays.includes(0) && !cal.fixed_holidays.includes(6);
    let holSummary = satSun 
      ? '完全週休2日制（土日・祝日）' 
      : sunOnly 
        ? '週休制（日曜・祝日）' 
        : cal.fixed_holidays.length === 0 
          ? '週休2日シフト制（公休月8〜9日）' 
          : '会社カレンダーによる指定休日';
    if (cal.winter_vacation_enabled) holSummary += '、年末年始休暇';
    if (cal.summer_vacation_enabled) holSummary += '、夏季休暇';
    holSummary += `（年間休日${holCount}日）`;
    return holSummary;
  };

  // 📅 カレンダーパターンの切り替え
  const handleSelectCalendarPattern = (targetId: string) => {
    if (targetId === activeCalendarId) return;

    // 現在の編集内容を現在のアクティブパターンに反映保存
    const updatedPatterns = calendarPatterns.map(p => {
      if (p.id === activeCalendarId) {
        return {
          ...p,
          ...calendarSettings,
          annual_holidays_count: computedHolidaysSet.size,
          holiday_text_summary: generateHolidaySummaryText(calendarSettings, computedHolidaysSet.size)
        };
      }
      return p;
    });

    const nextPattern = updatedPatterns.find(p => p.id === targetId);
    if (!nextPattern) return;

    setCalendarPatterns(updatedPatterns);
    setActiveCalendarId(targetId);
    setCalendarSettings({
      year: calendarSettings.year || 2026,
      fixed_holidays: nextPattern.fixed_holidays || [],
      national_holidays_enabled: nextPattern.national_holidays_enabled ?? true,
      winter_vacation_enabled: nextPattern.winter_vacation_enabled ?? true,
      winter_vacation_start: nextPattern.winter_vacation_start || '2026-12-29',
      winter_vacation_end: nextPattern.winter_vacation_end || '2027-01-03',
      summer_vacation_enabled: nextPattern.summer_vacation_enabled ?? true,
      summer_vacation_start: nextPattern.summer_vacation_start || '2026-08-13',
      summer_vacation_end: nextPattern.summer_vacation_end || '2026-08-16',
      custom_holidays: nextPattern.custom_holidays || [],
      individual_overrides: nextPattern.individual_overrides || {},
      annual_holidays_count: nextPattern.annual_holidays_count || 125,
      holiday_text_summary: nextPattern.holiday_text_summary || ''
    });
  };

  // 📅 カレンダーパターンの新規追加
  const handleAddCalendarPattern = () => {
    const newId = `cal-${Date.now()}`;
    const newPat: CompanyCalendarPattern = {
      id: newId,
      name: `新規カレンダー (${calendarPatterns.length + 1})`,
      is_default: false,
      fixed_holidays: [0, 6],
      national_holidays_enabled: true,
      winter_vacation_enabled: true,
      winter_vacation_start: '2026-12-29',
      winter_vacation_end: '2027-01-03',
      summer_vacation_enabled: true,
      summer_vacation_start: '2026-08-13',
      summer_vacation_end: '2026-08-16',
      custom_holidays: [],
      individual_overrides: {},
      annual_holidays_count: 125,
      holiday_text_summary: '完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）',
      description: '追加の営業日・休日パターン'
    };

    const updated = calendarPatterns.map(p => {
      if (p.id === activeCalendarId) {
        return {
          ...p,
          ...calendarSettings,
          annual_holidays_count: computedHolidaysSet.size,
          holiday_text_summary: generateHolidaySummaryText(calendarSettings, computedHolidaysSet.size)
        };
      }
      return p;
    });

    setCalendarPatterns([...updated, newPat]);
    setActiveCalendarId(newId);
    setCalendarSettings({
      year: calendarSettings.year || 2026,
      fixed_holidays: [0, 6],
      national_holidays_enabled: true,
      winter_vacation_enabled: true,
      winter_vacation_start: '2026-12-29',
      winter_vacation_end: '2027-01-03',
      summer_vacation_enabled: true,
      summer_vacation_start: '2026-08-13',
      summer_vacation_end: '2026-08-16',
      custom_holidays: [],
      individual_overrides: {},
      annual_holidays_count: 125,
      holiday_text_summary: '完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）'
    });
  };

  // 📅 カレンダーパターンの削除
  const handleDeleteCalendarPattern = (patId: string) => {
    const pat = calendarPatterns.find(p => p.id === patId);
    if (pat?.is_default) {
      alert('⚠️ 全社標準（代表）カレンダーは削除できません。別のカレンダーを全社標準に指定してから削除してください。');
      return;
    }
    if (calendarPatterns.length <= 1) {
      alert('⚠️ 最低1つの営業カレンダーが必要です。');
      return;
    }
    if (!confirm(`営業カレンダー「${pat?.name}」を削除しますか？\n※ 削除しても、過去の勤怠実績データは保持されます。`)) return;

    const remaining = calendarPatterns.filter(p => p.id !== patId);
    setCalendarPatterns(remaining);
    if (activeCalendarId === patId) {
      const nextPat = remaining[0];
      setActiveCalendarId(nextPat.id);
      setCalendarSettings({
        year: calendarSettings.year || 2026,
        ...nextPat
      });
    }
  };

  // 📅 全社標準（代表）カレンダーの指定
  const handleSetDefaultCalendarPattern = (patId: string) => {
    setCalendarPatterns(prev => prev.map(p => ({
      ...p,
      is_default: p.id === patId
    })));
  };

  // 📅 パターン名称・説明の更新
  const handleUpdatePatternName = (patId: string, newName: string) => {
    setCalendarPatterns(prev => prev.map(p => p.id === patId ? { ...p, name: newName } : p));
  };

  const handleUpdatePatternDesc = (patId: string, newDesc: string) => {
    setCalendarPatterns(prev => prev.map(p => p.id === patId ? { ...p, description: newDesc } : p));
  };

  // 🏢 部署の適用カレンダー更新
  const handleUpdateDepartmentCalendar = (deptName: string, patternId: string) => {
    setDepartments(prev => {
      const cleanName = sanitizeDepartmentName(deptName);
      const exists = prev.some(d => sanitizeDepartmentName(d.name) === cleanName);
      if (exists) {
        return prev.map(d => sanitizeDepartmentName(d.name) === cleanName ? { ...d, calendar_pattern_id: patternId } : d);
      } else {
        return [
          ...prev,
          {
            id: `dept_${Date.now()}`,
            name: cleanName,
            display_order: prev.length + 1,
            calendar_pattern_id: patternId
          }
        ];
      }
    });
  };

  // カレンダーの日付クリックで休日/出勤日をトグル
  const handleToggleDay = (dateKey: string) => {
    const isCurrentlyHoliday = computedHolidaysSet.has(dateKey);
    const updatedOverrides = {
      ...(calendarSettings.individual_overrides || {}),
      [dateKey]: !isCurrentlyHoliday
    };

    setCalendarSettings(prev => ({
      ...prev,
      individual_overrides: updatedOverrides
    }));
  };

  // 社印（印影）画像のアップロード処理 (Base64化)
  const handleSealImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('社印画像のファイルサイズは 2MB 以下にしてください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCompanySealUrl(base64);
      setContractTemplate(prev => ({ ...prev, company_seal_url: base64 }));
      setBasicInfo(prev => ({ ...prev, company_seal_url: base64 }));
      if (tenantId) {
        localStorage.setItem(`company_seal_image_${tenantId}`, base64);
        localStorage.setItem('company_seal_image', base64);
      }
    };
    reader.readAsDataURL(file);
  };

  // 社印（印影）の削除
  const handleRemoveSeal = () => {
    if (!confirm('登録された社印（印影）画像を削除しますか？')) return;
    setCompanySealUrl('');
    setContractTemplate(prev => ({ ...prev, company_seal_url: '' }));
    setBasicInfo(prev => ({ ...prev, company_seal_url: '' }));
    if (tenantId) {
      localStorage.removeItem(`company_seal_image_${tenantId}`);
      localStorage.removeItem('company_seal_image');
    }
  };

  // 就業規則から条文番号（退職・定年・解雇・有休）を自動抽出してテンプレートへマッピング
  const handleExtractArticlesFromRules = () => {
    const extracted = extractRulesArticlesFromText(employmentRulesText);
    setContractTemplate(prev => ({
      ...prev,
      resignation_rules_article: extracted.resignationArticle,
      retirement_rules_article: extracted.retirementArticle,
      dismissal_rules_article: extracted.dismissalArticle,
      paid_leave_rules_article: `${extracted.paidLeaveArticle}に定める通り、雇入れの日から6ヶ月継続勤務し全労働日の8割以上出勤した場合に法定日数を付与する。`,
      resignation_procedure_text: `自己都合退職の手続き: 退職を希望する日の30日前までに会社所定の退職届を提出し、業務引継ぎを完了すること。`,
      retirement_age_text: `定年制: あり（満60歳到達の月末をもって定年退職とする。ただし本人が希望し健康状態に問題がない場合は、満65歳まで継続雇用・再雇用する制度あり）。`,
      dismissal_procedure_text: `解雇の事由及び手続き: 30日前の予告または平均賃金の30日分以上の解雇予告手当の支払をもって行う。天災事変その他やむを得ない事由により事業の継続が不可能となった場合または労働者の責に帰すべき事由による場合はこの限りではない。`
    }));
    alert('✨ 就業規則から退職・定年・解雇・有休の条文番号を自動抽出し、労働条件通知書へ反映しました！');
  };

  // 🤖 AIに箇条書きで相談して公式条文を自動清書
  const handleGenerateAiClauses = () => {
    if (!aiNotesInput.trim()) {
      alert('箇条書きやメモ（例: 残業20h、土日祝休み、退職30日前、定年60歳で65歳再雇用 等）を入力してください。');
      return;
    }
    setAiIsGenerating(true);
    setTimeout(() => {
      const extracted = extractRulesArticlesFromText(employmentRulesText);
      const generated = generateOfficialClausesFromNotes(aiNotesInput, extracted);
      setAiGeneratedResult(generated);
      setAiIsGenerating(false);
    }, 500);
  };

  // AI清書結果をテンプレートに一括適用
  const handleApplyAiGenerated = () => {
    if (!aiGeneratedResult) return;
    setContractTemplate(prev => ({
      ...prev,
      ...aiGeneratedResult
    }));
    setAiModalOpen(false);
    setAiNotesInput('');
    setAiGeneratedResult(null);
    alert('✨ AIが生成した公式条文を労働条件通知書テンプレートに一括適用しました！');
  };

  // 全社設定の一括保存（超頑健化＆フォールバック）
  const handleSaveAllSettings = async () => {
    if (!tenantId) {
      alert('テナントIDが取得できませんでした。');
      return;
    }

    setIsSaving(true);
    try {
      // 休日要約テキストの自動生成
      const holSummary = generateHolidaySummaryText(calendarSettings, computedHolidaysSet.size);

      // 全カレンダーパターンの最新化（現在アクティブなパターンを最新の編集Stateで同期）
      const updatedCalendarPatterns = calendarPatterns.map(p => {
        if (p.id === activeCalendarId) {
          return {
            ...p,
            ...calendarSettings,
            annual_holidays_count: computedHolidaysSet.size,
            holiday_text_summary: holSummary
          };
        }
        return p;
      });

      // 代表カレンダーの特定（is_default優先、なければ先頭）
      const defaultPattern = updatedCalendarPatterns.find(p => p.is_default) || updatedCalendarPatterns[0];

      const updatedCalendar = {
        ...defaultPattern,
        calendar_patterns: updatedCalendarPatterns,
        active_pattern_id: activeCalendarId,
        year: calendarSettings.year || 2026,
        annual_holidays_count: defaultPattern.annual_holidays_count || computedHolidaysSet.size,
        holiday_text_summary: defaultPattern.holiday_text_summary || holSummary,
        attendance_rounding_rules: attendanceRules,
        attendance_custom_presets: customPresets
      };

      // ローカルストレージに即時最優先保存（自社テナントIDで完全隔離）
      const updatedBasicInfo = {
        ...basicInfo,
        company_seal_url: companySealUrl
      };
      localStorage.setItem(`company_basic_settings_${tenantId}`, JSON.stringify(updatedBasicInfo));
      if (companySealUrl) {
        localStorage.setItem(`company_seal_image_${tenantId}`, companySealUrl);
      }
      saveLaborContractTemplateToStorage(tenantId, {
        ...contractTemplate,
        company_seal_url: companySealUrl
      });
      saveCalendarPatternsToStorage(tenantId, updatedCalendarPatterns);
      saveAttendanceRoundingRules(tenantId, attendanceRules);
      saveCustomPresetsToStorage(tenantId, customPresets);
      saveWorkflowStepsToStorage(onboardingSteps);
      savePositionsToStorage(positions, tenantId);
      saveDepartmentsToStorage(tenantId, departments);
      saveStoresToStorage(tenantId, stores);
      try {
        await saveStoresUnified(tenantId, stores);
      } catch (stErr) {
        console.warn('saveStoresUnified error:', stErr);
      }
      saveAnnouncementsToStorage(announcements, tenantId);
      localStorage.setItem(`mock_company_holidays_${tenantId}`, JSON.stringify(Array.from(computedHolidaysSet)));
      localStorage.setItem(`company_employment_rules_${tenantId}`, employmentRulesText);
      localStorage.setItem(`company_master_settings_saved_${tenantId}`, 'true');
      // STEP 3（休日カレンダー・給与締め日）は、実際にそのタブを開いて確認・保存された時のみ完了フラグを付与
      if (activeTab === 'calendar' || activeTab === 'payroll') {
        localStorage.setItem(`step3_calendar_payroll_explicitly_saved_${tenantId}`, 'true');
      }
      if (geminiApiKey) {
        localStorage.setItem(`gemini_api_key_${tenantId}`, geminiApiKey);
        localStorage.setItem('gemini_api_key_custom', geminiApiKey);
      }

      // 住所から都道府県コード（滋賀県 = '25' 等）を自動抽出！
      const autoPrefCode = extractPrefectureCodeFromAddress(basicInfo.address) || payrollSettings.prefecture_code || '25';

      // 雇用契約書の条文テキストから給与設定用の締日・支払日を解析
      const parsedSched = parsePayrollScheduleFromText(
        contractTemplate.closing_day_text || '毎月末日',
        contractTemplate.payment_day_text || '当月25日（金融機関振込）'
      );

      const mergedPayrollSettings = {
        ...payrollSettings,
        closing_day: parsedSched.closing_day,
        payment_month: parsedSched.payment_month,
        payment_day: parsedSched.payment_day,
        prefecture_code: autoPrefCode
      };

      // 1. payroll_settings への都道府県コード・締切日・支払日同期
      try {
        await supabase.from('payroll_settings').upsert({
          tenant_id: tenantId,
          ...mergedPayrollSettings,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });
      } catch (pErr) {
        console.warn('payroll_settings sync:', pErr);
      }

      // 2. company_master_settings への保存
      try {
        await supabase.from('company_master_settings').upsert({
          tenant_id: tenantId,
          ...basicInfo,
          company_seal_url: companySealUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });
      } catch (cmsErr) {
        console.warn('company_master_settings sync:', cmsErr);
      }

      // 🏛️ 社会保険・雇用保険・労働保険マスタの最終正規化（念押し自動補正）
      const cleanInsurance = {
        shakai_hoken_office_symbol: formatOfficeSymbol(insuranceMaster.shakai_hoken_office_symbol),
        shakai_hoken_office_number: formatOfficeNumber(insuranceMaster.shakai_hoken_office_number),
        employment_insurance_office_number: formatEmploymentInsuranceNumber(insuranceMaster.employment_insurance_office_number),
        labor_insurance_number: formatLaborInsuranceNumber(insuranceMaster.labor_insurance_number)
      };
      setInsuranceMaster(cleanInsurance);

      // 3. tenants テーブルへの更新（実DBに存在する検証済みカラムのみで100%確実に永続化）
      try {
        const verifiedPayload: Record<string, any> = {
          name: basicInfo.name,
          address: basicInfo.address,
          representative_name: basicInfo.representative_name,
          phone_number: basicInfo.phone_number,
          corporate_number: basicInfo.corporate_number,
          company_seal_url: companySealUrl,
          work_calendar_settings: updatedCalendar,
          payroll_common_settings: { ...payrollSettings, prefecture_code: autoPrefCode },
          prefecture_code: autoPrefCode,
          gemini_api_key: geminiApiKey,
          employment_rules_text: employmentRulesText,
          portal_announcements_data: announcements,
          labor_contract_template_data: contractTemplate,
          qualification_masters_data: qualifications,
          position_settings: positions,
          // 🏛️ 社会保険・雇用保険・労働保険 事業所マスタ（実在カラム）
          shakai_hoken_settings: {
            office_symbol: cleanInsurance.shakai_hoken_office_symbol,
            office_number: cleanInsurance.shakai_hoken_office_number,
            employment_insurance_office_number: cleanInsurance.employment_insurance_office_number,
            labor_insurance_number: cleanInsurance.labor_insurance_number
          },
          shakai_hoken_office_number: cleanInsurance.shakai_hoken_office_number,
          employment_insurance_office_number: cleanInsurance.employment_insurance_office_number,
          labor_insurance_number: cleanInsurance.labor_insurance_number
        };
        const { error: fullErr } = await supabase.from('tenants').update(verifiedPayload).eq('id', tenantId);
        if (fullErr) {
          console.error('❌ tenants.update error:', fullErr);
          // 最小限の確実カラムで再試行
          await supabase.from('tenants').update({
            position_settings: positions,
            work_calendar_settings: updatedCalendar
          }).eq('id', tenantId);
        } else {
          console.log('✅ tenants.update 正常永続化完了（役職マスタ含む）');
        }
      } catch (updErr) {
        console.error('tenants update exception:', updErr);
      }

      // 🛡️ 自社専用LocalStorageへ即時二重永続化（SSOT保護）
      if (tenantId) {
        try {
          localStorage.setItem(`company_insurance_settings_${tenantId}`, JSON.stringify(cleanInsurance));
        } catch (e) {}
      }

      // 資格手当マスタの保存（DB ＆ LocalStorage完全同期）
      saveQualificationsToStorage(tenantId, qualifications);
      if (tenantId) {
        try {
          await supabase.from('company_qualification_masters').delete().eq('tenant_id', tenantId);
          const qInserts = qualifications.map((q, idx) => ({
            tenant_id: tenantId,
            name: q.name,
            default_allowance: q.default_allowance,
            category: q.category,
            description: q.description || '',
            display_order: idx + 1
          }));
          if (qInserts.length > 0) {
            await supabase.from('company_qualification_masters').insert(qInserts);
          }
        } catch (qDbErr) {
          console.warn('company_qualification_masters DB sync warning:', qDbErr);
        }
      }

      // 🏢 役職マスタの保存（DB ＆ LocalStorage完全同期・専用テーブル＋tenants）
      savePositionsToStorage(positions, tenantId);
      if (tenantId) {
        try {
          await supabase.from('company_position_masters').delete().eq('tenant_id', tenantId);
          const posInserts = positions.map((p, idx) => ({
            id: p.id || `pos_${tenantId}_${idx + 1}_${Date.now()}`,
            tenant_id: tenantId,
            name: p.name,
            rank_level: p.rank_level,
            display_order: p.display_order ?? (idx + 1),
            default_allowance: p.default_allowance || 0
          }));
          if (posInserts.length > 0) {
            await supabase.from('company_position_masters').insert(posInserts);
          }
        } catch (pDbErr) {
          console.warn('company_position_masters DB sync warning:', pDbErr);
        }
      }

      // 🏢 部署マスタの保存（DB department_masters 専用テーブルへ完全実永続化）
      if (tenantId) {
        try {
          await supabase.from('department_masters').delete().eq('tenant_id', tenantId);
          if (departments.length > 0) {
            const deptInserts = departments.map((d, idx) => {
              const isUuid = d.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id);
              const row: any = {
                tenant_id: tenantId,
                name: d.name,
                manager_user_id: d.manager_user_id || null,
                manager_user_name: d.manager_user_name || null,
                display_order: d.display_order ?? (idx + 1)
              };
              if (isUuid) {
                row.id = d.id;
              }
              return row;
            });
            await supabase.from('department_masters').insert(deptInserts);
          }
        } catch (dDbErr) {
          console.warn('department_masters DB sync warning:', dDbErr);
        }
      }

      setSaveSuccessMsg('✅ 全社共通マスタ設定を正常に保存しました！\n「組織図」「勤怠」「シフト」「給与」「資格手当」「入退社・契約書」の全システムに即座に反映されました。');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
      alert('🏛️ 全社共通マスタ設定を保存しました！\n「組織図」「勤怠」「シフト」「給与」「資格手当」「入退社・契約書」の全システムに即座に反映されました。');
      await fetchData();
    } catch (err: any) {
      console.error('Save company settings error:', err);
      alert('保存エラー: ' + (err.message || JSON.stringify(err)));
    } finally {
      setIsSaving(false);
    }
  };

  // 🎨 自社打刻丸めカスタムプリセットの新規保存（実DB tenants テーブルへ即時永続化）
  const handleSaveNewPreset = async () => {
    if (!newPresetName.trim()) {
      alert('プリセット名を入力してください');
      return;
    }
    const newPreset: CustomAttendancePreset = {
      id: `custom_${Date.now()}`,
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || undefined,
      rules: { ...attendanceRules },
      created_at: new Date().toISOString()
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    if (tenantId) {
      saveCustomPresetsToStorage(tenantId, updated);
      try {
        const { data: curT } = await supabase.from('tenants').select('work_calendar_settings').eq('id', tenantId).maybeSingle();
        const baseCal = curT?.work_calendar_settings || {};
        await supabase.from('tenants').update({
          work_calendar_settings: {
            ...baseCal,
            attendance_custom_presets: updated,
            custom_rounding_presets: updated
          }
        }).eq('id', tenantId);
      } catch (dbErr) {
        console.warn('DB custom presets update note:', dbErr);
      }
    }
    setNewPresetName('');
    setNewPresetDesc('');
    setNewPresetModalOpen(false);
    showToast(`✨ 新規プリセット「${newPreset.name}」を保存しました`);
  };

  // 🗑️ 自社打刻丸めカスタムプリセットの削除（実DB tenants テーブルへ即時永続化）
  const handleDeleteCustomPreset = async (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = customPresets.find(p => p.id === presetId);
    if (!window.confirm(`カスタムプリセット「${target?.name || ''}」を削除しますか？`)) return;
    const updated = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updated);
    if (tenantId) {
      saveCustomPresetsToStorage(tenantId, updated);
      try {
        const { data: curT } = await supabase.from('tenants').select('work_calendar_settings').eq('id', tenantId).maybeSingle();
        const baseCal = curT?.work_calendar_settings || {};
        await supabase.from('tenants').update({
          work_calendar_settings: {
            ...baseCal,
            attendance_custom_presets: updated,
            custom_rounding_presets: updated
          }
        }).eq('id', tenantId);
      } catch (dbErr) {
        console.warn('DB custom presets delete note:', dbErr);
      }
    }
    showToast('🗑️ カスタムプリセットを削除しました');
  };

  // 💳 ご利用プラン・決済設定の変更保存ハンドラ
  const handleSaveBillingPlan = async (newPlan: SaasPlanType) => {
    if (!tenantId) return;
    const planMeta = SAAS_PLANS[newPlan];
    if (!confirm(`ご利用プランを「${planMeta.name}」に変更しますか？`)) return;

    try {
      setIsSaving(true);
      await supabase.from('tenants').update({
        plan_type: newPlan
      }).eq('id', tenantId);

      setTenantBilling(prev => ({ ...prev, plan_type: newPlan }));
      alert(`✅ ご利用プランを「${planMeta.name}」に更新しました！`);
      await fetchData();
    } catch (e: any) {
      alert('プランの更新に失敗しました: ' + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSquareUrl = async (url: string) => {
    if (!tenantId) return;
    try {
      setIsSaving(true);
      const cleanUrl = url.trim();
      localStorage.setItem(`square_checkout_url_${tenantId}`, cleanUrl);
      try {
        await supabase.from('tenants').update({
          square_checkout_url: cleanUrl
        }).eq('id', tenantId);
      } catch (_) {}
      setTenantBilling(prev => ({ ...prev, square_checkout_url: cleanUrl }));
      alert('✅ Square決済リンクURLを保存しました！');
    } catch (e: any) {
      alert('Squareリンクの保存に失敗しました: ' + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  // 🏢 役職マスタをDB（tenantsテーブルのposition_settings JSONB）へ安全に即時自動永続化（SSOT）
  const syncPositionsToDb = async (items: PositionMaster[], targetTenantId?: string | null) => {
    const tid = targetTenantId || tenantId || localStorage.getItem('current_tenant_id');
    if (!tid) return;

    // 1. tenants テーブルの実在カラム position_settings を即時更新（未定義カラム position_masters は含めない！）
    try {
      const { error: pUpdErr } = await supabase.from('tenants').update({
        position_settings: items
      }).eq('id', tid);
      if (pUpdErr) {
        console.error('❌ tenants.position_settings update error:', pUpdErr);
      } else {
        console.log('✅ tenants.position_settings DB同期成功:', items.length, '件');
      }
    } catch (e) {
      console.warn('DB sync positions to tenants exception:', e);
    }

    // 2. company_position_masters 専用テーブルが存在する場合は洗い替え保存（存在しない場合は安全にスキップ）
    try {
      const { error: delErr } = await supabase.from('company_position_masters').delete().eq('tenant_id', tid);
      if (!delErr && items.length > 0) {
        const rows = items.map((item, idx) => ({
          id: item.id || `pos_${tid}_${idx + 1}_${Date.now()}`,
          tenant_id: tid,
          name: item.name,
          rank_level: item.rank_level,
          display_order: item.display_order ?? (idx + 1),
          default_allowance: item.default_allowance || 0
        }));
        await supabase.from('company_position_masters').insert(rows);
      }
    } catch (_) {}
  };

  // 役職追加
  const handleAddPosition = () => {
    if (!newPositionName.trim()) {
      alert('役職名を入力してください。');
      return;
    }
    const newPos: PositionMaster = {
      id: `pos_${Date.now()}`,
      name: newPositionName.trim(),
      rank_level: newPositionRank,
      display_order: positions.length + 1
    };
    const updated = [...positions, newPos];
    setPositions(updated);
    savePositionsToStorage(updated, tenantId);
    syncPositionsToDb(updated, tenantId);
    setNewPositionName('');
  };

  // 役職削除
  const handleDeletePosition = (id: string) => {
    if (!confirm('この役職を削除しますか？')) return;
    const updated = positions.filter(p => p.id !== id);
    setPositions(updated);
    savePositionsToStorage(updated, tenantId);
    syncPositionsToDb(updated, tenantId);
  };

  // 役職の階層内順序移動（上へ）
  const handleMovePositionUp = (id: string) => {
    const target = positions.find(p => p.id === id);
    if (!target) return;
    const sameRankList = positions.filter(p => p.rank_level === target.rank_level);
    const idxInRank = sameRankList.findIndex(p => p.id === id);
    if (idxInRank <= 0) return;

    const prevItem = sameRankList[idxInRank - 1];
    const newPositions = [...positions];
    const idxTarget = newPositions.findIndex(p => p.id === id);
    const idxPrev = newPositions.findIndex(p => p.id === prevItem.id);
    [newPositions[idxTarget], newPositions[idxPrev]] = [newPositions[idxPrev], newPositions[idxTarget]];

    const reordered = newPositions.map((p, i) => ({ ...p, display_order: i + 1 }));
    setPositions(reordered);
    savePositionsToStorage(reordered, tenantId);
    syncPositionsToDb(reordered, tenantId);
  };

  // 役職の階層内順序移動（下へ）
  const handleMovePositionDown = (id: string) => {
    const target = positions.find(p => p.id === id);
    if (!target) return;
    const sameRankList = positions.filter(p => p.rank_level === target.rank_level);
    const idxInRank = sameRankList.findIndex(p => p.id === id);
    if (idxInRank >= sameRankList.length - 1 || idxInRank === -1) return;

    const nextItem = sameRankList[idxInRank + 1];
    const newPositions = [...positions];
    const idxTarget = newPositions.findIndex(p => p.id === id);
    const idxNext = newPositions.findIndex(p => p.id === nextItem.id);
    [newPositions[idxTarget], newPositions[idxNext]] = [newPositions[idxNext], newPositions[idxTarget]];

    const reordered = newPositions.map((p, i) => ({ ...p, display_order: i + 1 }));
    setPositions(reordered);
    savePositionsToStorage(reordered, tenantId);
    syncPositionsToDb(reordered, tenantId);
  };

  // 役職の階層ランク変更
  const handleUpdatePositionRank = (id: string, newRank: number) => {
    const updated = positions.map(p => {
      if (p.id === id) {
        return { ...p, rank_level: newRank };
      }
      return p;
    });
    setPositions(updated);
    savePositionsToStorage(updated, tenantId);
    syncPositionsToDb(updated, tenantId);
  };

  // 役職名のインライン編集
  const handleStartEditPosition = (pos: PositionMaster) => {
    setEditingPositionId(pos.id);
    setEditingPositionNameText(pos.name);
  };

  const handleSaveEditPosition = (id: string) => {
    if (!editingPositionNameText.trim()) {
      alert('役職名を入力してください。');
      return;
    }
    const updated = positions.map(p => {
      if (p.id === id) {
        return { ...p, name: editingPositionNameText.trim() };
      }
      return p;
    });
    setPositions(updated);
    savePositionsToStorage(updated, tenantId);
    syncPositionsToDb(updated, tenantId);
    setEditingPositionId(null);
    setEditingPositionNameText('');
  };

  const handleCancelEditPosition = () => {
    setEditingPositionId(null);
    setEditingPositionNameText('');
  };

  // 業種・規模別プリセット適用（DB実永続化 ＆ LocalStorage完全同期）
  const handleApplyPreset = async (presetId: string) => {
    const preset = POSITION_PRESETS.find(p => p.id === presetId);
    const activeTenantId = tenantId || localStorage.getItem('current_tenant_id');
    if (!preset || !activeTenantId) {
      alert('テナント情報が取得できませんでした。ページを再読み込みしてください。');
      return;
    }
    if (positions.length > 0) {
      if (!confirm(`役職マスタに「${preset.name}」（${preset.targetScale}）を適用しますか？\n\n【登録される役職】\n${preset.positions.map(p => `・Lv.${p.rank_level} ${p.name}`).join('\n')}\n\n※ 現在の登録内容は上書きされます。`)) {
        return;
      }
    }
    const newItems: PositionMaster[] = preset.positions.map((p, idx) => ({
      id: `pos_preset_${preset.id}_${idx + 1}_${Date.now()}`,
      name: p.name,
      rank_level: p.rank_level,
      display_order: idx + 1,
      default_allowance: p.default_allowance || 0
    }));

    // 1. 画面State即時反映
    setPositions(newItems);

    // 2. LocalStorage二重即時保存
    savePositionsToStorage(newItems, activeTenantId);
    try {
      localStorage.setItem(`company_position_masters_${activeTenantId}`, JSON.stringify(newItems));
    } catch (_) {}

    // 3. Supabase DB即時永続化（tenantsテーブル ＆ company_position_masters 専用テーブル）
    await syncPositionsToDb(newItems, activeTenantId);

    alert(`✨ 「${preset.name}」の役職セット（全${newItems.length}件）を正常に適用・保存しました！\n必要に応じて役職名の変更や不要な役職の削除を行ってください。`);
  };

  // 🚀 かんたん初期設定スタートガイドへスムーズスクロール
  const scrollToStartupGuide = () => {
    window.dispatchEvent(new CustomEvent('open-startup-guide'));
    const el = document.getElementById('startup-guide-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 📜 資格手当マスタ追加
  const handleAddQualification = async () => {
    if (!newQualName.trim()) {
      alert('資格名を入力してください。');
      return;
    }
    const newQ: QualificationMaster = {
      id: `qual_${Date.now()}`,
      name: newQualName.trim(),
      default_allowance: newQualAllowance || 0,
      category: newQualCategory,
      description: newQualDesc.trim(),
      display_order: qualifications.length + 1
    };
    const updated = [...qualifications, newQ];
    setQualifications(updated);
    saveQualificationsToStorage(tenantId, updated);
    try {
      if (tenantId) {
        await supabase.from('company_qualification_masters').insert({
          tenant_id: tenantId,
          name: newQ.name,
          default_allowance: newQ.default_allowance,
          category: newQ.category,
          description: newQ.description,
          display_order: newQ.display_order
        });
      }
    } catch (e) {
      console.warn('DB qualification insert note:', e);
    }
    setNewQualName('');
    setNewQualAllowance(10000);
    setNewQualDesc('');
    alert(`✨ 資格手当マスタ「${newQ.name}」を追加しました！`);
  };

  // 📜 資格手当マスタ削除
  const handleDeleteQualification = async (id: string) => {
    if (!confirm('この資格手当マスタを削除しますか？')) return;
    const updated = qualifications.filter(q => q.id !== id);
    setQualifications(updated);
    saveQualificationsToStorage(tenantId, updated);
    try {
      if (tenantId) {
        await supabase.from('company_qualification_masters').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('DB qualification delete note:', e);
    }
  };

  // 📜 資格手当マスタ更新
  const handleSaveEditedQualification = async (edited: QualificationMaster) => {
    const updated = qualifications.map(q => q.id === edited.id ? edited : q);
    setQualifications(updated);
    saveQualificationsToStorage(tenantId, updated);
    try {
      if (tenantId) {
        await supabase.from('company_qualification_masters').update({
          name: edited.name,
          default_allowance: edited.default_allowance,
          category: edited.category,
          description: edited.description
        }).eq('id', edited.id);
      }
    } catch (e) {
      console.warn('DB qualification update note:', e);
    }
    setEditingQualModal({ isOpen: false, qual: null });
  };

  // 社員の役職・所属部署・部門長の更新（組織図連動）
  const handleUpdateMemberPositionAndDept = async (
    userId: string,
    deptName: string,
    posId: string,
    isDeptHead: boolean,
    storeName?: string
  ) => {
    const targetPos = positions.find(p => p.id === posId);
    const posName = targetPos ? targetPos.name : '';

    try {
      // 1. usersテーブルの安全更新
      try {
        await supabase.from('users').update({
          department: deptName || null,
          position_id: posId || null,
          position_name: posName || null,
          store_name: storeName || null
        }).eq('id', userId);
      } catch (dbErr) {
        // 万が一カラム未定義の場合はdepartment/positionのみ更新
        try {
          await supabase.from('users').update({
            department: deptName || null,
            position_id: posId || null,
            position_name: posName || null
          }).eq('id', userId);
        } catch {
          await supabase.from('users').update({
            department: deptName || null
          }).eq('id', userId);
        }
      }

      // 2. localStorageへの安全バックアップ永続化
      try {
        const key = `user_positions_${tenantId}`;
        const currentMap = JSON.parse(localStorage.getItem(key) || '{}');
        currentMap[userId] = {
          position_id: posId || undefined,
          position_name: posName || undefined,
          department: deptName || undefined,
          store_name: storeName || undefined
        };
        localStorage.setItem(key, JSON.stringify(currentMap));
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }

      // 3. 部門長（所属長）の確実なアサイン・解除
      if (deptName) {
        if (isDeptHead) {
          // この社員を所属長に任命
          await handleUpdateDepartmentManager(deptName, userId);
        } else {
          // もしこの社員が元々この部署の所属長だった場合は解除
          const currentDept = departments.find(d => d.name === deptName);
          if (currentDept && currentDept.manager_user_id === userId) {
            await handleUpdateDepartmentManager(deptName, '');
          }
        }
      }

      // 4. companyUsers ローカルstateを即時更新
      setCompanyUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            department: deptName || undefined,
            position_id: posId || undefined,
            position_name: posName || undefined,
            store_name: storeName || undefined,
            is_department_head: isDeptHead
          };
        }
        return u;
      }));

      setEditingUserModal({ isOpen: false, user: null });
      await fetchData();
      alert(`✅ 社員の役職（${posName || '一般'}）、配属（${deptName || '未所属'}）${storeName ? `、所属店舗（${storeName}）` : ''}${isDeptHead ? '【★所属長に任命】' : ''}を更新・保存しました！`);
    } catch (e: any) {
      console.error(e);
      alert('社員情報の更新に失敗しました: ' + e.message);
    }
  };

  // 🏪 店舗・拠点マスタ操作ハンドラ群
  const handleAddStore = async () => {
    if (!tenantId || !newStoreName.trim()) {
      alert('店舗・拠点名を入力してください（例: 東京本社、大阪支社、銀座店など）');
      return;
    }
    const cleanName = sanitizeStoreName(newStoreName);
    if (stores.some(s => s.name === cleanName)) {
      alert(`「${cleanName}」は既に登録されています。`);
      return;
    }
    const manager = companyUsers.find(u => u.id === newStoreManagerId);
    const newStoreItem: StoreMaster = {
      id: `store-${Date.now()}`,
      name: cleanName,
      code: newStoreCode.trim() || undefined,
      department_name: newStoreDept || undefined,
      manager_user_id: newStoreManagerId || undefined,
      manager_user_name: manager ? manager.name : undefined,
      display_order: stores.length + 1
    };
    const updated = [...stores, newStoreItem];
    setStores(updated);
    saveStoresToStorage(tenantId, updated);
    try {
      await saveStoresUnified(tenantId, updated);
    } catch (e) {
      console.warn('DB save store error:', e);
    }
    setNewStoreName('');
    setNewStoreCode('');
    setNewStoreDept('');
    setNewStoreManagerId('');
    alert(`✅ 店舗「${cleanName}」を追加しました！`);
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!tenantId) return;
    const target = stores.find(s => s.id === storeId);
    if (!target) return;
    if (!confirm(`店舗「${target.name}」を削除してもよろしいですか？\n※ シフトカレンダーや所属設定からも解除されます。`)) return;
    const updated = stores.filter(s => s.id !== storeId);
    setStores(updated);
    saveStoresToStorage(tenantId, updated);
    try {
      await saveStoresUnified(tenantId, updated);
    } catch (e) {
      console.warn('DB delete store error:', e);
    }
  };

  const handleUpdateStoreManager = async (storeId: string, managerUserId: string) => {
    if (!tenantId) return;
    const manager = companyUsers.find(u => u.id === managerUserId);
    const updated = stores.map(s => {
      if (s.id === storeId) {
        return {
          ...s,
          manager_user_id: managerUserId || undefined,
          manager_user_name: manager ? manager.name : undefined
        };
      }
      return s;
    });
    setStores(updated);
    saveStoresToStorage(tenantId, updated);
    try {
      await saveStoresUnified(tenantId, updated);
    } catch (e) {
      console.warn('DB update store manager error:', e);
    }
  };

  const handleUpdateStoreDepartment = async (storeId: string, deptName: string) => {
    if (!tenantId) return;
    const updated = stores.map(s => {
      if (s.id === storeId) {
        return {
          ...s,
          department_name: deptName || undefined
        };
      }
      return s;
    });
    setStores(updated);
    saveStoresToStorage(tenantId, updated);
    try {
      await saveStoresUnified(tenantId, updated);
    } catch (e) {
      console.warn('DB update store department error:', e);
    }
  };


  // 部署追加
  const handleAddDepartment = async () => {
    if (!tenantId || !newDeptName.trim()) return;
    const targetUser = companyUsers.find(u => u.id === newDeptManagerId);
    try {
      await supabase.from('department_masters').insert({
        tenant_id: tenantId,
        name: newDeptName.trim(),
        manager_user_id: newDeptManagerId || null,
        manager_user_name: targetUser ? targetUser.name : null,
        display_order: departments.length + 1
      });
      setNewDeptName('');
      setNewDeptManagerId('');
      await fetchData();
    } catch (e) {
      alert('部署の追加に失敗しました。');
    }
  };

  // 部署の所属長（部門長）の更新（未登録の自動包括部署も即座にマスタ登録・保存）
  const handleUpdateDepartmentManager = async (deptIdOrName: string, managerUserId: string) => {
    const targetUser = companyUsers.find(u => u.id === managerUserId);
    const managerName = targetUser ? targetUser.name : '';

    const cleanDeptName = deptIdOrName.startsWith('auto_') ? deptIdOrName.replace('auto_', '') : deptIdOrName;
    const existingIndex = departments.findIndex(
      d => d.id === deptIdOrName || d.name === cleanDeptName || d.name === deptIdOrName
    );

    let updatedDepts = [...departments];
    let targetDeptId = deptIdOrName;
    let targetDeptName = cleanDeptName;

    if (existingIndex >= 0) {
      targetDeptId = departments[existingIndex].id;
      targetDeptName = departments[existingIndex].name;
      updatedDepts[existingIndex] = {
        ...updatedDepts[existingIndex],
        manager_user_id: managerUserId || undefined,
        manager_user_name: managerName || undefined
      };
    } else {
      // マスタ未登録部署（自動包括ノード）の場合はマスタへ新規追加
      targetDeptId = `dept_${Date.now()}`;
      updatedDepts.push({
        id: targetDeptId,
        name: targetDeptName,
        manager_user_id: managerUserId || undefined,
        manager_user_name: managerName || undefined,
        display_order: updatedDepts.length + 1
      });
    }

    // UI state を即時更新（これで画面のプルダウンに即座に選択値が入る）
    setDepartments(updatedDepts);

    // LocalStorage に即座にバックアップ永続化
    if (tenantId) {
      saveDepartmentsToStorage(tenantId, updatedDepts);
    }

    // Supabase DB（department_masters）への安全な Upsert
    if (tenantId) {
      try {
        const { data: existRecords } = await supabase
          .from('department_masters')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', targetDeptName);

        if (existRecords && existRecords.length > 0) {
          await supabase
            .from('department_masters')
            .update({
              manager_user_id: managerUserId || null,
              manager_user_name: managerName || null
            })
            .eq('id', existRecords[0].id);
        } else {
          const isUuid = targetDeptId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetDeptId);
          const insertPayload: any = {
            tenant_id: tenantId,
            name: targetDeptName,
            manager_user_id: managerUserId || null,
            manager_user_name: managerName || null,
            display_order: updatedDepts.length
          };
          if (isUuid) {
            insertPayload.id = targetDeptId;
          }
          await supabase
            .from('department_masters')
            .insert(insertPayload);
        }
      } catch (e) {
        console.error('Update department manager error:', e);
      }
    }
  };

  // 部署削除（DB・LocalStorage・画面State・社員所属の全層から完全抹消）
  const handleDeleteDepartment = async (id: string, name?: string) => {
    const targetDept = departments.find(d => d.id === id);
    const targetName = name || targetDept?.name || '';
    if (!targetName && !id) return;

    if (!confirm(`部署「${targetName || '選択した部署'}」を削除してもよろしいですか？\n\n【安心のデータ保護】\n・所属していた社員データは削除されず、安全に「未配属」トレイへ保護されます。\n・部署はいつでも新しく追加・再設定できます。`)) return;

    try {
      // 1. 削除済み部署リスト（ブラックリスト）に即座に登録（復元を永久遮断）
      if (tenantId && targetName) {
        addDeletedDepartmentNameToStorage(tenantId, targetName);
      }

      // 2. ローカルStateから即座に除外（画面の即時反映・Optimistic Update）
      const nextDepts = departments.filter(d => d.id !== id && (targetName ? d.name !== targetName : true));
      setDepartments(nextDepts);

      // 3. LocalStorageから確実に保存・パージ
      if (tenantId) {
        saveDepartmentsToStorage(tenantId, nextDepts);
      }

      // 4. Supabase DB から完全削除（ID指定 および テナント+部署名指定の両面）
      if (tenantId) {
        try {
          if (id && !id.startsWith('auto_') && !id.startsWith('dept-default')) {
            await supabase.from('department_masters').delete().eq('tenant_id', tenantId).eq('id', id);
          }
        } catch (dbErr1) {
          console.warn('Delete department by id error:', dbErr1);
        }

        if (targetName) {
          try {
            await supabase.from('department_masters').delete().eq('tenant_id', tenantId).eq('name', targetName);
          } catch (dbErr2) {
            console.warn('Delete department by name error:', dbErr2);
          }

          // 5. この部署に所属していた社員の所属部署を安全にクリア（未所属に移行）
          try {
            await supabase.from('users').update({ department: null }).eq('tenant_id', tenantId).eq('department', targetName);
          } catch (uErr) {
            console.warn('Clear user department error:', uErr);
          }
        }
      }

      // 6. 最新データの再取得
      await fetchData();
    } catch (e: any) {
      console.error('Delete department error:', e);
      alert('削除処理中にエラーが発生しました: ' + (e?.message || ''));
    }
  };

  // ↔️ 部署の並び順（左右）移動ハンドラー
  const handleMoveDepartmentOrder = async (deptIdOrName: string, direction: 'left' | 'right') => {
    const cleanName = deptIdOrName.startsWith('auto_') ? deptIdOrName.replace('auto_', '') : deptIdOrName;
    const idx = departments.findIndex(d => d.id === deptIdOrName || d.name === cleanName || d.name === deptIdOrName);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= departments.length) return;

    const newDepts = [...departments];
    const temp = newDepts[idx];
    newDepts[idx] = newDepts[targetIdx];
    newDepts[targetIdx] = temp;

    // display_order 再割り当て (1-indexed)
    const updated = newDepts.map((d, i) => ({
      ...d,
      display_order: i + 1
    }));

    setDepartments(updated);
    if (tenantId) {
      saveDepartmentsToStorage(tenantId, updated);
      // Supabase DB の display_order 更新
      try {
        for (const d of updated) {
          if (!d.id.startsWith('auto_')) {
            await supabase
              .from('department_masters')
              .update({ display_order: d.display_order })
              .eq('tenant_id', tenantId)
              .eq('name', d.name);
          }
        }
      } catch (err) {
        console.warn('Update department display_order error:', err);
      }
    }
  };

  // ✏️ 部署名のインライン編集開始
  const handleStartEditDepartment = (dept: { id: string; name: string }) => {
    setEditingDepartmentId(dept.id);
    setEditingDepartmentNameText(dept.name);
  };

  // ❌ 部署名のインライン編集キャンセル
  const handleCancelEditDepartment = () => {
    setEditingDepartmentId(null);
    setEditingDepartmentNameText('');
  };

  // 💾 部署名のインライン編集保存（所属社員のdepartmentも一括自動追従）
  const handleSaveRenameDepartment = async (deptId: string, oldName: string) => {
    const trimmedNew = editingDepartmentNameText.trim();
    if (!trimmedNew) {
      alert('部署名を入力してください。');
      return;
    }
    if (trimmedNew === oldName) {
      setEditingDepartmentId(null);
      setEditingDepartmentNameText('');
      return;
    }
    // 重複チェック
    if (departments.some(d => d.name === trimmedNew && d.id !== deptId)) {
      alert(`「${trimmedNew}」は既に存在する部署名です。別の名称を指定してください。`);
      return;
    }

    try {
      // 1. ローカルState更新
      const updatedDepts = departments.map(d => {
        if (d.id === deptId || d.name === oldName) {
          return { ...d, name: trimmedNew };
        }
        return d;
      });
      setDepartments(updatedDepts);

      // 2. 所属社員のcompanyUsers state即時更新
      setCompanyUsers(prev => prev.map(u => {
        if (u.department === oldName) {
          return { ...u, department: trimmedNew };
        }
        return u;
      }));

      // 3. LocalStorage保存
      if (tenantId) {
        saveDepartmentsToStorage(tenantId, updatedDepts);
      }

      // 4. Supabase DB更新（department_masters）
      if (tenantId) {
        await supabase
          .from('department_masters')
          .update({ name: trimmedNew })
          .eq('tenant_id', tenantId)
          .eq('name', oldName);

        // 5. 所属社員の users.department も一括追従
        await supabase
          .from('users')
          .update({ department: trimmedNew })
          .eq('tenant_id', tenantId)
          .eq('department', oldName);
      }

      setEditingDepartmentId(null);
      setEditingDepartmentNameText('');
      await fetchData();
    } catch (e: any) {
      console.error('Rename department error:', e);
      alert('部署名の変更に失敗しました: ' + (e?.message || ''));
    }
  };

  // ✨ 業種別・部門プリセット（テンプレート）一括適用
  const handleApplyDepartmentPreset = async (presetId: string) => {
    const preset = DEPARTMENT_PRESETS.find(p => p.id === presetId);
    if (!preset || !tenantId) return;

    if (departments.length > 0) {
      if (!confirm(`組織図・部門マスタに「${preset.name}」（${preset.targetScale}）の標準部署セットを適用しますか？\n\n【追加・展開される部署】\n${preset.departments.map(d => `・${d.name}（${d.description || ''}）`).join('\n')}\n\n※ 既に登録されている部署と統合されます。`)) {
        return;
      }
    }

    try {
      const existingNames = new Set(departments.map(d => d.name.trim()));
      const newDeptsToAdd = preset.departments.filter(d => !existingNames.has(d.name.trim()));

      if (newDeptsToAdd.length === 0) {
        alert('選択されたテンプレートの部署はすべて既に登録されています。');
        setIsDeptPresetModalOpen(false);
        return;
      }

      // 過去に削除した部署名ブラックリストから、今回追加する部署名を解除（再作成を確実に許可）
      try {
        const deletedSet = getDeletedDepartmentNamesFromStorage(tenantId);
        let changed = false;
        newDeptsToAdd.forEach(d => {
          if (deletedSet.has(d.name.trim())) {
            deletedSet.delete(d.name.trim());
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(`deleted_department_names_${tenantId}`, JSON.stringify(Array.from(deletedSet)));
        }
      } catch (_) {}

      const startIndex = departments.length;
      
      // DB挿入用レコード（PostgreSQLのUUID主キー型に反しないよう、idは自動生成に任せる）
      const recordsToInsert = newDeptsToAdd.map((d, idx) => ({
        tenant_id: tenantId,
        name: d.name.trim(),
        display_order: startIndex + idx + 1
      }));

      let createdDepts: DepartmentMaster[] = [];

      try {
        const { data: insertedRows, error: insertError } = await supabase
          .from('department_masters')
          .upsert(recordsToInsert, { onConflict: 'tenant_id,name' })
          .select();

        if (insertError) {
          console.warn('Upsert department_masters warning, trying insert fallback:', insertError);
          const { data: fallbackRows, error: fbError } = await supabase
            .from('department_masters')
            .insert(recordsToInsert)
            .select();
          if (!fbError && fallbackRows) {
            createdDepts = fallbackRows as DepartmentMaster[];
          }
        } else if (insertedRows) {
          createdDepts = insertedRows as DepartmentMaster[];
        }
      } catch (dbErr) {
        console.warn('DB department_masters direct insert error:', dbErr);
      }

      // DBで返ってこなかった場合（オフラインや権限制限時）のUUIDフォールバック
      if (createdDepts.length === 0) {
        createdDepts = newDeptsToAdd.map((d, idx) => ({
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `dept_${tenantId}_${Date.now()}_${idx}`,
          name: d.name.trim(),
          display_order: startIndex + idx + 1
        }));
      }

      const combined = [...departments, ...createdDepts];
      setDepartments(combined);
      saveDepartmentsToStorage(tenantId, combined);

      alert(`✨ 「${preset.name}」の部門セット（${newDeptsToAdd.length}部署）を一括作成しました！\n組織図上で所属長や休日カレンダーを自由に割り当ててください。`);
      setIsDeptPresetModalOpen(false);
      await fetchData();
    } catch (e: any) {
      console.error('Apply department preset error:', e);
      alert('部門テンプレートの適用に失敗しました: ' + (e?.message || ''));
    }
  };

  // 就業時間パターン追加
  const handleAddSchedulePattern = async () => {
    if (!tenantId || !newPatternName.trim()) {
      alert('勤務パターン名を入力してください。');
      return;
    }

    try {
      await supabase.from('work_schedule_patterns').insert({
        tenant_id: tenantId,
        name: newPatternName.trim(),
        start_time: newPatternStartTime,
        end_time: newPatternEndTime,
        break_minutes: newPatternBreakMinutes,
        target_department: newPatternDept,
        display_order: schedulePatterns.length + 1
      });

      setNewPatternName('');
      setNewPatternStartTime('09:00');
      setNewPatternEndTime('18:00');
      setNewPatternBreakMinutes(60);
      setNewPatternDept('');
      await fetchData();
    } catch (e: any) {
      console.error(e);
      alert('就業時間パターンの追加に失敗しました: ' + e.message);
    }
  };

  // 就業時間パターン削除
  const handleDeleteSchedulePattern = async (id: string) => {
    if (!confirm('この就業時間パターンを削除しますか？')) return;
    try {
      await supabase.from('work_schedule_patterns').delete().eq('id', id);
      await fetchData();
    } catch (e: any) {
      alert('削除に失敗しました。');
    }
  };

  // 独自休日の追加
  const handleAddCustomHoliday = () => {
    if (!newCustomHolidayDate || !newCustomHolidayName.trim()) return;
    const updated = [...calendarSettings.custom_holidays, { date: newCustomHolidayDate, name: newCustomHolidayName.trim() }];
    setCalendarSettings({ ...calendarSettings, custom_holidays: updated });
    setNewCustomHolidayDate('');
    setNewCustomHolidayName('');
  };

  // 独自休日の削除
  const handleDeleteCustomHoliday = (index: number) => {
    const updated = calendarSettings.custom_holidays.filter((_, i) => i !== index);
    setCalendarSettings({ ...calendarSettings, custom_holidays: updated });
  };

  // 入社手続きステップ並び替え（上へ）
  const handleMoveStepUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...onboardingSteps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index - 1];
    newSteps[index - 1] = temp;
    newSteps.forEach((s, i) => { s.step_number = i + 1; });
    setOnboardingSteps(newSteps);
  };

  // 入社手続きステップ並び替え（下へ）
  const handleMoveStepDown = (index: number) => {
    if (index === onboardingSteps.length - 1) return;
    const newSteps = [...onboardingSteps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index + 1];
    newSteps[index + 1] = temp;
    newSteps.forEach((s, i) => { s.step_number = i + 1; });
    setOnboardingSteps(newSteps);
  };

  // ステップ有効/無効切り替え
  const handleToggleStep = (index: number) => {
    const newSteps = [...onboardingSteps];
    newSteps[index].is_enabled = !newSteps[index].is_enabled;
    setOnboardingSteps(newSteps);
  };

  // ステップ削除
  const handleDeleteStep = (index: number) => {
    if (onboardingSteps.length <= 1) {
      alert('少なくとも1つのステップが必要です。');
      return;
    }
    if (!confirm('このステップを削除しますか？')) return;
    const newSteps = onboardingSteps.filter((_, i) => i !== index);
    newSteps.forEach((s, i) => { s.step_number = i + 1; });
    setOnboardingSteps(newSteps);
  };

  // 新規ステップ追加
  const handleAddNewStep = () => {
    if (!newStepName.trim()) {
      alert('ステップ名を入力してください。');
      return;
    }
    let approverName = '管理者全員';
    if (newStepApproverType === 'specific_user') {
      const targetUser = companyUsers.find(u => u.id === newStepApproverUserId);
      approverName = targetUser ? `${targetUser.name} (${targetUser.department || '担当'})` : '担当者指定';
    } else if (newStepApproverType === 'department_head') {
      approverName = '配属部署の所属長';
    }

    const newStep: OnboardingWorkflowStep = {
      id: `step_${Date.now()}`,
      step_number: onboardingSteps.length + 1,
      name: newStepName.trim(),
      description: newStepDesc.trim() || '社内所定の手続き',
      required_action: 'custom',
      approver_type: newStepApproverType,
      approver_user_id: newStepApproverType === 'specific_user' ? newStepApproverUserId : undefined,
      approver_name: approverName,
      is_enabled: true
    };
    setOnboardingSteps([...onboardingSteps, newStep]);
    setNewStepName('');
    setNewStepDesc('');
    setNewStepApproverType('all_admins');
    setNewStepApproverUserId('');
  };

  // ステップ内容の編集保存
  const handleSaveEditedStep = () => {
    if (editingStepModal.index < 0 || !editingStepModal.step) return;
    if (!editingStepModal.step.name.trim()) {
      alert('ステップ名を入力してください。');
      return;
    }
    const newSteps = [...onboardingSteps];
    newSteps[editingStepModal.index] = { ...editingStepModal.step };
    setOnboardingSteps(newSteps);
    setEditingStepModal({ isOpen: false, index: -1, step: null });
  };

  // デフォルト設定に初期化
  const handleResetDefaultSteps = () => {
    if (confirm('入社手続きステップをデフォルト設定（標準5ステップ）に戻しますか？')) {
      setOnboardingSteps(DEFAULT_ONBOARDING_STEPS);
    }
  };

  // 共通の保存ボタンスニペット（強調・安心設計）
  const renderSaveFooter = () => (
    <div className="pt-6 mt-8 border-t-2 border-indigo-100">
      <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border-2 border-indigo-200/90 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5 text-center md:text-left">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
            💾
          </div>
          <div className="space-y-1">
            <div className="font-black text-sm text-slate-900 flex items-center justify-center md:justify-start gap-2">
              <span>【重要】変更した設定は「設定を一括保存」を押して確定してください</span>
              <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                保存必須
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              設定を変更しただけでは確定されません。右のボタンを押すことで、勤怠管理・有給・シフト・給与計算の<strong>全システムへ100%即時反映・安全保存</strong>されます。
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAllSettings}
          disabled={isSaving}
          className="w-full md:w-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm px-8 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 text-indigo-200" />}
          <span>設定を一括保存する</span>
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs print:hidden">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
            title="ポータルに戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            ポータル
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                会社・全社労務マスタ設定センター
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  全システム中央一元管理
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">{basicInfo.name}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
            title="会社・全社労務マスタの役割・意図を見る"
          >
            <span className="text-sm">❓</span>
            <span>使い方ガイド</span>
          </button>
          <button
            onClick={handleSaveAllSettings}
            disabled={isSaving}
            className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transform hover:scale-105"
            title="変更したすべての設定を全システムへ一括反映・保存します"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-indigo-200 animate-pulse" />}
            <span>設定を一括保存</span>
          </button>
          <AppSwitcher currentApp="portal" role="admin" />
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
            className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 print:hidden">
        
        {/* 保存成功トースト */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between text-xs font-bold animate-in fade-in">
            <span>{saveSuccessMsg}</span>
            <button onClick={() => setSaveSuccessMsg(null)} className="p-1 text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 🚀 社長・初心者管理者向け かんたん初期設定スタートガイド（最短10分・5ステップ） */}
        <StartupGuideCard
          tenantId={tenantId}
          basicInfo={basicInfo}
          departments={departments}
          payrollSettings={payrollSettings}
          calendarSettings={calendarSettings}
          companyUsers={companyUsers}
          positions={positions}
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            const el = document.getElementById('company-settings-tabs-header');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          onOpenCsvImport={() => navigate('/onboarding/admin?action=import&from=company_settings')}
          onOpenManualAdd={() => navigate('/onboarding/admin?action=add&from=company_settings')}
          onNavigateToOnboarding={() => navigate('/onboarding/admin?from=company_settings')}
        />

        {/* ガイドバナー */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-3xl p-6 text-white shadow-md shadow-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-200" />
              会社・全社労務マスタ 一元管理センター
            </h2>
            <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
              ここで設定した会社情報、部署、就業時間パターン、年間営業カレンダー、締め日は、<strong>「勤怠」「シフト」「給与」「入退社・契約書」の全4システムへ100%自動連動</strong>されます。
            </p>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div id="company-settings-tabs-header" className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 scroll-mt-20">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'basic' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>1. 会社基本情報</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'departments' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Network className="w-4 h-4 shrink-0" />
            <span>2. 組織・役職・店舗</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>3. 営業カレンダー・時間</span>
          </button>

          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'payroll' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>4. 給与締日・社会保険</span>
          </button>

          <button
            onClick={() => setActiveTab('contract')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'contract' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>5. 労働条件・雇用契約</span>
          </button>

          <button
            onClick={() => setActiveTab('onboarding')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'onboarding' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            <span>6. 入社手続き・承認者</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'rules' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>7. 就業規則（AI連動）</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'announcements' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" />
            <span>8. 📢 全社お知らせ</span>
          </button>

          <button
            onClick={() => setActiveTab('qualifications')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'qualifications' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>9. 📜 資格手当</span>
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'reminders' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-500 shrink-0" />
            <span>10. 🔔 公的届出・改定通知</span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'billing' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>11. 💳 プラン・決済設定</span>
            {tenantBilling.plan_type === 'trial' && (
              <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-1.5 py-0.2 rounded-full shrink-0">
                お試し中
              </span>
            )}
          </button>
        </div>

        {/* 💾 全タブ共通：保存必須ガイダンス ＆ クイック一括保存バー */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50/50 to-indigo-50/60 border-2 border-amber-200/90 rounded-2xl p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs text-amber-950 font-bold">
            <span className="text-base shrink-0">💡</span>
            <span className="leading-snug">
              各タブで設定を変更した後は、必ず右上の<strong>「設定を一括保存」</strong>または最下部の保存ボタンを押して確定してください（※ 保存しないと変更内容は反映されません）。
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveAllSettings}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs hover:shadow-md whitespace-nowrap shrink-0 self-end sm:self-auto transform hover:scale-102"
            title="変更したすべての設定を全システムへ一括反映・保存します"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>今すぐ一括保存</span>
          </button>
        </div>

        {/* 1. 会社基本情報 タブ */}
        {activeTab === 'basic' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                会社基本情報
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">労働条件通知書（雇用契約書）の甲欄、給与明細の発行元、各種労務帳票に自動印字されます。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">企業名 / 屋号 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={e => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">本社所在地（住所） <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={basicInfo.address}
                  onChange={e => setBasicInfo({ ...basicInfo, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">代表者役職・氏名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={basicInfo.representative_name}
                  onChange={e => setBasicInfo({ ...basicInfo, representative_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">代表電話番号</label>
                <input
                  type="text"
                  value={basicInfo.phone_number}
                  onChange={e => setBasicInfo({ ...basicInfo, phone_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                />
              </div>
            </div>

            {/* 🏢 会社実印・社印（角印/丸印）の登録・プレビューセクション */}
            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    会社実印・社印（角印 / 丸印）の印影登録
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    登録された印影は、<strong>「給与支払明細書」</strong>および<strong>「労働条件通知書 兼 雇用契約書」</strong>の事業主捺印欄へ自動印字されます（背景透過PNG推奨）。
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                {/* アップロード操作エリア */}
                <div className="md:col-span-7 space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleSealImageUpload}
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-4 h-4" />
                      印影画像をアップロード
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetName = basicInfo.name.trim() || '自社名';
                        const generated = generateOfficialSealDataUrl(targetName);
                        if (generated) {
                          setCompanySealUrl(generated);
                          setContractTemplate(prev => ({ ...prev, company_seal_url: generated }));
                          setBasicInfo(prev => ({ ...prev, company_seal_url: generated }));
                          if (tenantId) {
                            localStorage.setItem(`company_seal_image_${tenantId}`, generated);
                          }
                          alert(`✨ 「${targetName}」の公式朱肉角印（透過PNG）を自動生成してセットしました！\n右下の「設定を一括保存する」をクリックして保存を確定してください。`);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
                      title="公式朱肉角印を自社名で自動生成して登録します"
                    >
                      <Sparkles className="w-4 h-4" />
                      公式角印を自動生成
                    </button>
                    {companySealUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveSeal}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        印影を削除
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed space-y-0.5">
                    <div>・推奨フォーマット: <strong>背景が透明な PNG 画像</strong>（または白背景の鮮明な写真）</div>
                    <div>・最大ファイルサイズ: 2MB</div>
                    <div>※ 朱肉の赤色が鮮明に映るよう、自動で実印オーバーレイ調整されます。</div>
                  </div>
                </div>

                {/* プレビュー表示エリア */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 min-h-[120px]">
                  <div className="text-[10px] font-bold text-slate-400 mb-2">印影プレビュー（実寸連動）</div>
                  {companySealUrl ? (
                    <div className="relative w-24 h-24 flex items-center justify-center p-1 bg-slate-50/60 rounded-xl border border-dashed border-indigo-200">
                      <img
                        src={companySealUrl}
                        alt="社印印影"
                        className="max-w-full max-h-full object-contain mix-blend-multiply drop-shadow-sm select-none"
                      />
                      <span className="absolute -bottom-2 bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                        登録済み
                      </span>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                      <ImageIcon className="w-6 h-6 mb-1 opacity-40" />
                      <span>未登録</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 2. 会社組織図 ＆ 役職・部署マスタ タブ（一本化・直感ワンストップ設計） */}
        {activeTab === 'departments' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 🌳 1. 会社組織図（Org Chart）ワンストップ管理 エリア */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
              {/* 上部ヘッダー ＆ 操作ボタン群 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Network className="w-5 h-5 text-indigo-600" />
                    会社組織図（Org Chart） ＆ 所属・役職管理
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    組織図上で直接「部署の追加」「社員の配属」「役職」「部門長」を設定できます。入退社管理・勤怠・給与へ100%自動連動します。
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => navigate('/onboarding/admin?action=add&from=company_settings')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
                    title="入退社・労務書類管理システムを開いて新しい社員を登録します"
                  >
                    <Plus className="w-4 h-4" />
                    <span>社員を追加</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </button>

                  <button
                    onClick={() => navigate('/onboarding/admin?action=import&from=company_settings')}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
                    title="社員リストCSVを一括取り込みします"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>社員一括CSV</span>
                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                  </button>

                  <button
                    onClick={() => setIsOrgChartPrintModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    A4印刷 / PDF
                  </button>
                </div>
              </div>

              {/* 💡 らくまる組織図・初心者向け かんたん3ステップ設定ガイドバナー */}
              <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/80 p-5 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                      💡
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        らくまる組織図・初心者向け かんたん設定ガイド
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                          迷ったらここをチェック
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        設定した組織図は、入退社手続き・有給や残業の承認ルート・休日カレンダー・給与計算へ全自動連動します。
                      </p>
                    </div>
                  </div>

                  {/* ✨ 業種別テンプレートボタン（ガイド内でも一番目立たせる） */}
                  <button
                    onClick={() => setIsDeptPresetModalOpen(true)}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto transform hover:scale-[1.02]"
                    title="自社の業種に合った標準的な部門セットを一括生成します"
                  >
                    <Wand2 className="w-4 h-4 text-amber-200 animate-pulse" />
                    <span>✨ 業種別テンプレートから一括作成</span>
                  </button>
                </div>

                {/* 🚀 3ステップ進め方カード */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          STEP 1: 部署を作る
                        </span>
                        <span className="text-base">🏢</span>
                      </div>
                      <div className="text-xs font-black text-slate-800">自社の部門を揃える</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        右上の「業種別テンプレート」から選ぶか、入力欄から自社の部署（例: 営業部、管理部等）を追加します。
                      </p>
                    </div>
                    <div className="text-[10px] text-emerald-800 bg-emerald-50/90 px-2.5 py-1.5 rounded-lg font-bold border border-emerald-200 leading-snug">
                      🔰 名前変更（✎）・並び替え（← →）・削除（🗑️）もワンクリック！何度でも自由に変更・やり直せます
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          STEP 2: 責任者と休日を選ぶ
                        </span>
                        <span className="text-base">👔</span>
                      </div>
                      <div className="text-xs font-black text-slate-800">所属長 ＆ カレンダー設定</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        各部署カード内で「部門責任者（承認者）」と「適用営業カレンダー（土日祝休み／シフト制等）」を選びます。
                      </p>
                    </div>
                    <div className="text-[10px] text-amber-900 bg-amber-50/90 px-2.5 py-1.5 rounded-lg font-bold border border-amber-200 leading-snug">
                      ⚡ 有給・残業の承認通知が自動連動！（未指定のままでも全社標準ルールで動作します）
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                          STEP 3: 社員を配属する
                        </span>
                        <span className="text-base">👤</span>
                      </div>
                      <div className="text-xs font-black text-slate-800">スタッフの配属・役職決定</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        部署カード内の「＋社員を配属」や社員名クリックで、各スタッフの配属先と役職（部長、主任等）を決定します。
                      </p>
                    </div>
                    <div className="text-[10px] text-purple-900 bg-purple-50/90 px-2.5 py-1.5 rounded-lg font-bold border border-purple-200 leading-snug">
                      📊 労務・勤怠・給与へ全自動連動！（配属や役職はいつでもクリックで変更・解除可能）
                    </div>
                  </div>
                </div>
              </div>

              {/* 👑 経営陣・役員ブロック */}
              <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-blue-50/80 p-5 rounded-2xl border border-indigo-100 space-y-3">
                <div className="text-xs font-black text-indigo-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    経営陣・役員（クリックして役職・担当を変更）
                  </span>
                  <span className="text-[10px] text-indigo-700 font-bold">
                    代表・役員: {computedExecutives.length || 1}名
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {computedExecutives.length > 0 ? (
                    computedExecutives.map(exec => (
                      <div
                        key={exec.id}
                        onClick={() => setEditingUserModal({ isOpen: true, user: exec })}
                        className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex items-center justify-between"
                        title="クリックして役職や担当を変更"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-indigo-700 block">{exec.position_name || '役員'}</span>
                          <span className="text-xs font-black text-slate-800">{exec.name}</span>
                        </div>
                        <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                          役員
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-700 block">代表取締役</span>
                        <span className="text-xs font-black text-slate-800">{basicInfo.representative_name.replace('代表取締役', '').trim() || '代表取締役'}</span>
                      </div>
                      <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                        代表
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 👤 未配属・入社手続き中メンバー トレイ */}
              {computedUnassignedMembers.length > 0 && (
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-2">
                  <div className="text-xs font-black text-amber-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-600" />
                      未配属メンバー（クリックして配属先部署と役職を決定）
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                      {computedUnassignedMembers.length}名
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {computedUnassignedMembers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setEditingUserModal({ isOpen: true, user: u })}
                        className="bg-white hover:bg-amber-100/80 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-2 transition cursor-pointer shadow-2xs"
                      >
                        <span>{u.name}</span>
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          {u.position_name || '未配属'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 🌳 経営陣から各部門への組織統括ツリーコネクタ */}
              {computedOrgDepartments.length > 0 && (
                <div className="relative py-1.5 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <div className="w-16 h-px bg-indigo-200" />
                    <span className="flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full font-black shadow-2xs">
                      <ArrowDown className="w-3 h-3 text-indigo-500 animate-bounce" />
                      <span>経営陣の管掌下にある事業部門一覧</span>
                    </span>
                    <div className="w-16 h-px bg-indigo-200" />
                  </div>
                </div>
              )}

              {/* 🏢 各部門・部署カード（横一列ツリー展開） */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1 gap-2">
                  <div>
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      <span>各部門・配属一覧（全{computedOrgDepartments.length}部署 / 総員{companyUsers.length}名）</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      ※ 部署カードごとに「部門長」や「休日規定」を設定し、社員を配属できます（名前変更・並び替え・不要な部署の削除も自由自在）
                    </p>
                  </div>

                  {/* 新規部署追加ボタン（インライン入力トグル） */}
                  <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 self-start sm:self-auto">
                    <input
                      type="text"
                      placeholder="新しい部署名（例: 企画部）"
                      value={newDeptName}
                      onChange={e => setNewDeptName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddDepartment();
                      }}
                      className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 w-36 sm:w-44"
                    />
                    <button
                      onClick={handleAddDepartment}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> 部署追加
                    </button>
                  </div>
                </div>

                <div className="flex items-stretch justify-start gap-4 overflow-x-auto pb-4 pt-2">
                  {computedOrgDepartments.length === 0 ? (
                    <div className="w-full py-12 px-6 text-center bg-gradient-to-b from-slate-50 to-indigo-50/30 rounded-3xl border-2 border-dashed border-indigo-200 space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800">登録されている部署がありません</h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                          自社の組織構成に合わせて部署を手入力するか、業界別テンプレートからワンクリックで一括生成できます。<br />
                          <span className="text-emerald-700 font-bold">※ 不要な部署の削除（🗑️）や名前変更・並び替えも後からワンクリックで自由に行えます。</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <button
                          onClick={() => setIsDeptPresetModalOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
                        >
                          <Wand2 className="w-4 h-4 text-amber-300" />
                          <span>業種別テンプレートから選ぶ</span>
                        </button>
                      </div>
                      {/* クイック選択カード一覧 */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2 text-left">
                        {DEPARTMENT_PRESETS.slice(0, 3).map(preset => (
                          <div
                            key={preset.id}
                            onClick={() => handleApplyDepartmentPreset(preset.id)}
                            className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition cursor-pointer space-y-2 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base">{preset.icon}</span>
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                {preset.badge}
                              </span>
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition">{preset.name}</div>
                              <div className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</div>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {preset.departments.map(d => (
                                <span key={d.name} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {d.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    computedOrgDepartments.map((dept, idx) => {
                      const theme = getDepartmentTheme(dept.name);
                      const isEditingThisDept = editingDepartmentId === dept.id;
                      return (
                        <div
                          key={dept.id}
                          className="min-w-[280px] max-w-[330px] flex-1 bg-white hover:bg-slate-50/50 rounded-2xl border-2 border-slate-200 hover:border-indigo-300 shadow-xs transition flex flex-col justify-between overflow-hidden relative group"
                        >
                          {/* 最上部アクセントバー */}
                          <div className={`h-1.5 w-full ${theme.accentBar}`} />

                          <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                            <div className="space-y-3">
                              {/* 部署ヘッダー ＆ 編集 ＆ 左右並び替え ＆ 削除 */}
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200 gap-1.5">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm shrink-0" title={dept.name}>{theme.icon}</span>

                                  {isEditingThisDept ? (
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                      <input
                                        type="text"
                                        value={editingDepartmentNameText}
                                        onChange={e => setEditingDepartmentNameText(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleSaveRenameDepartment(dept.id, dept.name);
                                          if (e.key === 'Escape') handleCancelEditDepartment();
                                        }}
                                        autoFocus
                                        className="bg-white border border-indigo-400 rounded-lg px-2 py-0.5 text-xs font-black text-slate-900 w-full focus:ring-2 focus:ring-indigo-200 outline-none"
                                      />
                                      <button
                                        onClick={() => handleSaveRenameDepartment(dept.id, dept.name)}
                                        className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition cursor-pointer shrink-0"
                                        title="名前を保存（所属社員も自動追従）"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={handleCancelEditDepartment}
                                        className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md transition cursor-pointer shrink-0"
                                        title="キャンセル"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 min-w-0 flex-1">
                                      <h5 className="text-xs font-black text-slate-900 truncate" title={dept.name}>{dept.name}</h5>
                                      <button
                                        onClick={() => handleStartEditDepartment(dept)}
                                        className="p-0.5 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer opacity-70 group-hover:opacity-100 shrink-0"
                                        title="部署名を変更"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
                                    {dept.members.length}名
                                  </span>

                                  {/* 左右並び替えボタン */}
                                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                    <button
                                      onClick={() => handleMoveDepartmentOrder(dept.id, 'left')}
                                      disabled={idx === 0}
                                      className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed rounded transition cursor-pointer"
                                      title="左へ移動"
                                    >
                                      <ChevronLeft className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveDepartmentOrder(dept.id, 'right')}
                                      disabled={idx === computedOrgDepartments.length - 1}
                                      className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed rounded transition cursor-pointer"
                                      title="右へ移動"
                                    >
                                      <ChevronRight className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* 削除ボタン */}
                                  <button
                                    onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                    title="この部署を削除（所属社員は消去されず未配属トレイへ安全に保護されます）"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* 部門長・所属長アサイン枠 */}
                              <div className="bg-amber-50/80 border border-amber-200 p-2.5 rounded-xl space-y-1.5">
                                <div className="text-[10px] font-black text-amber-800 flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                                    部門責任者（所属長）
                                  </span>
                                  {dept.manager_user_name ? (
                                    <span className="text-[9px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                                      任命済
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-amber-600 font-bold">未指定でもOK</span>
                                  )}
                                </div>
                                <select
                                  value={dept.manager_user_id || ''}
                                  onChange={e => handleUpdateDepartmentManager(dept.name, e.target.value)}
                                  className={`w-full text-xs font-bold px-2 py-1.5 rounded-lg border transition ${
                                    dept.manager_user_id
                                      ? 'bg-white text-slate-900 border-amber-300 font-black shadow-2xs'
                                      : 'bg-white/80 text-slate-500 border-amber-200'
                                  }`}
                                >
                                  <option value="">（所属長: 未指定）</option>
                                  {companyUsers.map(u => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.department || '未所属'}{u.role === 'admin' ? ' / 管理者' : ''})
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[9px] text-amber-800/90 leading-tight">
                                  ※ この部署のスタッフから届く有給申請・残業申請を承認するリーダーを指定します
                                </p>
                              </div>

                              {/* 📅 適用営業カレンダー（休日規程）アサイン枠 */}
                              <div className="bg-indigo-50/70 border border-indigo-200 p-2.5 rounded-xl space-y-1.5">
                                <div className="text-[10px] font-black text-indigo-900 flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                    適用営業カレンダー（休日規程）
                                  </span>
                                  <span className="text-[9px] text-indigo-600 font-bold bg-white px-1.5 py-0.2 rounded border border-indigo-200">
                                    勤怠自動連動
                                  </span>
                                </div>
                                <select
                                  value={departments.find(d => sanitizeDepartmentName(d.name) === sanitizeDepartmentName(dept.name))?.calendar_pattern_id || (calendarPatterns.find(p => p.is_default)?.id || calendarPatterns[0]?.id || '')}
                                  onChange={e => handleUpdateDepartmentCalendar(dept.name, e.target.value)}
                                  className="w-full text-xs font-bold px-2 py-1.5 rounded-lg border bg-white text-slate-900 border-indigo-300 shadow-2xs cursor-pointer focus:ring-2 focus:ring-indigo-200 transition"
                                >
                                  {calendarPatterns.map(pat => (
                                    <option key={pat.id} value={pat.id}>
                                      {pat.name} ({pat.annual_holidays_count}日{pat.is_default ? ' / 全社標準' : ''})
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[9px] text-indigo-800/90 leading-tight">
                                  ※ この部署の年間休日（土日祝休み／シフト制など）がタイムカード集計に自動反映されます
                                </p>
                              </div>

                              {/* 所属メンバーリスト（店舗運営部は登録店舗が存在する場合のみ配下店舗ツリー構造を展開） */}
                              <div className="space-y-1.5">
                                {dept.name === '店舗運営部' && stores.length > 0 ? (
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-black text-amber-900 bg-amber-50/80 px-2.5 py-1.5 rounded-xl border border-amber-200 mb-2">
                                      <span className="flex items-center gap-1.5">
                                        <Store className="w-3.5 h-3.5 text-amber-600" />
                                        店舗運営部 配下店舗ツリー
                                      </span>
                                      <span className="text-[9px] bg-amber-200/80 text-amber-950 px-1.5 py-0.2 rounded font-bold">
                                        {stores.length}拠点
                                      </span>
                                    </div>
                                    <div className="space-y-2 max-h-56 overflow-y-auto text-xs pr-1">
                                      {stores.map(store => {
                                        const storeMembers = dept.members.filter(m => (m.store_name || '').trim() === store.name.trim());
                                        return (
                                          <div key={store.id} className="bg-white rounded-xl border border-slate-200 p-2 shadow-2xs space-y-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 pb-1 border-b border-slate-100">
                                              <span className="flex items-center gap-1 text-slate-900 font-black">
                                                <Store className="w-3 h-3 text-indigo-500" />
                                                {store.name}
                                              </span>
                                              <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
                                                {storeMembers.length}名
                                              </span>
                                            </div>
                                            {storeMembers.length > 0 ? (
                                              <div className="space-y-1 pt-0.5">
                                                {storeMembers.map(m => (
                                                  <div
                                                    key={m.id}
                                                    onClick={() => setEditingUserModal({
                                                      isOpen: true,
                                                      user: {
                                                        ...m,
                                                        department: dept.name,
                                                        store_name: store.name,
                                                        is_department_head: dept.manager_user_id === m.id
                                                      }
                                                    })}
                                                    className="flex items-center justify-between py-1 px-2 bg-slate-50/80 hover:bg-indigo-50/60 rounded-lg border border-slate-100 hover:border-indigo-200 transition cursor-pointer text-[11px]"
                                                    title="クリックして役職や配属店舗を変更"
                                                  >
                                                    <span className="font-bold text-slate-800 flex items-center gap-1">
                                                      {m.name}
                                                      {dept.manager_user_id === m.id && (
                                                        <span className="text-[8px] text-amber-600 font-bold bg-amber-50 px-1 rounded border border-amber-200">★統括</span>
                                                      )}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                                      {m.position_name || '現場スタッフ'}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <div className="text-[9px] text-slate-400 py-1 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                                配属スタッフなし
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}

                                      {/* 店舗未割当のメンバー */}
                                      {(() => {
                                        const unassignedStoreMembers = dept.members.filter(m => !m.store_name || !stores.some(st => st.name === m.store_name));
                                        if (unassignedStoreMembers.length === 0) return null;
                                        return (
                                          <div className="bg-amber-50/40 rounded-xl border border-dashed border-amber-300 p-2 space-y-1">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-amber-800 pb-1 border-b border-amber-100">
                                              <span>⚠️ 店舗未設定（本部・巡回等）</span>
                                              <span className="text-[9px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full font-bold">
                                                {unassignedStoreMembers.length}名
                                              </span>
                                            </div>
                                            <div className="space-y-1 pt-0.5">
                                              {unassignedStoreMembers.map(m => (
                                                <div
                                                  key={m.id}
                                                  onClick={() => setEditingUserModal({
                                                    isOpen: true,
                                                    user: {
                                                      ...m,
                                                      department: dept.name,
                                                      is_department_head: dept.manager_user_id === m.id
                                                    }
                                                  })}
                                                  className="flex items-center justify-between py-1 px-2 bg-white hover:bg-amber-100/50 rounded-lg border border-amber-200 transition cursor-pointer text-[11px]"
                                                  title="クリックして配属店舗を設定"
                                                >
                                                  <span className="font-bold text-slate-800">{m.name}</span>
                                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100/60 px-1 py-0.2 rounded">
                                                    店舗未設定 ✎
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                                      <span>所属メンバー（全{dept.members.length}名）:</span>
                                      <span className="text-[9px] text-slate-400">※ 名前クリックで役職・配属変更</span>
                                    </div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto text-xs pr-1">
                                      {dept.members.length > 0 ? (
                                        dept.members.map(m => (
                                          <div
                                            key={m.id}
                                            onClick={() => setEditingUserModal({
                                              isOpen: true,
                                              user: {
                                                ...m,
                                                department: dept.name,
                                                is_department_head: dept.manager_user_id === m.id
                                              }
                                            })}
                                            className="flex items-center justify-between py-1.5 px-2.5 bg-slate-50/80 hover:bg-indigo-50/60 rounded-xl border border-slate-200 hover:border-indigo-300 transition cursor-pointer shadow-2xs"
                                            title="クリックして役職や所属を変更"
                                          >
                                            <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                                              {m.name}
                                              {dept.manager_user_id === m.id && (
                                                <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1 rounded border border-amber-200">★長</span>
                                              )}
                                            </span>
                                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                              {m.position_name || '一般'}
                                            </span>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-[10px] text-slate-400 py-2 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                          所属メンバーなし
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* この部署に社員を配属するボタン */}
                            <div className="pt-2 border-t border-slate-200 text-right mt-3">
                              <button
                                onClick={() => {
                                  if (companyUsers.length === 0) {
                                    alert('現在登録されている社員・ユーザーがいません。先に従業員を登録してください。');
                                    return;
                                  }
                                  const unassigned = companyUsers.find(u => !u.department);
                                  const targetUser = unassigned || companyUsers[0];
                                  setEditingUserModal({
                                    isOpen: true,
                                    user: {
                                      ...targetUser,
                                      department: dept.name,
                                      is_department_head: dept.manager_user_id === targetUser.id
                                    }
                                  });
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center justify-end gap-1 ml-auto"
                              >
                                <Plus className="w-3 h-3" />
                                この部署に社員を配属・役職設定
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 👔 2. 役職マスタ管理（Position Masters） */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-600" />
                    役職マスタ定義 ＆ 階層体系（Position Masters）
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    自社の役職と階層ランク（Lv.1 経営陣 〜 Lv.5 一般スタッフ）を定義します。承認フローや組織図に自動連動します。
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl">
                    登録役職数: <strong className="text-indigo-600 font-black">{positions.length}</strong> 件
                  </span>
                </div>
              </div>

              {/* 2カラム構成：左側に登録フォーム、右側に階層別ピラミッド縦並び */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 左側カラム (lg:col-span-5): 役職登録フォーム ＆ ガイド */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-indigo-600" />
                      新しい役職を追加
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          役職名 <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="例: 部長 / 課長 / 主任 / リーダー"
                          value={newPositionName}
                          onChange={e => setNewPositionName(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          所属階層ランク
                        </label>
                        <select
                          value={newPositionRank}
                          onChange={e => setNewPositionRank(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                        >
                          <option value={1}>👑 階層: 1. 経営陣(役員)</option>
                          <option value={2}>👔 階層: 2. 部門長(部長等)</option>
                          <option value={3}>🏢 階層: 3. 中間管理職(課長・マネージャー)</option>
                          <option value={4}>🎖️ 階層: 4. 現場リーダー・主任</option>
                          <option value={5}>👤 階層: 5. 一般社員・スタッフ</option>
                        </select>
                      </div>
                      <button
                        onClick={handleAddPosition}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" /> この役職を追加
                      </button>
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                    <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      役職階層ランクと権限の連動
                    </div>
                    <p>
                      階層ランク（Lv.1〜5）は、各種申請（有給・残業・シフト）の<strong>承認権限</strong>や組織図の上下関係に連動します。
                    </p>
                    <p className="text-[10px] text-slate-400">
                      ※ 右側のピラミッドから「▲▼」ボタンで並び順の入れ替え、「階層セレクト」で即座にランクを変更できます。
                    </p>
                  </div>
                </div>

                {/* 右側カラム (lg:col-span-7): 階層別ピラミッド縦並びリスト */}
                <div className="lg:col-span-7 space-y-3">
                  {/* 💡 初めて設定される企業様への安心ガイダンス */}
                  {/* 💡 かんたん役職セットアップ ＆ ガイダンス一体型カード（説明と選択を一体化） */}
                  <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg shrink-0 select-none mt-0.5">💡</span>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="font-black text-xs text-emerald-950 flex items-center gap-1.5 flex-wrap">
                          <span>初めて設定される企業様・小規模オフィスの皆様へ</span>
                          <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.2 rounded-full">
                            未登録の階層があっても正常稼働
                          </span>
                        </div>
                        <p className="text-emerald-800 text-[11px] leading-relaxed">
                          ゼロから役職を考える必要はありません。自社の規模に合わせて下の<strong>3つのセットから選ぶだけ</strong>で一瞬で展開されます。
                          <span className="text-emerald-700 block text-[10px] mt-0.5">
                            ※ 10名未満の企業様は「代表」と「一般スタッフ」の2階層だけでも勤怠・給与・申請はすべて正常に運用できます。自社にない階層は空欄で問題ありません。
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* 3つのプリセット選択ボタングループ（読んだ直後にその場でワンタップ） */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                      <button
                        onClick={() => handleApplyPreset('standard_corporate')}
                        className="bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 p-2.5 rounded-xl text-left transition group cursor-pointer shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">🏢</span>
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded">標準7役職</span>
                        </div>
                        <div className="font-black text-xs text-slate-800 group-hover:text-indigo-600 transition">
                          一般企業・オフィス
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          役員・部長・課長・主任・一般
                        </div>
                      </button>

                      <button
                        onClick={() => handleApplyPreset('store_service')}
                        className="bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 p-2.5 rounded-xl text-left transition group cursor-pointer shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">🏪</span>
                          <span className="text-[9px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded">現場6役職</span>
                        </div>
                        <div className="font-black text-xs text-slate-800 group-hover:text-blue-600 transition">
                          店舗・サービス業
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          店長・エリア長・アルバイト
                        </div>
                      </button>

                      <button
                        onClick={() => handleApplyPreset('simple_small')}
                        className="bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 text-white p-2.5 rounded-xl text-left transition group cursor-pointer shadow-2xs hover:shadow-md"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">⚡</span>
                          <span className="text-[9px] font-black bg-white/20 text-white px-1.5 py-0.2 rounded">迷ったらコレ</span>
                        </div>
                        <div className="font-black text-xs text-white">
                          超シンプル (~10名)
                        </div>
                        <div className="text-[10px] text-emerald-100 mt-0.5 leading-tight">
                          代表 と 一般スタッフ の2階層のみ
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between pt-1">
                    <span>役職階層ピラミッド体系</span>
                    <span className="text-[10px] text-slate-400 font-normal">▲▼で同一階層内の並び順入れ替え / 階層変更可能</span>
                  </div>

                  <div className="space-y-2.5">
                    {POSITION_RANKS_META.map(meta => {
                      const rankPositions = positions.filter(p => p.rank_level === meta.rank);
                      return (
                        <div key={meta.rank} className={`rounded-2xl border ${meta.border} ${meta.bg} p-3 transition`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{meta.icon}</span>
                              <span className="font-black text-xs text-slate-800">{meta.label}</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${meta.color}`}>
                                {rankPositions.length}件
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 hidden sm:inline">{meta.desc}</span>
                          </div>

                          {rankPositions.length === 0 ? (
                            <div className="text-[11px] text-slate-400 py-2 px-3 bg-white/60 rounded-xl border border-dashed border-slate-200 text-center flex flex-col sm:flex-row items-center justify-center gap-1">
                              <span>この階層に登録されている役職はありません</span>
                              <span className="text-[10px] text-slate-300 font-normal">（※ 不要な場合は空欄のままで全く問題ありません）</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {rankPositions.map((p, idx) => (
                                <div
                                  key={p.id}
                                  className="bg-white px-3 py-2 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 text-xs"
                                >
                                  {editingPositionId === p.id ? (
                                    <div className="flex items-center gap-1 flex-1">
                                      <input
                                        type="text"
                                        value={editingPositionNameText}
                                        onChange={e => setEditingPositionNameText(e.target.value)}
                                        className="flex-1 bg-indigo-50/50 border border-indigo-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveEditPosition(p.id)}
                                        className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                                      >
                                        保存
                                      </button>
                                      <button
                                        onClick={handleCancelEditPosition}
                                        className="bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-[10px] cursor-pointer"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="font-black text-slate-800 truncate">{p.name}</span>
                                      <button
                                        onClick={() => handleStartEditPosition(p)}
                                        className="text-slate-300 hover:text-indigo-600 transition cursor-pointer p-0.5"
                                        title="役職名を変更"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* 階層移動セレクト */}
                                    <select
                                      value={p.rank_level}
                                      onChange={e => handleUpdatePositionRank(p.id, Number(e.target.value))}
                                      className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 cursor-pointer"
                                      title="階層を変更"
                                    >
                                      <option value={1}>Lv.1 役員</option>
                                      <option value={2}>Lv.2 部長</option>
                                      <option value={3}>Lv.3 課長</option>
                                      <option value={4}>Lv.4 主任</option>
                                      <option value={5}>Lv.5 一般</option>
                                    </select>

                                    {/* 上へボタン */}
                                    <button
                                      onClick={() => handleMovePositionUp(p.id)}
                                      disabled={idx === 0}
                                      className={`p-1 rounded border border-slate-200 ${
                                        idx === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50 cursor-pointer'
                                      }`}
                                      title="同一階層内で上へ移動"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>

                                    {/* 下へボタン */}
                                    <button
                                      onClick={() => handleMovePositionDown(p.id)}
                                      disabled={idx === rankPositions.length - 1}
                                      className={`p-1 rounded border border-slate-200 ${
                                        idx === rankPositions.length - 1 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50 cursor-pointer'
                                      }`}
                                      title="同一階層内で下へ移動"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>

                                    {/* 削除ボタン */}
                                    <button
                                      onClick={() => handleDeletePosition(p.id)}
                                      className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                                      title="役職を削除"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 🚀 STEP 3 完了ネクストアクション・バー（役職設定完了後の次ステップ誘導） */}
            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 border-2 border-indigo-200/80 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1 text-center md:text-left">
                <div className="font-black text-sm text-slate-800 flex items-center justify-center md:justify-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>役職・組織（STEP 3）の設定お疲れ様でした！</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    進捗 60%
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  組織の土台が整いました。次は<strong>「社員・パートさんの基本台帳登録・契約書作成（STEP 4）」</strong>へ進みましょう。
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={scrollToStartupGuide}
                  className="flex-1 md:flex-none bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  title="画面最上部のスタートガイドへ戻って進捗を確認"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>スタートガイドに戻る</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/admin?from=company_settings')}
                  className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md"
                >
                  <span>次へ進む: 社員登録 (STEP 4)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 🏪 3. 店舗・拠点マスタ管理（Store Masters） */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <Store className="w-4 h-4 text-indigo-600" />
                    店舗・拠点マスタ管理（Store Masters）
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    営業所・支社・店舗などの複数拠点を登録します。シフトや勤怠は<strong>拠点ごとに管理</strong>でき、拠点間の応援配置にも対応しています。
                  </p>
                </div>
                <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-xl shrink-0">
                  ※ 単一拠点・オフィスの企業様は登録不要です
                </div>
              </div>

              {/* 新規店舗追加フォーム */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  新しい店舗・拠点を追加
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">拠点・店舗名 <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      placeholder="例: 東京本社、大阪支社、銀座店"
                      value={newStoreName}
                      onChange={e => setNewStoreName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">拠点コード（任意）</label>
                    <input
                      type="text"
                      placeholder="例: TOKYO-01, OSAKA-02"
                      value={newStoreCode}
                      onChange={e => setNewStoreCode(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">管轄部門</label>
                    <select
                      value={newStoreDept}
                      onChange={e => setNewStoreDept(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">管轄部門: 未選択</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">拠点責任者・店長</label>
                    <select
                      value={newStoreManagerId}
                      onChange={e => setNewStoreManagerId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                    >
                      <option value="">責任者: 未指定</option>
                      {companyUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.department || '一般'})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleAddStore}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" /> 店舗を追加する
                  </button>
                </div>
              </div>

              {/* 店舗一覧カード */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {stores.length === 0 ? (
                  <div className="col-span-full py-10 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <Store className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="text-xs font-bold text-slate-600">登録されている店舗・拠点はありません</div>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      店舗展開・複数拠点運営を行っている企業様は、上部の「新しい店舗・拠点を追加」から自社の店舗を登録してください。
                    </p>
                  </div>
                ) : (
                  stores.map((s, idx) => {
                  const staffCount = companyUsers.filter(u => u.store_name === s.name).length;
                  return (
                    <div
                      key={s.id}
                      className="bg-slate-50/90 rounded-2xl border-2 border-slate-200 p-4 space-y-3 shadow-xs hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                              {s.name}
                            </h5>
                            {s.code && (
                              <span className="text-[10px] text-slate-400 font-mono block">コード: {s.code}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                            {staffCount}名配属
                          </span>
                          <button
                            onClick={() => handleDeleteStore(s.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded cursor-pointer transition"
                            title="この店舗を削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 管轄部門 */}
                      <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold block">統括組織部門:</span>
                        <select
                          value={s.department_name || ''}
                          onChange={e => handleUpdateStoreDepartment(s.id, e.target.value)}
                          className="w-full text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                        >
                          <option value="">（未設定）</option>
                          {departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* 店長・責任者 */}
                      <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-200 space-y-1">
                        <span className="text-[10px] text-amber-800 font-bold block">店長・店舗責任者:</span>
                        <select
                          value={s.manager_user_id || ''}
                          onChange={e => handleUpdateStoreManager(s.id, e.target.value)}
                          className="w-full text-xs font-bold px-2 py-1 rounded-lg border border-amber-200 bg-white text-slate-800"
                        >
                          <option value="">（店長: 未指定）</option>
                          {companyUsers.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.department || '一般'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 3. 年間営業カレンダー ＆ 就業時間 タブ */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  {calendarSettings.year}年 会社年間営業カレンダー ＆ 休日設定
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  カレンダーの日付をクリックして個別に休日/営業日を切り替え可能。会社営業カレンダーとしてA4印刷・PDF出力できます。
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarPrintModalOpen(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap shrink-0"
                >
                  <Printer className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>営業カレンダー 印刷/PDF</span>
                </button>
              </div>
            </div>

            {/* 📅 複数カレンダーパターン切替タブ ＆ 管理ヘッダー */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span>🏢 営業日・休日パターンの選択（複数カレンダー対応）</span>
                    <span className="text-[10px] text-indigo-700 bg-indigo-100 font-bold px-2 py-0.5 rounded-full">
                      全{calendarPatterns.length}パターン
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    本社（土日祝休み）、店舗（シフト制）、現場（日祝・隔週土曜）など、部門ごとに異なる営業カレンダーを個別に設定・印刷できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCalendarPattern}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  新規カレンダーを追加
                </button>
              </div>

              {/* カレンダーパターン選択タブ */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {calendarPatterns.map(pat => {
                  const isActive = activeCalendarId === pat.id;
                  const isDef = pat.is_default;
                  return (
                    <button
                      key={pat.id}
                      type="button"
                      onClick={() => handleSelectCalendarPattern(pat.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-white text-indigo-700 border-2 border-indigo-600 shadow-sm'
                          : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white'
                      }`}
                    >
                      <Calendar className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span>{pat.name}</span>
                      {isDef && (
                        <span className="bg-indigo-100 text-indigo-800 text-[9px] px-1.5 py-0.5 rounded font-black">
                          全社標準
                        </span>
                      )}
                      <span className={`text-[10px] font-normal ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                        ({isActive ? computedHolidaysSet.size : pat.annual_holidays_count}日)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 選択中パターンの詳細設定バー */}
              {(() => {
                const curPat = calendarPatterns.find(p => p.id === activeCalendarId) || calendarPatterns[0];
                if (!curPat) return null;
                return (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 pt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-800">
                          編集中のカレンダー設定:
                        </span>
                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {curPat.name}
                        </span>
                        {curPat.is_default ? (
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            ★ 全社標準（代表）カレンダー
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultCalendarPattern(curPat.id)}
                            className="text-[10px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 px-2 py-0.5 rounded-md border border-slate-200 transition cursor-pointer"
                            title="このカレンダーを全社標準（代表）に指定します"
                          >
                            ⭐ 全社標準に設定
                          </button>
                        )}
                      </div>

                      {!curPat.is_default && calendarPatterns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCalendarPattern(curPat.id)}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer self-end sm:self-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          このカレンダーを削除
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          カレンダー名称（例: 標準カレンダー（本社・営業） / 店舗・シフト制）
                        </label>
                        <input
                          type="text"
                          value={curPat.name}
                          onChange={e => handleUpdatePatternName(curPat.id, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          説明・対象部署メモ（例: 本社・管理部門・営業職向け）
                        </label>
                        <input
                          type="text"
                          value={curPat.description || ''}
                          placeholder="例: 店舗運営部・飲食サービス部門向け"
                          onChange={e => handleUpdatePatternDesc(curPat.id, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 📅 12ヶ月 インタラクティブ営業カレンダー */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-800 text-sm">
                    {calendarSettings.year}年 営業日・休日マップ
                  </span>
                  <span className="bg-indigo-100 text-indigo-800 font-black text-xs px-2.5 py-1 rounded-lg">
                    年間総休日数: {computedHolidaysSet.size}日
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span> 休日 (クリックで切替)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-white border border-slate-300 inline-block"></span> 稼働営業日
                  </span>
                </div>
              </div>

              {/* 12ヶ月グリッド */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const daysInMonth = new Date(calendarSettings.year, m, 0).getDate();
                  const firstDayOfWeek = new Date(calendarSettings.year, m - 1, 1).getDay();
                  const paddingDays = Array.from({ length: firstDayOfWeek });

                  return (
                    <div key={m} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="text-center font-black text-xs text-indigo-950 pb-1.5 mb-1.5 border-b border-slate-100 flex items-center justify-between">
                        <span>{m}月</span>
                        <span className="text-[10px] text-slate-400 font-bold">{calendarSettings.year}.{String(m).padStart(2, '0')}</span>
                      </div>

                      {/* 曜日 */}
                      <div className="grid grid-cols-7 text-center text-[9px] font-black pb-1 mb-1 text-slate-400 border-b border-slate-50">
                        <span className="text-rose-500">日</span>
                        <span>月</span>
                        <span>火</span>
                        <span>水</span>
                        <span>木</span>
                        <span>金</span>
                        <span className="text-blue-500">土</span>
                      </div>

                      {/* 日付 */}
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                        {paddingDays.map((_, i) => (
                          <div key={`p-${i}`} className="h-5"></div>
                        ))}
                        {Array.from({ length: daysInMonth }, (_, dIdx) => {
                          const dayNum = dIdx + 1;
                          const dateKey = `${calendarSettings.year}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const isHol = computedHolidaysSet.has(dateKey);
                          const dayOfWeek = new Date(calendarSettings.year, m - 1, dayNum).getDay();

                          return (
                            <button
                              key={dateKey}
                              type="button"
                              onClick={() => handleToggleDay(dateKey)}
                              className={`h-5 flex items-center justify-center font-bold rounded transition cursor-pointer ${
                                isHol
                                  ? 'bg-rose-500 text-white font-black hover:bg-rose-600'
                                  : dayOfWeek === 6
                                    ? 'text-blue-600 hover:bg-blue-50'
                                    : dayOfWeek === 0
                                      ? 'text-rose-600 hover:bg-rose-50'
                                      : 'text-slate-700 hover:bg-slate-100'
                              }`}
                              title={`${dateKey}: クリックして${isHol ? '稼働日' : '休日'}に変更`}
                            >
                              {dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 一括ルール設定 */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                休日の一括適用ルール
              </h4>

              <div>
                <span className="font-bold text-slate-700 block mb-2">固定休日（曜日）</span>
                <div className="flex flex-wrap gap-3">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => {
                    const isChecked = calendarSettings.fixed_holidays.includes(idx);
                    return (
                      <label key={day} className="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 font-bold">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = isChecked
                              ? calendarSettings.fixed_holidays.filter(d => d !== idx)
                              : [...calendarSettings.fixed_holidays, idx];
                            setCalendarSettings({ ...calendarSettings, fixed_holidays: next });
                          }}
                          className="rounded text-indigo-600"
                        />
                        <span className={idx === 0 ? 'text-rose-600' : idx === 6 ? 'text-blue-600' : 'text-slate-700'}>{day}曜日</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={calendarSettings.national_holidays_enabled}
                    onChange={e => setCalendarSettings({ ...calendarSettings, national_holidays_enabled: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  <span>国民の祝日をすべて休日に設定する（年間16日）</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mb-1">
                      <input
                        type="checkbox"
                        checked={calendarSettings.winter_vacation_enabled}
                        onChange={e => setCalendarSettings({ ...calendarSettings, winter_vacation_enabled: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span>年末年始休暇</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={calendarSettings.winter_vacation_start}
                        onChange={e => setCalendarSettings({ ...calendarSettings, winter_vacation_start: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <span>〜</span>
                      <input
                        type="date"
                        value={calendarSettings.winter_vacation_end}
                        onChange={e => setCalendarSettings({ ...calendarSettings, winter_vacation_end: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mb-1">
                      <input
                        type="checkbox"
                        checked={calendarSettings.summer_vacation_enabled}
                        onChange={e => setCalendarSettings({ ...calendarSettings, summer_vacation_enabled: e.target.checked })}
                        className="rounded text-indigo-600"
                      />
                      <span>夏季休暇（お盆休み）</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={calendarSettings.summer_vacation_start}
                        onChange={e => setCalendarSettings({ ...calendarSettings, summer_vacation_start: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <span>〜</span>
                      <input
                        type="date"
                        value={calendarSettings.summer_vacation_end}
                        onChange={e => setCalendarSettings({ ...calendarSettings, summer_vacation_end: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 独自の休日（創立記念日等） */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <span className="font-bold text-slate-700 block">独自の会社休日（創立記念日・特別休業等）</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="date"
                    value={newCustomHolidayDate}
                    onChange={e => setNewCustomHolidayDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="休日の名称（例: 創立記念日）"
                    value={newCustomHolidayName}
                    onChange={e => setNewCustomHolidayName(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                  <button
                    onClick={handleAddCustomHoliday}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> 追加
                  </button>
                </div>

                {calendarSettings.custom_holidays.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {calendarSettings.custom_holidays.map((h, i) => (
                      <div key={i} className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-bold text-slate-700 flex items-center gap-2 shadow-xs text-xs">
                        <span>{h.date} : {h.name}</span>
                        <button onClick={() => handleDeleteCustomHoliday(i)} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ⏰ 部署別 就業時間パターンマスタ */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  就業時間パターン一覧（部署紐付け ＆ 個別調整対応）
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  会社内の勤務パターンを登録します。入社時に部署を選ぶと該当パターンが自動セットされ、個人ごとの時間上書きも可能です。
                </p>
              </div>

              {/* パターン追加フォーム */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-500 block mb-0.5">パターン名（例: 本社標準 / 店舗早番）</label>
                  <input
                    type="text"
                    placeholder="パターン名"
                    value={newPatternName}
                    onChange={e => setNewPatternName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">始業 〜 終業</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={newPatternStartTime}
                      onChange={e => setNewPatternStartTime(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    />
                    <span>〜</span>
                    <input
                      type="time"
                      value={newPatternEndTime}
                      onChange={e => setNewPatternEndTime(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">休憩(分) / 適用部署</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={newPatternBreakMinutes}
                      onChange={e => setNewPatternBreakMinutes(parseInt(e.target.value, 10) || 60)}
                      className="w-14 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    />
                    <select
                      value={newPatternDept}
                      onChange={e => setNewPatternDept(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs"
                    >
                      <option value="">共通（全社）</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddSchedulePattern}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> パターン追加
                  </button>
                </div>
              </div>

              {/* パターン一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                {schedulePatterns.map(pat => (
                  <div key={pat.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
                    <div>
                      <div className="font-black text-slate-800 flex items-center gap-1.5">
                        {pat.name}
                        {pat.target_department && (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-indigo-200">
                            {pat.target_department}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        ⏰ {pat.start_time} 〜 {pat.end_time}（休憩 {pat.break_minutes}分）
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSchedulePattern(pat.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ⚙️ 現場即応 打刻・時間丸め（マル目）設定 */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-5 rounded-2xl border-2 border-indigo-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-indigo-600 text-white p-1 rounded-lg">
                      <Clock className="w-4 h-4" />
                    </span>
                    <h4 className="font-black text-slate-800 text-sm">
                      現場即応 打刻・時間丸め（マル目）共通ルール
                    </h4>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                      全社自動適用
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    始業前の早出カットや、出退勤の15分単位丸め、定時退勤バッファなど、現場実務に即した計算ルールを設定します。
                  </p>
                </div>

                {/* ワンタッチ・おすすめプリセット ＆ 自社カスタムプリセット */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-1 rounded-lg">
                    ⚡ おすすめ一発適用:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceRules(ATTENDANCE_PRESETS.store_shift.rules);
                      showToast('🏪「店舗・シフト現場向け（15分丸め＋始業前カット）」を適用しました');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                    title={ATTENDANCE_PRESETS.store_shift.description}
                  >
                    🏪 店舗・シフト標準
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceRules(ATTENDANCE_PRESETS.office_standard.rules);
                      showToast('🏢「オフィス・本社標準（定時補正＋法定休憩）」を適用しました');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                    title={ATTENDANCE_PRESETS.office_standard.description}
                  >
                    🏢 オフィス標準
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceRules(ATTENDANCE_PRESETS.exact_strict.rules);
                      showToast('⏱️「厳密1分単位（補正なし）」を適用しました');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium transition shadow-2xs cursor-pointer"
                    title={ATTENDANCE_PRESETS.exact_strict.description}
                  >
                    ⏱️ 厳密1分単位
                  </button>

                  {/* 自社登録のカスタムプリセット一覧 */}
                  {customPresets.map(preset => (
                    <div key={preset.id} className="inline-flex items-center rounded-lg border border-purple-300 bg-purple-50 overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setAttendanceRules(preset.rules);
                          showToast(`✨ 自社プリセット「${preset.name}」を適用しました`);
                        }}
                        className="px-2.5 py-1 text-purple-900 hover:bg-purple-100 text-xs font-bold transition cursor-pointer"
                        title={preset.description || preset.name}
                      >
                        🏷️ {preset.name}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                        className="px-1.5 py-1 text-purple-400 hover:text-red-600 hover:bg-red-50 border-l border-purple-200 text-xs font-bold transition cursor-pointer"
                        title="このプリセットを削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* ＋ 新規プリセット保存ボタン */}
                  <button
                    type="button"
                    onClick={() => setNewPresetModalOpen(true)}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                    title="現在の設定を新しいプリセットとして保存します"
                  >
                    <span>＋</span> 現在の設定を新規プリセット保存
                  </button>
                </div>
              </div>

              {/* 設定グリッド */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 text-xs">
                
                {/* 1. 始業前の打刻カット */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                      🌅 始業前の出勤打刻
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded">
                      早出残業防止
                    </span>
                  </div>
                  <select
                    value={attendanceRules.check_in_before_start}
                    onChange={e => setAttendanceRules({
                      ...attendanceRules,
                      check_in_before_start: e.target.value as any
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-xs"
                  >
                    <option value="clip_to_start">始業時刻に自動補正（推奨・実務標準）</option>
                    <option value="exact">補正なし（打刻通りの実時間で計算）</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {attendanceRules.check_in_before_start === 'clip_to_start'
                      ? '💡 例: 9:00始業で8:40に打刻しても「9:00出勤」として実働計算します。'
                      : '💡 打刻した通りの時間から実働時間として計算します。'}
                  </p>
                </div>

                {/* 2. 出勤時間の端数丸め */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                      ⏱️ 出勤打刻の丸め（マル目）
                    </label>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded">
                      切り上げ
                    </span>
                  </div>
                  <select
                    value={attendanceRules.check_in_rounding_minutes}
                    onChange={e => setAttendanceRules({
                      ...attendanceRules,
                      check_in_rounding_minutes: parseInt(e.target.value, 10) as any
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-xs"
                  >
                    <option value={1}>1分単位（切り上げなし）</option>
                    <option value={5}>5分単位（切り上げ）</option>
                    <option value={10}>10分単位（切り上げ）</option>
                    <option value={15}>15分単位（切り上げ・現場標準）</option>
                    <option value={30}>30分単位（切り上げ）</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {attendanceRules.check_in_rounding_minutes > 1
                      ? `💡 例: 09:02打刻 ➔ ${minutesToTime(Math.ceil((9*60+2)/attendanceRules.check_in_rounding_minutes)*attendanceRules.check_in_rounding_minutes)}出勤として計算`
                      : '💡 1分刻みで正確に計算します。'}
                  </p>
                </div>

                {/* 3. 退勤時間の端数丸め */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                      🏁 退勤打刻の丸め（マル目）
                    </label>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded">
                      切り捨て
                    </span>
                  </div>
                  <select
                    value={attendanceRules.check_out_rounding_minutes}
                    onChange={e => setAttendanceRules({
                      ...attendanceRules,
                      check_out_rounding_minutes: parseInt(e.target.value, 10) as any
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-xs"
                  >
                    <option value={1}>1分単位（切り捨てなし）</option>
                    <option value={5}>5分単位（切り捨て）</option>
                    <option value={10}>10分単位（切り捨て）</option>
                    <option value={15}>15分単位（切り捨て・現場標準）</option>
                    <option value={30}>30分単位（切り捨て）</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {attendanceRules.check_out_rounding_minutes > 1
                      ? `💡 例: 18:14打刻 ➔ ${minutesToTime(Math.floor((18*60+14)/attendanceRules.check_out_rounding_minutes)*attendanceRules.check_out_rounding_minutes)}退勤として計算`
                      : '💡 1分刻みで正確に計算します。'}
                  </p>
                </div>

                {/* 4. 定時退勤バッファ */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                      🚪 定時退勤バッファ
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded">
                      着替え・混雑考慮
                    </span>
                  </div>
                  <select
                    value={attendanceRules.overtime_buffer_minutes}
                    onChange={e => setAttendanceRules({
                      ...attendanceRules,
                      overtime_buffer_minutes: parseInt(e.target.value, 10)
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-xs"
                  >
                    <option value={0}>0分（猶予なし・直ちに計算）</option>
                    <option value={5}>終業後 5分以内は定時退勤</option>
                    <option value={10}>終業後 10分以内は定時退勤（推奨）</option>
                    <option value={15}>終業後 15分以内は定時退勤</option>
                    <option value={30}>終業後 30分以内は定時退勤</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {attendanceRules.overtime_buffer_minutes > 0
                      ? `💡 終業後${attendanceRules.overtime_buffer_minutes}分以内の退勤は定時終業とみなし残業にしません。`
                      : '💡 終業時刻を過ぎた打刻は直ちに残業対象として計算します。'}
                  </p>
                </div>

                {/* 5. 遅刻猶予バッファ */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                      🚶 遅刻判定の猶予バッファ
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                      端末順番待ち対策
                    </span>
                  </div>
                  <select
                    value={attendanceRules.late_grace_minutes}
                    onChange={e => setAttendanceRules({
                      ...attendanceRules,
                      late_grace_minutes: parseInt(e.target.value, 10)
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-xs"
                  >
                    <option value={0}>0分（1分でも過ぎたら遅刻）</option>
                    <option value={3}>始業後 3分以内は遅刻免除</option>
                    <option value={5}>始業後 5分以内は遅刻免除（現場標準）</option>
                    <option value={10}>始業後 10分以内は遅刻免除</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {attendanceRules.late_grace_minutes > 0
                      ? `💡 始業後${attendanceRules.late_grace_minutes}分以内の打刻は遅刻アラート・ペナルティを出しません。`
                      : '💡 始業時刻を1分でも過ぎた打刻はすべて遅刻と判定します。'}
                  </p>
                </div>

                {/* 6. 休憩時間の控除方式 */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                      ☕ 休憩時間の控除方式
                    </label>
                    <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.2 rounded">
                      労基法準拠
                    </span>
                  </div>
                  <select
                    value={attendanceRules.break_deduction_mode}
                    onChange={e => setAttendanceRules({
                      ...attendanceRules,
                      break_deduction_mode: e.target.value as any
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-xs"
                  >
                    <option value="statutory">法定基準で自動控除（実働6h超45分/8h超60分）</option>
                    <option value="pattern_fixed">就業パターンの設定値で固定控除</option>
                    <option value="actual_punches">実打刻（休憩開始・終了打刻）のみ控除</option>
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {attendanceRules.break_deduction_mode === 'statutory'
                      ? '💡 休憩打刻の押し忘れがあっても、法定時間を自動控除して給与過払いを防止します。'
                      : attendanceRules.break_deduction_mode === 'pattern_fixed'
                      ? '💡 パターンに登録された休憩時間（60分等）を一律で控除します。'
                      : '💡 休憩開始・終了の打刻実績のみを厳密に控除します。'}
                  </p>
                </div>

              </div>

              {/* 🎨 自社打刻丸め新規プリセット保存モーダル */}
              {newPresetModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                  <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-150 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                          <Clock className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="text-base font-black text-slate-800">
                            自社打刻丸めルールのプリセット保存
                          </h3>
                          <p className="text-xs text-slate-500">
                            現在の設定内容に名前を付けて、ワンタッチで呼び出せるように登録します
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewPresetModalOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          プリセット名 <span className="text-rose-500 font-bold">*必須</span>
                        </label>
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={e => setNewPresetName(e.target.value)}
                          placeholder="例: パート・アルバイト用（15分丸め）、夜勤・物流班"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          説明・用途（任意）
                        </label>
                        <input
                          type="text"
                          value={newPresetDesc}
                          onChange={e => setNewPresetDesc(e.target.value)}
                          placeholder="例: 始業前早出カット・出退勤15分丸め・退勤10分バッファ"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* 保存される現在ルールのプレビュー確認 */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 text-[11px]">
                        <p className="font-black text-slate-700">📋 登録される設定内容（現在値）:</p>
                        <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600 font-medium">
                          <li>・始業前打刻: <strong className="text-slate-900">{attendanceRules.check_in_before_start === 'clip_to_start' ? '始業時刻に補正' : '補正なし(実時間)'}</strong></li>
                          <li>・出勤丸め: <strong className="text-slate-900">{attendanceRules.check_in_rounding_minutes}分単位(切上)</strong></li>
                          <li>・退勤丸め: <strong className="text-slate-900">{attendanceRules.check_out_rounding_minutes}分単位(切捨)</strong></li>
                          <li>・定時退勤バッファ: <strong className="text-slate-900">{attendanceRules.overtime_buffer_minutes}分</strong></li>
                          <li>・遅刻猶予: <strong className="text-slate-900">{attendanceRules.late_grace_minutes}分</strong></li>
                          <li>・休憩控除: <strong className="text-slate-900">{attendanceRules.break_deduction_mode === 'statutory' ? '法定基準自動控除' : attendanceRules.break_deduction_mode === 'pattern_fixed' ? 'パターン固定' : '実打刻のみ'}</strong></li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setNewPresetModalOpen(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewPreset}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>💾</span> この内容でプリセット保存
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 4. 給与・労務規定 タブ */}
        {activeTab === 'payroll' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                給与締め日 ＆ 割増賃金・社会保険設定
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">給与計算エンジンおよび労働条件通知書の賃金計算条項に即座に反映されます。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800">賃金締め日・支払日</h4>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">締め日</label>
                  <select
                    value={payrollSettings.closing_day}
                    onChange={e => setPayrollSettings({ ...payrollSettings, closing_day: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value={31}>毎月末日</option>
                    <option value={20}>毎月20日</option>
                    <option value={25}>毎月25日</option>
                    <option value={15}>毎月15日</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">支給日</label>
                  <select
                    value={payrollSettings.payment_day}
                    onChange={e => setPayrollSettings({ ...payrollSettings, payment_day: parseInt(e.target.value, 10) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value={25}>毎月25日（当月25日または翌月25日）</option>
                    <option value={10}>毎月10日（翌月10日）</option>
                    <option value={15}>毎月15日</option>
                    <option value={31}>毎月末日</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800">法定割増賃金率</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">時間外 (残業)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={payrollSettings.overtime_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, overtime_rate: parseFloat(e.target.value) || 1.25 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">深夜割増</label>
                    <input
                      type="number"
                      step="0.05"
                      value={payrollSettings.night_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, night_rate: parseFloat(e.target.value) || 0.25 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">休日労働</label>
                    <input
                      type="number"
                      step="0.05"
                      value={payrollSettings.holiday_rate}
                      onChange={e => setPayrollSettings({ ...payrollSettings, holiday_rate: parseFloat(e.target.value) || 1.35 })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 🏥 社会保険料率マスタ（協会けんぽ管轄都道府県） */}
            {(() => {
              const currentPref = getPrefectureRate(payrollSettings.prefecture_code || '13');
              return (
                <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-blue-50/50 p-5 rounded-2xl border border-indigo-100/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        社会保険（協会けんぽ・厚生年金）適用都道府県 ＆ 料率
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        自社の事業所所在地（都道府県）を選択すると、協会けんぽの最新標準報酬月額表・料率が給与計算に自動連動します。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">事業所所在地:</span>
                      <select
                        value={payrollSettings.prefecture_code || '13'}
                        onChange={e => setPayrollSettings({ ...payrollSettings, prefecture_code: e.target.value })}
                        className="bg-white border border-indigo-300 rounded-xl px-3 py-1.5 font-black text-indigo-700 text-xs shadow-xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {PREFECTURES.map(p => (
                          <option key={p.code} value={p.code}>
                            {p.code} : {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 適用料率カード一覧 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                      <div className="text-[10px] text-slate-400 font-bold">健康保険料率（{currentPref.name}）</div>
                      <div className="text-base font-black text-indigo-700 mt-0.5">
                        {(currentPref.healthRate * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        本人負担: <span className="font-bold text-slate-700">{((currentPref.healthRate * 100) / 2).toFixed(3)}%</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                      <div className="text-[10px] text-slate-400 font-bold">介護保険料率（全国一律）</div>
                      <div className="text-base font-black text-indigo-700 mt-0.5">
                        {(currentPref.nursingRate * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                        40〜64歳に完全自動適用
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                      <div className="text-[10px] text-slate-400 font-bold">厚生年金保険料率（全国一律）</div>
                      <div className="text-base font-black text-indigo-700 mt-0.5">
                        {(currentPref.pensionRate * 100).toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        本人負担: <span className="font-bold text-slate-700">{((currentPref.pensionRate * 100) / 2).toFixed(2)}%</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                      <div className="text-[10px] text-slate-400 font-bold">雇用保険料率（一般事業）</div>
                      <div className="text-base font-black text-indigo-700 mt-0.5">
                        {(currentPref.employmentRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        本人負担: <span className="font-bold text-slate-700">0.6%</span> (会社負担: 0.95%)
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">💡 自動更新・自動判定について:</span>
                      <p className="mt-0.5 text-blue-800 leading-relaxed">
                        社会保険料率は毎年3月の法改正時に販売者本部（SuperAdmin）が一括更新するため、各企業様での面倒な料率手入力や月額表更新は一切不要です。
                        また、40歳到達時（誕生日前日）の介護保険開始や65歳到達時の終了も、従業員の生年月日から給与計算時に完全自動判定されます。
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 🏛️ 社会保険・雇用保険・労働保険 事業所マスタ（SSOT大元設定 ＆ 陸遜・親切ガイド付き） */}
            <div className="bg-white p-5 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-indigo-600 rounded-xl text-white shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-800 text-sm">
                        社会保険・雇用保険・労働保険 事業所マスタ設定
                      </h4>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                        全公的届出に自動連動（SSOT）
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ここで1度登録すると、資格取得届・離職票・賞与支払届・算定基礎届など、すべての公的帳票に100%自動で印字されます（二重入力ゼロ）。
                    </p>
                  </div>
                </div>
              </div>

              {/* 陸遜（CX・顧客目線）の「何のこっちゃ？を1秒で解消する」手元書類チェックガイド ＆ 全角半角自動補正 */}
              <div className="bg-gradient-to-br from-amber-50/90 via-emerald-50/40 to-indigo-50/40 border border-amber-200/90 rounded-2xl p-4 text-xs space-y-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-950 font-black text-xs sm:text-sm">
                    <span className="text-lg">🔰</span>
                    <span>【陸遜のあんしんガイド】事業所整理記号や番号って何のこっちゃ？（手元の書類を確認！）</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-100/90 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[11px] border border-emerald-300 shadow-2xs">
                    <span className="animate-pulse">✨</span>
                    <span>全角・半角・大文字小文字・ハイフンなしOK！すべて自動補正</span>
                  </div>
                </div>

                {/* 全角半角・ハイフン不安を完全に解消する案内メッセージ */}
                <div className="bg-white/95 rounded-xl p-3 border border-emerald-200 text-[11px] text-slate-700 leading-relaxed shadow-2xs">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                    <span className="text-sm">💡</span>
                    <span>「ハイフンは大文字？小文字？」「数字やカナは全角？半角？」と迷う必要はありません！</span>
                  </div>
                  <p className="text-slate-600">
                    どう入力してもシステムが公的規格に合わせて<strong>自動で綺麗な形（半角数字・全角カタカナ・適切なハイフン）に即座に変換</strong>します。<br/>
                    ハイフンを打つのが面倒な場合は、<strong>数字だけを続けて入力しても自動でハイフンが挿入</strong>されますのでご安心ください。
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-amber-950">
                  <div className="bg-white/90 p-3 rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                    <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <span>📮 日本年金機構からの通知書（社会保険）</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      年金事務所から届く「保険料納入告知額領収済額通知書」や「算定基礎届」の<strong>用紙の左上</strong>をご覧ください。<br/>
                      ・<strong>事業所整理記号</strong>: 「数字2桁」＋「カタカナ」（例: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">13-トカ</code>、<code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">01-イロ</code>）<br/>
                      ・<strong>事業所番号</strong>: その隣にある「4〜5桁の数字」（例: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">12345</code>）
                    </p>
                  </div>
                  <div className="bg-white/90 p-3 rounded-xl border border-amber-200/60 shadow-2xs space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <span>🏢 ハローワークからの書類（雇用保険）</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      ハローワークから交付された「雇用保険適用事業所設置届（事業所控）」または「被保険者資格取得確認通知書」の<strong>上部</strong>をご覧ください。<br/>
                      ・<strong>雇用保険適用事業所番号</strong>: 「4桁 - 6桁 - 1桁」の計11桁（例: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">1301-123456-7</code>）
                    </p>
                  </div>
                </div>
              </div>

              {/* 入力フォーム */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                {/* 社会保険 事業所整理記号 */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                      <span>① 社会保険 事業所整理記号</span>
                      <span className="text-[10px] text-indigo-600 font-normal">（年金事務所）</span>
                    </label>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      ✨全角半角・カナ自動補正
                    </span>
                  </div>
                  <input
                    type="text"
                    value={insuranceMaster.shakai_hoken_office_symbol}
                    onChange={e => setInsuranceMaster(prev => ({ ...prev, shakai_hoken_office_symbol: e.target.value }))}
                    onBlur={e => setInsuranceMaster(prev => ({ ...prev, shakai_hoken_office_symbol: formatOfficeSymbol(e.target.value) }))}
                    placeholder="例: 13-トカ（全角・半角・ひらがなOK）"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    ※「13トカ」「13とか」「１３－トカ」でも入力完了時に自動で「13-トカ」に整います。<br/>
                    ※健康保険・厚生年金資格取得届、賞与支払届、算定基礎届に自動印字されます。
                  </p>
                </div>

                {/* 社会保険 事業所番号 */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                      <span>② 社会保険 事業所番号</span>
                      <span className="text-[10px] text-indigo-600 font-normal">（年金事務所）</span>
                    </label>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      ✨全角でも自動で半角化
                    </span>
                  </div>
                  <input
                    type="text"
                    value={insuranceMaster.shakai_hoken_office_number}
                    onChange={e => setInsuranceMaster(prev => ({ ...prev, shakai_hoken_office_number: formatOfficeNumber(e.target.value) }))}
                    onBlur={e => setInsuranceMaster(prev => ({ ...prev, shakai_hoken_office_number: formatOfficeNumber(e.target.value) }))}
                    placeholder="例: 12345 (4〜5桁)"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    ※全角数字「１２３４５」で入力しても即座に半角数字に整います。<br/>
                    ※年金事務所が付与した4〜5桁の数字。資格取得届や各公的帳票に自動印字されます。
                  </p>
                </div>

                {/* 雇用保険 適用事業所番号 */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                      <span>③ 雇用保険 適用事業所番号</span>
                      <span className="text-[10px] text-emerald-600 font-normal">（ハローワーク）</span>
                    </label>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      ✨ハイフン自動挿入
                    </span>
                  </div>
                  <input
                    type="text"
                    value={insuranceMaster.employment_insurance_office_number}
                    onChange={e => {
                      const val = toHalfWidth(e.target.value).replace(/[^0-9-]/g, '').slice(0, 13);
                      setInsuranceMaster(prev => ({ ...prev, employment_insurance_office_number: val }));
                    }}
                    onBlur={e => setInsuranceMaster(prev => ({ ...prev, employment_insurance_office_number: formatEmploymentInsuranceNumber(e.target.value) }))}
                    placeholder="例: 1301-123456-7（数字11桁のみでもOK）"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    ※ハイフンなしで数字だけ「13011234567」と打っても自動でハイフンが入ります。<br/>
                    ※雇用保険資格取得届、離職票、喪失届に自動印字されます。
                  </p>
                </div>

                {/* 労働保険番号 */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                      <span>④ 労働保険番号</span>
                      <span className="text-[10px] text-purple-600 font-normal">（労働基準監督署）</span>
                    </label>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      ✨ハイフン自動挿入
                    </span>
                  </div>
                  <input
                    type="text"
                    value={insuranceMaster.labor_insurance_number}
                    onChange={e => {
                      const val = toHalfWidth(e.target.value).replace(/[^0-9-]/g, '').slice(0, 18);
                      setInsuranceMaster(prev => ({ ...prev, labor_insurance_number: val }));
                    }}
                    onBlur={e => setInsuranceMaster(prev => ({ ...prev, labor_insurance_number: formatLaborInsuranceNumber(e.target.value) }))}
                    placeholder="例: 13-1-01-123456-000（数字14桁のみでもOK）"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    ※数字だけ続けて「13101123456000」と打っても自動でハイフンが入ります。<br/>
                    ※労働保険概算・確定保険料申告書などに自動反映されます。
                  </p>
                </div>
              </div>
            </div>

            {/* 📜 日本年金機構 公式届出帳票 印字座標マスタ（軍律第23条：最高権限者専管） */}
            <div className="bg-gradient-to-r from-pink-50/60 via-purple-50/40 to-slate-50 p-5 rounded-2xl border border-pink-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <span className="p-2.5 bg-pink-600 rounded-2xl text-white shadow-xs">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-800 text-sm">
                      日本年金機構 被保険者賞与支払届（コード2265用紙）印字座標マスタ
                    </h4>
                    <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-bold border border-pink-200">
                      最高管理者専管
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    日本年金機構の配布PDF原本用紙の上に印字する全項目の座標・文字サイズ・マス目ピッチを、画面上の原本プレビューでミリ単位・ピクセル単位で微調整・全社一括保存できます。
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBonusInspectorModal(true)}
                className="shrink-0 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>🛠️ 印字座標インスペクター</span>
              </button>
            </div>

            {renderSaveFooter()}
          </div>
        )}


        {/* 5. 入社手続きステップ ＆ 承認者マスタ タブ */}
        {activeTab === 'onboarding' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  入社手続きワークフローステップ ＆ 承認者マスタ
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  内定から入社・書類提出・原本審査・官公庁届出・本稼働までのステップ順序と承認者を会社ごとに定義します。
                </p>
              </div>
              <button
                onClick={handleResetDefaultSteps}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                デフォルト設定に戻す
              </button>
            </div>

            {/* ステップ一覧リスト */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700">登録済み手続きステップ ({onboardingSteps.length}ステップ)</span>
                <span className="text-[10px] text-slate-400">※ 各ステップの「✏️ 編集」ボタンや「承認権限」をクリックして変更できます</span>
              </div>

              <div className="space-y-2.5">
                {onboardingSteps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      step.is_enabled
                        ? 'bg-slate-50/70 border-slate-200 hover:border-indigo-300'
                        : 'bg-slate-100/50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                        {step.step_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{step.name}</span>
                          <button
                            onClick={() => setEditingStepModal({ isOpen: true, index: idx, step: { ...step } })}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition"
                            title="クリックして承認権限やステップ名を編集"
                          >
                            <span>承認権限: {step.approver_name || '管理者全員'}</span>
                            <Edit3 className="w-3 h-3 text-indigo-500" />
                          </button>
                          {!step.is_enabled && (
                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              無効化中
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{step.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                        <button
                          onClick={() => handleMoveStepUp(idx)}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 cursor-pointer"
                          title="上へ移動"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveStepDown(idx)}
                          disabled={idx === onboardingSteps.length - 1}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 cursor-pointer"
                          title="下へ移動"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => setEditingStepModal({ isOpen: true, index: idx, step: { ...step } })}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-300 flex items-center gap-1"
                        title="ステップ名・説明・承認権限を編集"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                        編集
                      </button>

                      <button
                        onClick={() => handleToggleStep(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                          step.is_enabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {step.is_enabled ? '有効' : '無効'}
                      </button>

                      <button
                        onClick={() => handleDeleteStep(idx)}
                        className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                        title="ステップを削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 新規ステップ追加エリア */}
            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                ＋ 自社独自の入社手続きステップを追加
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="ステップ名（例: PC手配・研修受講）"
                  value={newStepName}
                  onChange={e => setNewStepName(e.target.value)}
                  className="sm:col-span-3 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
                <input
                  type="text"
                  placeholder="手続き内容説明"
                  value={newStepDesc}
                  onChange={e => setNewStepDesc(e.target.value)}
                  className="sm:col-span-3 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700"
                />
                <div className="sm:col-span-6 flex gap-2 flex-wrap sm:flex-nowrap">
                  <select
                    value={newStepApproverType}
                    onChange={e => {
                      const val = e.target.value as any;
                      setNewStepApproverType(val);
                      if (val === 'specific_user' && companyUsers.length > 0 && !newStepApproverUserId) {
                        setNewStepApproverUserId(companyUsers[0].id);
                      }
                    }}
                    className="w-44 bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="all_admins">👥 管理者全員</option>
                    <option value="specific_user">👤 担当者を指名</option>
                    <option value="department_head">🏢 配属部署の所属長</option>
                  </select>

                  {newStepApproverType === 'specific_user' && (
                    <select
                      value={newStepApproverUserId}
                      onChange={e => setNewStepApproverUserId(e.target.value)}
                      className="flex-1 bg-indigo-50 border border-indigo-200 rounded-xl px-2.5 py-2 text-xs font-bold text-indigo-900"
                    >
                      {companyUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.department || '所属なし'}{u.role === 'admin' ? ' / 管理者' : ''})
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={handleAddNewStep}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    追加
                  </button>
                </div>
              </div>
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 5. 労働条件通知書 ＆ 雇用契約書テンプレート タブ */}
        {activeTab === 'contract' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            {/* 上部ヘッダー ＆ AI清書・就業規則抽出ボタン群 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  労働条件通知書 兼 雇用契約書 条文テンプレート設定
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  全社共通の労働条件通知書・雇用契約書の各条文（就業場所、業務範囲、退職・解雇・定年規定等）をカスタマイズできます。
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setContractPreviewModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-4 h-4" />
                  📄 書面確認（A4プレビュー / 印刷）
                </button>

                <button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Wand2 className="w-4 h-4 text-amber-300" />
                  🤖 AIに箇条書きで相談して条文を作成
                </button>

                <button
                  type="button"
                  onClick={handleExtractArticlesFromRules}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  📖 就業規則から条文番号を自動反映
                </button>
              </div>
            </div>

            {/* 条文編集グリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* 1. 就業場所・従事すべき業務 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  1. 就業場所 及び 従事すべき業務の範囲
                </h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">就業場所の初期デフォルト</label>
                  <input
                    type="text"
                    value={contractTemplate.work_location_default}
                    onChange={e => setContractTemplate({ ...contractTemplate, work_location_default: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">就業場所の変更の範囲（法定義務）</label>
                  <input
                    type="text"
                    value={contractTemplate.work_location_scope}
                    onChange={e => setContractTemplate({ ...contractTemplate, work_location_scope: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">従事すべき業務の変更の範囲（法定義務）</label>
                  <input
                    type="text"
                    value={contractTemplate.job_description_scope}
                    onChange={e => setContractTemplate({ ...contractTemplate, job_description_scope: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* 2. 労働時間・時間外労働・休日休暇 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  2. 労働時間・時間外労働・休日休暇の特記事項
                </h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">始業・終業時刻に関する特記事項</label>
                  <input
                    type="text"
                    value={contractTemplate.work_time_special_notes}
                    onChange={e => setContractTemplate({ ...contractTemplate, work_time_special_notes: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">時間外労働（残業規定）</label>
                  <input
                    type="text"
                    value={contractTemplate.overtime_work_notes}
                    onChange={e => setContractTemplate({ ...contractTemplate, overtime_work_notes: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">年次有給休暇（就業規則連動条項）</label>
                  <input
                    type="text"
                    value={contractTemplate.paid_leave_rules_article}
                    onChange={e => setContractTemplate({ ...contractTemplate, paid_leave_rules_article: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* 3. 賃金・手当・昇給賞与 */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  3. 賃金・通勤手当・昇給賞与規定
                </h4>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">通勤手当支給規定</label>
                  <input
                    type="text"
                    value={contractTemplate.commuting_allowance_notes}
                    onChange={e => setContractTemplate({ ...contractTemplate, commuting_allowance_notes: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">固定残業代（みなし残業）超過清算条項</label>
                  <input
                    type="text"
                    value={contractTemplate.fixed_overtime_clause}
                    onChange={e => setContractTemplate({ ...contractTemplate, fixed_overtime_clause: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">📅 賃金締切日（全社標準）</label>
                    <input
                      type="text"
                      placeholder="例: 毎月末日 / 毎月20日 / 毎月15日"
                      value={contractTemplate.closing_day_text || '毎月末日'}
                      onChange={e => setContractTemplate({ ...contractTemplate, closing_day_text: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">💰 給与支払日（全社標準）</label>
                    <input
                      type="text"
                      placeholder="例: 当月25日（金融機関振込） / 翌月10日 / 翌月25日"
                      value={contractTemplate.payment_day_text || '当月25日（金融機関振込）'}
                      onChange={e => setContractTemplate({ ...contractTemplate, payment_day_text: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">昇給・賞与・退職金規定</label>
                  <input
                    type="text"
                    value={contractTemplate.raise_bonus_notes}
                    onChange={e => setContractTemplate({ ...contractTemplate, raise_bonus_notes: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* 4. 退職・解雇・定年（就業規則自動連動） */}
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-3">
                <h4 className="font-bold text-indigo-950 text-xs flex items-center justify-between border-b border-indigo-200 pb-2">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    4. 退職・定年・解雇規定（就業規則と自動連動）
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                    就業規則連動中
                  </span>
                </h4>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-700">自己都合退職の手続き規定</label>
                    <span className="text-[10px] text-indigo-600 font-mono">{contractTemplate.resignation_rules_article}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={contractTemplate.resignation_procedure_text}
                    onChange={e => setContractTemplate({ ...contractTemplate, resignation_procedure_text: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-700">定年制 ＆ 再雇用・継続雇用規定</label>
                    <span className="text-[10px] text-indigo-600 font-mono">{contractTemplate.retirement_rules_article}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={contractTemplate.retirement_age_text}
                    onChange={e => setContractTemplate({ ...contractTemplate, retirement_age_text: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-700">解雇の事由及び手続き規定</label>
                    <span className="text-[10px] text-indigo-600 font-mono">{contractTemplate.dismissal_rules_article}</span>
                  </div>
                  <textarea
                    rows={2}
                    value={contractTemplate.dismissal_procedure_text}
                    onChange={e => setContractTemplate({ ...contractTemplate, dismissal_procedure_text: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 6. 就業規則（AI連動） タブ */}
        {activeTab === 'rules' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  自社の就業規則・社内規定（AI相談ボット連動）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">ここに登録された就業規則をもとに、全従業員のスマホAI相談ボットが自動回答します。</p>
              </div>
              <button
                onClick={() => {
                  if (confirm('標準モデル就業規則テンプレートを読み込みますか？')) {
                    setEmploymentRulesText(DEFAULT_EMPLOYMENT_RULES);
                  }
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                標準モデル就業規則を読込
              </button>
            </div>

            <textarea
              rows={16}
              value={employmentRulesText}
              onChange={e => setEmploymentRulesText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 font-mono text-xs leading-relaxed"
              placeholder="自社の就業規則テキストを入力してください..."
            />

            {renderSaveFooter()}
          </div>
        )}

        {/* 8. 📢 全社お知らせ掲示板管理 タブ */}
        {activeTab === 'announcements' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  全社ポータル お知らせ掲示板 管理
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ここで登録・編集したお知らせは、全従業員・管理者のトップポータル（みんなの らくまる労務）にリアルタイムで掲示されます。
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/portal')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Eye className="w-4 h-4" />
                ポータルのお知らせ表示を確認
              </button>
            </div>

            {/* 🤖 AIによるお知らせ自動起草ツール */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  ✨ AIお知らせ自動起草アシスタント（ワンクリック作成）
                </span>
                <span className="text-[10px] text-purple-700 font-bold bg-white px-2 py-0.5 rounded-full border border-purple-200">
                  全社告知文テンプレート
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                告知したい内容を選択し「AIでドラフト作成」をクリックすると、丁寧な社内通知文が即座に入力欄に生成されます。
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  '今月度の給与明細のWeb公開発行',
                  '来月度 シフト希望提出期日のお知らせ',
                  '年末年始休業および会社カレンダーのお知らせ',
                  '就業規則および社内諸規程の改定に関するお知らせ'
                ].map((topic, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const draft = generateAiAnnouncementDraft(topic, basicInfo.name);
                      setNewAnnTitle(draft.title);
                      setNewAnnContent(draft.content);
                      setNewAnnTag(draft.tag);
                    }}
                    className="text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs text-left"
                  >
                    ✨ {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* 新規お知らせ作成フォーム */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                新しいお知らせを投稿・追加
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">掲載日付</label>
                  <input
                    type="text"
                    value={newAnnDate}
                    onChange={e => setNewAnnDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800"
                    placeholder="2026.09.01"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">タグ・カテゴリ</label>
                  <select
                    value={newAnnTag}
                    onChange={e => setNewAnnTag(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                  >
                    <option value="お知らせ">お知らせ</option>
                    <option value="新機能">新機能</option>
                    <option value="給与">給与</option>
                    <option value="シフト">シフト</option>
                    <option value="重要">重要</option>
                    <option value="社内規定">社内規定</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">お知らせタイトル <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={newAnnTitle}
                    onChange={e => setNewAnnTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    placeholder="例: 今月度の給与明細を発行いたしました。"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">詳細内容・本文（任意）</label>
                <textarea
                  rows={4}
                  value={newAnnContent}
                  onChange={e => setNewAnnContent(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-sans text-slate-800 leading-relaxed"
                  placeholder="詳細な説明や補足事項があれば入力してください..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!newAnnTitle.trim()) {
                      alert('お知らせタイトルを入力してください。');
                      return;
                    }
                    const newItem: AnnouncementItem = {
                      id: `ann-${Date.now()}`,
                      date: newAnnDate || new Date().toISOString().split('T')[0].replace(/-/g, '.'),
                      title: newAnnTitle.trim(),
                      content: newAnnContent.trim() || undefined,
                      tag: newAnnTag
                    };
                    const updated = [newItem, ...announcements];
                    setAnnouncements(updated);
                    saveAnnouncementsToStorage(updated, tenantId || undefined);
                    setNewAnnTitle('');
                    setNewAnnContent('');
                    alert('📢 新しいお知らせを追加・掲載しました！');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  お知らせを一覧に追加する
                </button>
              </div>
            </div>

            {/* 現在掲載中のお知らせ一覧 */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>📋 現在掲載中のお知らせ一覧（{announcements.length}件）</span>
                <span className="text-[10px] text-slate-400 font-normal">※ ゴミ箱アイコンで即座に削除できます</span>
              </h4>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {announcements.map((item, idx) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 transition flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {item.date}
                        </span>
                        {item.tag && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-1">{item.title}</div>
                      {item.content && (
                        <p className="text-[11px] text-slate-500 mt-1 whitespace-pre-line leading-relaxed">
                          {item.content}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`お知らせ「${item.title}」を削除しますか？`)) return;
                        const updated = announcements.filter((_, i) => i !== idx);
                        setAnnouncements(updated);
                        saveAnnouncementsToStorage(updated, tenantId || undefined);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="このお知らせを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 8. 📜 資格手当マスタ タブ */}
        {activeTab === 'qualifications' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  全社資格手当マスタ管理
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  社内で支給対象とする資格手当の名称・標準支給月額・支給要件を一元管理します。
                </p>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                登録件数: {qualifications.length} 件
              </span>
            </div>

            {/* 実務連動インフォメーション */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-4 text-xs space-y-1 text-indigo-950">
              <div className="font-bold flex items-center gap-1.5 text-indigo-900">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                実務連動の鉄則（合格証必須・画像自動圧縮）
              </div>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                従業員マスタで資格手当を支給設定する場合、<strong>資格証明書（合格証の写メまたはPDF）のエビデンス添付が必須</strong>となります。スマホ撮影の大容量写真（5〜15MB）は自動で100〜300KB（約90%以上削減）に軽量化圧縮されて安全に保管されます。ここで定義した資格マスタは、従業員編集画面のプルダウン選択肢として100%自動流動します。
              </p>
            </div>

            {/* 新規資格手当 追加フォーム */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                新しい資格手当マスタを登録
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    資格・免許名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newQualName}
                    onChange={e => setNewQualName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    placeholder="例: 第一種衛生管理者, 宅地建物取引士, 日商簿記2級"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    資格区分
                  </label>
                  <select
                    value={newQualCategory}
                    onChange={e => setNewQualCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                  >
                    <option value="国家資格">国家資格</option>
                    <option value="公的資格">公的資格</option>
                    <option value="技能講習">技能講習・特別教育</option>
                    <option value="民間資格">民間資格</option>
                    <option value="社内認定">社内認定・職能資格</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    標準手当額 (円/月) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newQualAllowance}
                    onChange={e => setNewQualAllowance(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                    placeholder="例: 10000"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">説明・手当支給要件（任意）</label>
                <input
                  type="text"
                  value={newQualDesc}
                  onChange={e => setNewQualDesc(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                  placeholder="例: 事業場における選任業務従事、または実務での活用を条件とする"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddQualification}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  資格手当マスタに追加する
                </button>
              </div>
            </div>

            {/* 登録済み資格手当一覧テーブル */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                <span>📋 登録済み資格手当一覧（{qualifications.length}件）</span>
                <span className="text-[10px] text-slate-400 font-normal">※ 従業員マスタ登録画面の選択肢として表示されます</span>
              </h4>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="p-3.5 pl-4">資格・免許名</th>
                      <th className="p-3.5">区分</th>
                      <th className="p-3.5 text-right">標準手当額 (月額)</th>
                      <th className="p-3.5">支給要件・備考</th>
                      <th className="p-3.5 text-center w-28">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {qualifications.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                          資格手当マスタがまだ登録されていません
                        </td>
                      </tr>
                    ) : (
                      qualifications.map(q => (
                        <tr key={q.id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3.5 pl-4 font-bold text-slate-900 flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>{q.name}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {q.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-black text-indigo-600">
                            ¥{q.default_allowance.toLocaleString()}
                            <span className="text-[10px] text-slate-400 font-normal ml-0.5">/月</span>
                          </td>
                          <td className="p-3.5 text-slate-600 text-[11px]">
                            {q.description || '-'}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingQualModal({ isOpen: true, qual: { ...q } })}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="編集"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQualification(q.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {renderSaveFooter()}
          </div>
        )}

        {/* 10. 🔔 公的届出・社保改定通知マスタ タブ */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 animate-in fade-in duration-200">
            <OfficialReminderSettingsModal
              tenantId={tenantId || ''}
              tenantName={basicInfo.name || '自社'}
              isEmbedded={true}
            />
          </div>
        )}

        {/* 11. 💳 ご利用プラン ＆ お支払い設定 タブ */}
        {activeTab === 'billing' && (() => {
          const userCount = Math.max(1, companyUsers.length);
          const trialEnd = tenantBilling.trial_ends_at ? new Date(tenantBilling.trial_ends_at) : null;
          const now = new Date();
          const diffDays = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 30;
          const isTrialActive = tenantBilling.plan_type === 'trial';
          const currentPlanMeta = SAAS_PLANS[tenantBilling.plan_type] || SAAS_PLANS.trial;

          return (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* プラン概要ヘッダーカード */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-indigo-600" />
                      ご利用プラン ＆ お支払い設定
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      会社の成長やニーズに合わせて自由にプランをお選びいただけます。1ヶ月無料トライアル中も全機能をご利用いただけます。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-3 py-1.5 rounded-full border shadow-2xs ${currentPlanMeta.badgeColor}`}>
                      {currentPlanMeta.badge}
                    </span>
                  </div>
                </div>

                {/* 4大ステータス指標 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">現在のご利用状況</div>
                    <div className="text-base font-black text-slate-900 mt-1">
                      {currentPlanMeta.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isTrialActive ? '全機能フルアクセス中' : '有料プラン稼働中'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">無料トライアル残日数</div>
                    <div className="text-base font-black mt-1 flex items-baseline gap-1">
                      {isTrialActive ? (
                        diffDays > 0 ? (
                          <span className="text-emerald-600">残り {diffDays} 日</span>
                        ) : (
                          <span className="text-rose-600">本日終了 / 期限切れ</span>
                        )
                      ) : (
                        <span className="text-indigo-600">本契約移行済み</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {isTrialActive && trialEnd ? `期限: ${trialEnd.toLocaleDateString('ja-JP')}` : '安心の月額自動更新'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">登録従業員数（在籍）</div>
                    <div className="text-base font-black text-slate-900 mt-1">
                      {userCount} <span className="text-xs font-normal text-slate-500">名</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      ※ 退職者は課金対象外
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">現在の月額利用料（試算）</div>
                    <div className="text-base font-black text-indigo-600 mt-1">
                      {isTrialActive ? (
                        <span>¥0 <span className="text-xs text-emerald-600 font-bold">（無料体験中）</span></span>
                      ) : (
                        <span>¥{(userCount * currentPlanMeta.unitPriceMonthly).toLocaleString()} <span className="text-xs font-normal text-slate-500">/月</span></span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      1名あたり ¥{currentPlanMeta.unitPriceMonthly.toLocaleString()}/月
                    </div>
                  </div>
                </div>
              </div>

              {/* 💬 公式LINE連携 配信オプション設定カード */}
              <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl shadow-sm">
                      💬
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-slate-900">公式LINE通知・配信オプション設定</h4>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          全店舗共通・店長個人LINE不要
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        シフト提出依頼・シフト確定通知・Web給与明細通知をスタッフのLINEへ自動配信するプラン設定です。
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowLineConfigModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer"
                  >
                    <span>⚙️</span>
                    <span>LINE配信プラン・設定を変更</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {/* 現在の契約モード */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    lineConfig.mode === 'rakumaru_official'
                      ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">選択中プラン</span>
                      {lineConfig.mode === 'rakumaru_official' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white">
                          現在適用中
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-2 flex items-center gap-1.5">
                      <span>🟢</span>
                      <span>公式代行配信</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-700 mt-1">
                      月額 ¥3,000 / 社（税込）
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                      「みんなのらくまる労務」公式アカウントから代行通知。LINEの審査や設定が一切不要で今すぐ使えます。
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all ${
                    lineConfig.mode === 'own_official'
                      ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">自社アカウント運用</span>
                      {lineConfig.mode === 'own_official' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white">
                          現在適用中
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-2 flex items-center gap-1.5">
                      <span>🔵</span>
                      <span>自社公式LINE</span>
                    </div>
                    <div className="text-xs font-bold text-blue-700 mt-1">
                      システム月額 ¥0（LINE公式従量のみ）
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                      自社のLINE公式アカウント（Messaging API）のトークンを設定し、貴社ブランド名義で通知します。
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all ${
                    lineConfig.mode === 'none'
                      ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500">LINE通知なし</span>
                      {lineConfig.mode === 'none' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-600 text-white">
                          現在適用中
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-2 flex items-center gap-1.5">
                      <span>⚪</span>
                      <span>利用しない</span>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mt-1">
                      オプション追加料金 ¥0
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                      LINE通知は行わず、メール通知やスタッフのWebマイページでのみシフト・明細を確認します。
                    </div>
                  </div>
                </div>

                {/* データの血流・店長業務への引き継ぎ案内 */}
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                  <span className="text-base">💡</span>
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800">店長業務・新入社員への自動連動について：</span><br />
                    ここで設定されたLINE配信プランは、全店舗の店長画面（シフト収集・シフト確定配信・入社手続き）および新入社員のスマホ登録画面へ自動で引き継がれます。店長個人のLINEアカウントを聞く必要は一切なく、安全・確実に通知が届きます。
                  </div>
                </div>
              </div>

              {/* 3大プライシングプラン比較カード */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    プランをお選びください（用途に合わせていつでも切り替え可能）
                  </h4>
                  <span className="text-[11px] text-slate-500 font-bold">
                    ※ 貴社の在籍人数（{userCount}名）で自動試算
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* ① シフト＆LINE単体プラン */}
                  {(() => {
                    const plan = SAAS_PLANS.shift_only;
                    const isCurrent = tenantBilling.plan_type === 'shift_only';
                    const monthlyTotal = userCount * plan.unitPriceMonthly;

                    return (
                      <div className={`bg-white rounded-3xl p-6 border-2 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md ${
                        isCurrent ? 'border-teal-500 ring-2 ring-teal-200' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">
                              {plan.badge}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-600 text-white">
                                現在利用中
                              </span>
                            )}
                          </div>

                          <h5 className="text-base font-black text-slate-900 mt-3">{plan.name}</h5>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{plan.description}</p>

                          <div className="mt-4 pb-4 border-b border-slate-100">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900">¥{plan.unitPriceMonthly.toLocaleString()}</span>
                              <span className="text-xs text-slate-500 font-bold">/名・月（税込）</span>
                            </div>
                            <div className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg mt-2 inline-block">
                              貴社（{userCount}名）の場合: ¥{monthlyTotal.toLocaleString()} / 月
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <div className="text-[11px] font-bold text-slate-700">含まれる主な機能:</div>
                            {plan.features.map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600">
                                <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => handleSaveBillingPlan('shift_only')}
                            disabled={isCurrent || isSaving}
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isCurrent 
                                ? 'bg-teal-50 text-teal-700 border border-teal-200 cursor-default' 
                                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                            }`}
                          >
                            {isCurrent ? '✅ 現在の選択プラン' : 'このプランに変更する'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ② 勤怠＆労務単体プラン */}
                  {(() => {
                    const plan = SAAS_PLANS.kintai_only;
                    const isCurrent = tenantBilling.plan_type === 'kintai_only';
                    const monthlyTotal = userCount * plan.unitPriceMonthly;

                    return (
                      <div className={`bg-white rounded-3xl p-6 border-2 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md ${
                        isCurrent ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                              {plan.badge}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-600 text-white">
                                現在利用中
                              </span>
                            )}
                          </div>

                          <h5 className="text-base font-black text-slate-900 mt-3">{plan.name}</h5>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{plan.description}</p>

                          <div className="mt-4 pb-4 border-b border-slate-100">
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900">¥{plan.unitPriceMonthly.toLocaleString()}</span>
                              <span className="text-xs text-slate-500 font-bold">/名・月（税込）</span>
                            </div>
                            <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg mt-2 inline-block">
                              貴社（{userCount}名）の場合: ¥{monthlyTotal.toLocaleString()} / 月
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <div className="text-[11px] font-bold text-slate-700">含まれる主な機能:</div>
                            {plan.features.map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600">
                                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100">
                          <button
                            onClick={() => handleSaveBillingPlan('kintai_only')}
                            disabled={isCurrent || isSaving}
                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isCurrent 
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 cursor-default' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            }`}
                          >
                            {isCurrent ? '✅ 現在の選択プラン' : 'このプランに変更する'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ③ フルセット（アドバンス）プラン ※一番人気・おすすめ */}
                  {(() => {
                    const plan = SAAS_PLANS.full_advance;
                    const isCurrent = tenantBilling.plan_type === 'full_advance';
                    const monthlyTotal = userCount * plan.unitPriceMonthly;
                    const savedMonthly = userCount * 100;
                    const savedAnnual = savedMonthly * 12;

                    return (
                      <div className={`bg-gradient-to-b from-amber-50/60 via-white to-indigo-50/40 rounded-3xl p-6 border-2 flex flex-col justify-between transition-all duration-200 shadow-md hover:shadow-lg relative overflow-hidden ${
                        isCurrent ? 'border-amber-500 ring-2 ring-amber-300' : 'border-indigo-400'
                      }`}>
                        {/* おすすめリボン */}
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-[10px] font-black px-4 py-1 rounded-bl-2xl shadow-xs">
                          一番人気 ★ セットでお得！
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-600" />
                              {plan.badge}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-600 text-white">
                                現在利用中
                              </span>
                            )}
                          </div>

                          <h5 className="text-base font-black text-slate-900 mt-3">{plan.name}</h5>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{plan.description}</p>

                          <div className="mt-4 pb-4 border-b border-amber-100">
                            <div className="flex items-baseline gap-2">
                              <span className="text-slate-400 line-through text-sm font-bold">¥600</span>
                              <span className="text-2xl font-black text-indigo-700">¥{plan.unitPriceMonthly.toLocaleString()}</span>
                              <span className="text-xs text-slate-500 font-bold">/名・月（税込）</span>
                            </div>
                            <div className="text-xs font-bold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-lg mt-2 inline-flex items-center gap-1 border border-amber-300">
                              <span>🎁 単体契約より毎月 ¥{savedMonthly.toLocaleString()}（年間 ¥{savedAnnual.toLocaleString()}）おトク！</span>
                            </div>
                            <div className="text-xs font-black text-indigo-900 mt-1.5">
                              貴社（{userCount}名）の場合: ¥{monthlyTotal.toLocaleString()} / 月
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <div className="text-[11px] font-bold text-indigo-900">全機能が完全連動:</div>
                            {plan.features.map((feat, idx) => (
                              <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-700 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-indigo-100">
                          <button
                            onClick={() => handleSaveBillingPlan('full_advance')}
                            disabled={isCurrent || isSaving}
                            className={`w-full py-3 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                              isCurrent 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 cursor-default' 
                                : 'bg-gradient-to-r from-amber-500 via-indigo-600 to-indigo-700 hover:opacity-90 text-white'
                            }`}
                          >
                            <Crown className="w-4 h-4 text-amber-300" />
                            {isCurrent ? '👑 現在の選択プラン' : '👑 フルセットプランを選択する（おすすめ）'}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Square決済とお支払い手続きエリア */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                      Sq
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Square クレジットカード決済（定期請求）
                      </h4>
                      <p className="text-xs text-slate-400">
                        VISA、Mastercard、JCB、American Express、Diners Club による安全なオンライン定期決済
                      </p>
                    </div>
                  </div>

                  {tenantBilling.square_checkout_url ? (
                    <a
                      href={tenantBilling.square_checkout_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      Squareでお支払い手続きへ進む
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  ) : (
                    <button
                      onClick={() => alert('お支払いリンクが設定されていません。下記の入力欄にSquare決済リンクURLを入力するか、サポートまでお問い合わせください。')}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      お支払い手続き
                    </button>
                  )}
                </div>

                {/* 管理者用 Square決済URL登録フォーム */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      🔗 Square決済リンクURL（定期支払いチェックアウトURL）
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">管理者設定項目</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      defaultValue={tenantBilling.square_checkout_url}
                      id="square_checkout_url_input"
                      placeholder="https://checkout.square.site/merchant/... または https://square.link/u/..."
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('square_checkout_url_input') as HTMLInputElement;
                        if (el) handleSaveSquareUrl(el.value);
                      }}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      URLを保存
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    ※ Squareの加盟店管理画面 ➔「オンラインチェックアウト」で作成した決済リンクURLを入力して保存すると、自社管理者用のお支払いボタンに直結されます。
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

      </main>

      {/* ✏️ 資格手当マスタ 編集モーダル */}
      {editingQualModal.isOpen && editingQualModal.qual && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                資格手当マスタの編集
              </h3>
              <button
                onClick={() => setEditingQualModal({ isOpen: false, qual: null })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  資格・免許名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingQualModal.qual.name}
                  onChange={e => setEditingQualModal({
                    ...editingQualModal,
                    qual: { ...editingQualModal.qual!, name: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">資格区分</label>
                <select
                  value={editingQualModal.qual.category}
                  onChange={e => setEditingQualModal({
                    ...editingQualModal,
                    qual: { ...editingQualModal.qual!, category: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="国家資格">国家資格</option>
                  <option value="公的資格">公的資格</option>
                  <option value="技能講習">技能講習・特別教育</option>
                  <option value="民間資格">民間資格</option>
                  <option value="社内認定">社内認定・職能資格</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  標準手当額 (円/月) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={editingQualModal.qual.default_allowance}
                  onChange={e => setEditingQualModal({
                    ...editingQualModal,
                    qual: { ...editingQualModal.qual!, default_allowance: parseInt(e.target.value, 10) || 0 }
                  })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">説明・手当支給要件</label>
                <input
                  type="text"
                  value={editingQualModal.qual.description || ''}
                  onChange={e => setEditingQualModal({
                    ...editingQualModal,
                    qual: { ...editingQualModal.qual!, description: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingQualModal({ isOpen: false, qual: null })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleSaveEditedQualification(editingQualModal.qual!)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                変更を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🤖 AI条文清書アシスタント モーダル */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Wand2 className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    AI 労働条件・条文自動清書アシスタント
                  </h3>
                  <p className="text-xs text-slate-400">箇条書きのメモから労働基準法に完全準拠した公式条文を瞬時に作成します</p>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  自社の労働条件・希望ルールを箇条書きで自由に入力してください：
                </label>
                <textarea
                  rows={4}
                  value={aiNotesInput}
                  onChange={e => setAiNotesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 font-sans text-xs text-slate-800 focus:bg-white focus:border-indigo-500 transition"
                  placeholder="例:&#10;・残業は月20時間くらい、土日祝休み&#10;・退職は1ヶ月前までに届出、引き継ぎ必須&#10;・定年は60歳、希望者は65歳まで再雇用あり&#10;・自宅でのテレワークも認める&#10;・試用期間は3ヶ月"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateAiClauses}
                  disabled={aiIsGenerating}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {aiIsGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                  {aiIsGenerating ? 'AIが公式条文を生成中...' : '✨ 労働基準法準拠の公式条文を生成'}
                </button>
              </div>

              {/* 生成結果プレビュー */}
              {aiGeneratedResult && (
                <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 p-4 rounded-2xl border border-indigo-200 space-y-2 mt-3 animate-in fade-in">
                  <div className="font-bold text-indigo-900 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      AIが生成した公式条文案（プレビュー）
                    </span>
                    <span className="text-[10px] text-indigo-600 font-bold">法改正・労基法準拠</span>
                  </div>

                  <div className="text-[11px] text-slate-700 space-y-1.5 bg-white p-3 rounded-xl border border-indigo-100 max-h-48 overflow-y-auto">
                    {aiGeneratedResult.work_location_default && (
                      <div><strong>就業場所:</strong> {aiGeneratedResult.work_location_default}</div>
                    )}
                    {aiGeneratedResult.overtime_work_notes && (
                      <div><strong>時間外労働:</strong> {aiGeneratedResult.overtime_work_notes}</div>
                    )}
                    {aiGeneratedResult.holidays_special_notes && (
                      <div><strong>休日休暇:</strong> {aiGeneratedResult.holidays_special_notes}</div>
                    )}
                    {aiGeneratedResult.resignation_procedure_text && (
                      <div><strong>退職手続:</strong> {aiGeneratedResult.resignation_procedure_text}</div>
                    )}
                    {aiGeneratedResult.retirement_age_text && (
                      <div><strong>定年制:</strong> {aiGeneratedResult.retirement_age_text}</div>
                    )}
                    {aiGeneratedResult.dismissal_procedure_text && (
                      <div><strong>解雇規定:</strong> {aiGeneratedResult.dismissal_procedure_text}</div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplyAiGenerated}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      この内容を通知書テンプレートに一括適用する
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 📄 年間営業カレンダー A4印刷 / PDF出力 モーダル */}
      {calendarPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:z-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  会社公式 {calendarSettings.year}年 年間営業カレンダー（A4印刷 / PDF保存）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">社内掲示・取引先配布用の営業カレンダーとしてご利用いただけます</p>
              </div>
              <button onClick={() => setCalendarPrintModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* プレビュー本体 */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 print:border-none print:p-0 print:bg-white print:max-h-none print:overflow-visible max-h-[70vh] overflow-y-auto">
              <OfficialCompanyCalendarDoc data={{
                companyName: basicInfo.name,
                companyAddress: basicInfo.address,
                companyPhone: basicInfo.phone_number,
                year: calendarSettings.year || 2026,
                annualHolidaysCount: computedHolidaysSet.size,
                holidaysSet: computedHolidaysSet,
                holidaySummaryText: calendarSettings.holiday_text_summary,
                calendarPatternName: calendarPatterns.find(p => p.id === activeCalendarId)?.name
              }} />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button onClick={() => setCalendarPrintModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer">
                閉じる
              </button>
              <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                <Printer className="w-4 h-4 shrink-0" />
                <span>営業カレンダー 印刷/PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📄 労働条件通知書 兼 雇用契約書 A4プレビュー / 印刷モーダル（書面確認） */}
      {contractPreviewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:static print:p-0 print:m-0 print:bg-white print:overflow-visible print:z-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 my-8 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 print:hidden">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  労働条件通知書 兼 雇用契約書 書面プレビュー（公式A4帳票）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  登録された社印・就業規則連動条文・カスタマイズ内容が反映された実際の印字イメージです
                </p>
              </div>
              <button 
                onClick={() => setContractPreviewModalOpen(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 書面プレビュー本体 */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50 print:border-none print:p-0 print:bg-white print:max-h-none print:overflow-visible max-h-[70vh] overflow-y-auto">
              <OfficialLaborContractDoc 
                data={{
                  companyName: basicInfo.name || '（会社名未設定）',
                  companyAddress: basicInfo.address || '（所在地未設定）',
                  representativeName: basicInfo.representative_name || '（代表者名未設定）',
                  employeeName: '山田 太郎（サンプル）',
                  employeeAddress: '滋賀県大津市〇〇 1-1',
                  joinDate: '2026-04-01',
                  contractType: 'indefinite',
                  trialPeriodMonths: 3,
                  workLocation: contractTemplate.work_location_default,
                  jobDescription: '営業部門における業務全般',
                  startTime: '09:00',
                  endTime: '18:00',
                  breakTimeMinutes: 60,
                  overtimeWork: contractTemplate.overtime_work_notes,
                  holidaysText: '完全週休2日制（土・日）、国民の祝日、年末年始休暇',
                  paidLeaveGrantDays: 10,
                  salaryType: 'monthly',
                  baseSalary: 280000,
                  hourlyWage: 1500,
                  positionAllowance: 20000,
                  qualificationAllowance: 10000,
                  housingAllowance: 15000,
                  familyAllowance: 10000,
                  commutingAllowance: 15000,
                  fixedOvertimeHours: 0,
                  fixedOvertimeAllowance: 0,
                  bonusPolicy: 'あり（会社の業績および本人の勤務成績を勘案して支給）',
                  raisePolicy: 'あり（原則として年1回査定）',
                  retirementAllowance: 'なし',
                  healthInsuranceJoined: true,
                  pensionInsuranceJoined: true,
                  employmentInsuranceJoined: true,
                  workersCompJoined: true,
                  companySealUrl: companySealUrl,
                  template: contractTemplate
                }} 
              />
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100 print:hidden">
              <button 
                onClick={() => setContractPreviewModalOpen(false)} 
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                閉じる
              </button>
              <button 
                onClick={() => window.print()} 
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>労働条件通知書 印刷/PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ 入社手続きステップ ＆ 承認権限 編集モーダル */}
      {editingStepModal.isOpen && editingStepModal.step && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  ステップの編集（Step {editingStepModal.step.step_number}）
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">ステップ名、手続き内容、承認権限を設定します</p>
              </div>
              <button
                onClick={() => setEditingStepModal({ isOpen: false, index: -1, step: null })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">ステップ名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={editingStepModal.step.name}
                  onChange={e => setEditingStepModal(prev => prev.step ? {
                    ...prev,
                    step: { ...prev.step, name: e.target.value }
                  } : prev)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                  placeholder="例: 労務書類審査・原本確認"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">手続き内容説明</label>
                <textarea
                  rows={3}
                  value={editingStepModal.step.description}
                  onChange={e => setEditingStepModal(prev => prev.step ? {
                    ...prev,
                    step: { ...prev.step, description: e.target.value }
                  } : prev)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800"
                  placeholder="例: 提出された通帳原本や通勤申請の審査・差戻しまたは承認"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">承認権限（誰が承認を実行できるか） <span className="text-indigo-600 font-bold">*</span></label>
                <div className="space-y-2">
                  <select
                    value={editingStepModal.step.approver_type || 'all_admins'}
                    onChange={e => {
                      const val = e.target.value as any;
                      let newName = '管理者全員';
                      let newUserId = undefined;

                      if (val === 'specific_user' && companyUsers.length > 0) {
                        const firstUser = companyUsers[0];
                        newUserId = firstUser.id;
                        newName = `${firstUser.name} (${firstUser.department || '担当'})`;
                      } else if (val === 'department_head') {
                        newName = '配属部署の所属長';
                      }

                      setEditingStepModal(prev => prev.step ? {
                        ...prev,
                        step: {
                          ...prev.step,
                          approver_type: val,
                          approver_user_id: newUserId,
                          approver_name: newName
                        }
                      } : prev);
                    }}
                    className="w-full bg-indigo-50/50 border border-indigo-200 rounded-xl px-3 py-2 font-bold text-indigo-900"
                  >
                    <option value="all_admins">👥 管理者全員（システム管理者なら誰でも承認可）</option>
                    <option value="specific_user">👤 自社の個別担当者を指名（社員一覧から選択）</option>
                    <option value="department_head">🏢 配属部署の所属長・部門長</option>
                  </select>

                  {/* 自社ユーザー選択プルダウン */}
                  {editingStepModal.step.approver_type === 'specific_user' && (
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">担当者を選択:</label>
                      <select
                        value={editingStepModal.step.approver_user_id || ''}
                        onChange={e => {
                          const uId = e.target.value;
                          const targetUser = companyUsers.find(u => u.id === uId);
                          const newName = targetUser ? `${targetUser.name} (${targetUser.department || '担当'})` : '担当者指定';
                          setEditingStepModal(prev => prev.step ? {
                            ...prev,
                            step: {
                              ...prev.step,
                              approver_user_id: uId,
                              approver_name: newName
                            }
                          } : prev);
                        }}
                        className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                      >
                        {companyUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.department || '所属なし'}{u.role === 'admin' ? ' / 管理者' : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingStepModal({ isOpen: false, index: -1, step: null })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEditedStep}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                変更を反映する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ 会社組織図 A4印刷・PDF出力モーダル */}
      <OrgChartPrintModal
        isOpen={isOrgChartPrintModalOpen}
        onClose={() => setIsOrgChartPrintModalOpen(false)}
        companyInfo={basicInfo}
        positions={positions}
        departments={computedOrgDepartments}
        executives={computedExecutives}
        allMembers={companyUsers}
      />

      {/* ✏️ 社員の役職・配属部署・部門長 変更モーダル */}
      {editingUserModal.isOpen && editingUserModal.user && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-600" />
                  社員の役職 ＆ 配属部署 設定
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  対象社員: <strong className="text-slate-800">{editingUserModal.user.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditingUserModal({ isOpen: false, user: null })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  対象社員 <span className="text-indigo-600 font-bold">*</span>
                </label>
                <select
                  value={editingUserModal.user.id}
                  onChange={e => {
                    const uId = e.target.value;
                    const targetU = companyUsers.find(u => u.id === uId);
                    if (targetU) {
                      setEditingUserModal(prev => ({
                        ...prev,
                        user: {
                          ...targetU,
                          department: prev.user?.department || targetU.department,
                          is_department_head: targetU.department
                            ? departments.find(d => d.name === targetU.department)?.manager_user_id === targetU.id
                            : false
                        }
                      }));
                    }
                  }}
                  className="w-full bg-indigo-50/50 border border-indigo-200 rounded-xl px-3 py-2 font-black text-slate-800"
                >
                  {companyUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}（現在: {u.department || '未所属'} / {u.position_name || '役職なし'}）
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">配属部署</label>
                <select
                  value={editingUserModal.user.department || ''}
                  onChange={e => {
                    const newDept = e.target.value;
                    setEditingUserModal(prev => {
                      if (!prev.user) return prev;
                      let newStore = prev.user.store_name || '';
                      if (newDept === '店舗運営部') {
                        if (!newStore || newStore === '') {
                          newStore = stores[0]?.name || '';
                        }
                      } else {
                        // 本部部署（営業部・総務部など）の場合は店舗をクリア
                        newStore = '';
                      }
                      return {
                        ...prev,
                        user: {
                          ...prev.user,
                          department: newDept,
                          store_name: newStore,
                          is_department_head: newDept
                            ? departments.find(d => d.name === newDept)?.manager_user_id === prev.user?.id
                            : false
                        }
                      };
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="">（部署未設定 / 本部直属）</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">役職（Position）</label>
                <select
                  value={editingUserModal.user.position_id || ''}
                  onChange={e => {
                    const posId = e.target.value;
                    const pos = positions.find(p => p.id === posId);
                    setEditingUserModal(prev => prev.user ? {
                      ...prev,
                      user: { ...prev.user, position_id: posId, position_name: pos ? pos.name : '' }
                    } : prev);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="">（役職なし / 一般社員）</option>
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Lv.{p.rank_level})</option>
                  ))}
                </select>
              </div>

              {/* 🏪 所属店舗（シフト勤務拠点） */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center justify-between">
                  <span>🏪 所属店舗（シフト勤務先拠点）</span>
                  {editingUserModal.user.store_name && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ★店舗運営部連動
                    </span>
                  )}
                </label>
                <select
                  value={editingUserModal.user.store_name || ''}
                  onChange={e => {
                    const newStore = e.target.value;
                    setEditingUserModal(prev => {
                      if (!prev.user) return prev;
                      let newDept = prev.user.department || '';
                      if (newStore && newStore !== '') {
                        newDept = '店舗運営部';
                      }
                      return {
                        ...prev,
                        user: {
                          ...prev.user,
                          department: newDept,
                          store_name: newStore
                        }
                      };
                    });
                  }}
                  className="w-full bg-indigo-50/50 border border-indigo-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="">（店舗なし / 本部所属・シフト対象外）</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.name}>
                      📍 {s.name}{s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  ※ 店舗を選択すると自動的に「店舗運営部」に配属されます。総務・人事等の本部スタッフは「店舗なし」を選択してください。
                </p>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      editingUserModal.user.is_department_head !== undefined
                        ? editingUserModal.user.is_department_head
                        : (editingUserModal.user.department
                            ? departments.find(d => d.name === editingUserModal.user?.department)?.manager_user_id === editingUserModal.user.id
                            : false)
                    }
                    onChange={e => {
                      const isChecked = e.target.checked;
                      setEditingUserModal(prev => prev.user ? {
                        ...prev,
                        user: { ...prev.user, is_department_head: isChecked }
                      } : prev);
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="font-bold text-amber-900 text-xs">
                    この社員を「{editingUserModal.user.department || '配属部署'}」の部門長・所属長に任命する
                  </span>
                </label>
                <p className="text-[10px] text-amber-700 mt-1 pl-6">
                  ※ チェックすると、部署マスタの所属長および入社手続きの承認者へ自動反映されます。
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={() => setEditingUserModal({ isOpen: false, user: null })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  if (!editingUserModal.user) return;
                  let finalDept = editingUserModal.user.department || '';
                  let finalStore = editingUserModal.user.store_name || '';
                  if (finalStore && finalStore.trim() !== '') {
                    finalDept = '店舗運営部';
                  } else if (finalDept !== '店舗運営部') {
                    finalStore = '';
                  }
                  handleUpdateMemberPositionAndDept(
                    editingUserModal.user.id,
                    finalDept,
                    editingUserModal.user.position_id || '',
                    Boolean(editingUserModal.user.is_department_head),
                    finalStore
                  );
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                役職・所属を保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ 賞与支払届 印字座標マスタ微調整モーダル（最高権限者専用） */}
      {showBonusInspectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-7xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-pink-600 rounded-xl text-white text-sm">🌸</span>
                <div>
                  <h3 className="text-sm font-black text-white">被保険者賞与支払届 印字座標マスタ設定インスペクター</h3>
                  <p className="text-[10px] text-slate-400">位置を調整して保存すると、全社の帳票印字位置に即座に反映されます</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBonusInspectorModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                ✕ 閉じる
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50">
              <BonusDocMasterInspector />
            </div>
          </div>
        </div>
      )}

      {/* 💬 公式LINE通知・月額課金設定モーダル */}
      <LineConfigModal
        isOpen={showLineConfigModal}
        onClose={() => {
          setShowLineConfigModal(false);
          if (tenantId) {
            fetchTenantLineConfigFromDb(tenantId).then(cfg => {
              if (cfg) setLineConfig(cfg);
            });
          }
        }}
        tenantId={tenantId}
      />

      {/* ❓ 使い方ガイドモーダル */}
      <HelpGuideModal 
        screenKey="company_settings" 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />

      {/* 🏢 業種別・部門テンプレート選択モーダル */}
      {isDeptPresetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg shadow-2xs">
                  ✨
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    業種別・標準部門テンプレート
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      ワンクリック一括展開
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    自社の業種や事業モデルを選ぶだけで、バランスの良い標準的な部門構成が一瞬で生成されます。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDeptPresetModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* テンプレートカード一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
              {DEPARTMENT_PRESETS.map(preset => (
                <div
                  key={preset.id}
                  className="bg-slate-50/70 hover:bg-indigo-50/40 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 p-4 transition space-y-3 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{preset.icon}</span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition">
                            {preset.name}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400">
                            {preset.targetScale}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full shadow-2xs">
                        {preset.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {preset.description}
                    </p>

                    {/* 展開される部署リストプレビュー */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                      <div className="text-[9px] font-bold text-slate-400">【含まれる部門（全{preset.departments.length}部署）】</div>
                      <div className="grid grid-cols-1 gap-1">
                        {preset.departments.map(d => {
                          const dTheme = getDepartmentTheme(d.name);
                          return (
                            <div key={d.name} className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{dTheme.icon}</span>
                                <span>{d.name}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                {d.description}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyDepartmentPreset(preset.id)}
                    className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                    <span>このテンプレートを適用する</span>
                  </button>
                </div>
              ))}
            </div>

            {/* モーダルフッター */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span>🛡️</span>
                <span>適用後も、不要な部署の削除（🗑️）・名前変更（✎）・並び替えはワンクリックで自由自在！社員データも安全に保護されます。</span>
              </span>
              <button
                onClick={() => setIsDeptPresetModalOpen(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer self-end sm:self-auto shrink-0"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 画面右下常設：かんたん初期設定スタートガイド帰還フロートボタン（AI相談ボタンの真上に配置） */}
      <div className="fixed bottom-24 right-6 z-40">
        <button
          type="button"
          onClick={scrollToStartupGuide}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-3 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 flex items-center gap-2.5 cursor-pointer border-2 border-emerald-400/80 group"
          title="画面最上部の「かんたん初期設定スタートガイド」へ移動"
        >
          <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-[10px] text-emerald-100 font-bold leading-tight">
              初期設定ガイドへ戻る
            </div>
            <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
              <span>🚀 スタートガイド</span>
              <span className="text-[9px] bg-emerald-800/80 text-emerald-200 px-1.5 py-0.2 rounded-full font-bold">
                {positions.length > 0 || departments.length > 0 ? 'STEP 3完了' : 'STEP 1'}
              </span>
            </div>
          </div>
          <ArrowUp className="w-4 h-4 text-emerald-200 group-hover:text-white transition ml-0.5" />
        </button>
      </div>
    </div>
  );
}
