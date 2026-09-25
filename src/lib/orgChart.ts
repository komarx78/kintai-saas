export interface PositionMaster {
  id: string;
  name: string;
  rank_level: number; // 1: 経営陣(役員), 2: 部門長(部長・統括), 3: 中間管理職(課長・店長), 4: 現場リーダー, 5: 一般・パート
  display_order: number;
  default_allowance?: number; // 役職手当の標準月額（円）
}

export interface OrgMemberInfo {
  id: string;
  name: string;
  department?: string;
  store_name?: string;
  position_id?: string;
  position_name?: string;
  role: string; // admin, manager, user
  is_department_head?: boolean;
}

export interface OrgDepartmentNode {
  id: string;
  name: string;
  code?: string;
  parent_id?: string | null; // 親部署ID（階層用）
  manager_user_id?: string;
  manager_user_name?: string;
  display_order: number;
  members: OrgMemberInfo[];
}

export const DEFAULT_POSITIONS: PositionMaster[] = [
  { id: 'pos_1', name: '代表取締役', rank_level: 1, display_order: 1, default_allowance: 0 },
  { id: 'pos_2', name: '専務・常務取締役', rank_level: 1, display_order: 2, default_allowance: 0 },
  { id: 'pos_3', name: '取締役・役員', rank_level: 1, display_order: 3, default_allowance: 0 },
  { id: 'pos_4', name: '部長・本部長', rank_level: 2, display_order: 4, default_allowance: 50000 },
  { id: 'pos_5', name: 'マネージャー・室長', rank_level: 2, display_order: 5, default_allowance: 35000 },
  { id: 'pos_6', name: '課長・店長', rank_level: 3, display_order: 6, default_allowance: 25000 },
  { id: 'pos_7', name: '係長・主任・リーダー', rank_level: 4, display_order: 7, default_allowance: 10000 },
  { id: 'pos_8', name: '一般社員（役職なし）', rank_level: 5, display_order: 8, default_allowance: 0 },
  { id: 'pos_9', name: '契約社員・嘱託', rank_level: 5, display_order: 9, default_allowance: 0 },
  { id: 'pos_10', name: 'パート・アルバイト', rank_level: 5, display_order: 10, default_allowance: 0 },
];

export interface PositionPreset {
  id: string;
  name: string;
  badge: string;
  icon: string;
  targetScale: string;
  description: string;
  positions: Array<{ name: string; rank_level: number; default_allowance?: number }>;
}

export const POSITION_PRESETS: PositionPreset[] = [
  {
    id: 'standard_corporate',
    name: '一般企業・オフィス（標準）',
    badge: '🏢 標準',
    icon: '🏢',
    targetScale: '中規模〜標準（10名〜100名）',
    description: '役員から部長、課長、主任、一般社員まで揃った王道の組織構成',
    positions: [
      { name: '代表取締役', rank_level: 1, default_allowance: 0 },
      { name: '取締役・役員', rank_level: 1, default_allowance: 0 },
      { name: '部長・本部長', rank_level: 2, default_allowance: 50000 },
      { name: '課長・マネージャー', rank_level: 3, default_allowance: 30000 },
      { name: '主任・現場リーダー', rank_level: 4, default_allowance: 10000 },
      { name: '一般社員', rank_level: 5, default_allowance: 0 },
      { name: 'パート・アルバイト', rank_level: 5, default_allowance: 0 },
    ]
  },
  {
    id: 'store_service',
    name: '店舗・サービス・飲食業',
    badge: '🏪 店舗向け',
    icon: '🏪',
    targetScale: '多拠点・店舗運営',
    description: '店長やエリアマネージャー、現場リーダーを中心とした店舗・サービス構成',
    positions: [
      { name: '代表取締役 / オーナー', rank_level: 1, default_allowance: 0 },
      { name: 'エリアマネージャー / 統括', rank_level: 2, default_allowance: 40000 },
      { name: '店長 / 拠点責任者', rank_level: 3, default_allowance: 30000 },
      { name: '副店長 / チーフリーダー', rank_level: 4, default_allowance: 15000 },
      { name: 'スタッフ（一般）', rank_level: 5, default_allowance: 0 },
      { name: 'アルバイト・パート', rank_level: 5, default_allowance: 0 },
    ]
  },
  {
    id: 'simple_small',
    name: '超シンプル（小規模・個人店）',
    badge: '⚡ 小規模(~10名)',
    icon: '⚡',
    targetScale: '〜10名向け（スタートアップ・個人店・クリニック）',
    description: '「代表」と「一般スタッフ」の2階層のみ。経営が分からなくても即座に迷わず運用可能！',
    positions: [
      { name: '代表 / 責任者', rank_level: 1, default_allowance: 0 },
      { name: '一般スタッフ', rank_level: 5, default_allowance: 0 },
    ]
  }
];

export const getPositionsFromStorage = (tenantId?: string | null): PositionMaster[] => {
  try {
    // 1. 自社専用キーから読み込み
    if (tenantId) {
      const saved = localStorage.getItem(`company_position_masters_${tenantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
    // 2. 汎用フォールバックキーから読み込み
    const genericSaved = localStorage.getItem('company_position_masters');
    if (genericSaved) {
      const parsed = JSON.parse(genericSaved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Load positions error:', e);
  }
  return DEFAULT_POSITIONS;
};

export const savePositionsToStorage = (positions: PositionMaster[], tenantId?: string | null) => {
  try {
    if (tenantId) {
      localStorage.setItem(`company_position_masters_${tenantId}`, JSON.stringify(positions));
    }
    // 汎用キーにも常にバックアップ保存（tenantId欠落時や別タブ参照時のセーフティネット）
    localStorage.setItem('company_position_masters', JSON.stringify(positions));
  } catch (e) {
    console.warn('Save positions error:', e);
  }
};

// 🏢 業種別・部門プリセット（テンプレート）定義
export interface DepartmentPreset {
  id: string;
  name: string;
  badge: string;
  icon: string;
  targetScale: string;
  description: string;
  departments: Array<{
    name: string;
    description?: string;
  }>;
}

export const DEPARTMENT_PRESETS: DepartmentPreset[] = [
  {
    id: 'standard_corporate',
    name: '一般企業・オフィス（標準）',
    badge: '🏢 標準',
    icon: '🏢',
    targetScale: '中規模〜標準（10名〜100名）',
    description: '本社管理・営業・企画・開発まで揃ったバランスの良い組織構成',
    departments: [
      { name: '本社・管理部', description: '総務・人事・経理・法務など管理全般' },
      { name: '営業部', description: '新規開拓・顧客対応・セールス全般' },
      { name: '企画・マーケティング部', description: '事業企画・広報宣伝・Webマーケティング' },
      { name: '開発・製造部', description: '商品開発・システム開発・品質管理' },
    ]
  },
  {
    id: 'store_service',
    name: '店舗・サービス・飲食業',
    badge: '🏪 店舗向け',
    icon: '🏪',
    targetScale: '多拠点・飲食・小売・サービス',
    description: '本部統括と現場の店舗運営部、仕入物流で連携する店舗型構成',
    departments: [
      { name: '本部・管理部', description: '統括マネジメント・経理労務・SV' },
      { name: '店舗運営部', description: '各店舗運営・シフト管理・現場接客' },
      { name: '仕入・物流・商品開発', description: '仕入調達・在庫管理・メニュー開発' },
    ]
  },
  {
    id: 'it_web',
    name: 'IT・Web・スタートアップ',
    badge: '💻 IT・Web',
    icon: '💻',
    targetScale: 'IT・SaaS・クリエイティブ（10〜50名）',
    description: 'プロダクト開発とビジネス部門、バックオフィスの機動的な構成',
    departments: [
      { name: '経営管理室', description: '総務・労務・経理・財務・コーポレート' },
      { name: 'プロダクト開発本部', description: 'エンジニアリング・デザイナー・PdM' },
      { name: 'ビジネス開発・セールス', description: 'インサイドセールス・FS・マーケ・CS' },
    ]
  },
  {
    id: 'simple_small',
    name: '超シンプル（小規模・個人店）',
    badge: '⚡ 小規模(~10名)',
    icon: '⚡',
    targetScale: '〜10名向け（スタートアップ・個人店・クリニック）',
    description: '管理部門と現場の2部署のみ。迷わず最短で運用スタート可能！',
    departments: [
      { name: '本社・管理部', description: '事務・労務・経理' },
      { name: '現場・店舗部', description: '現場実務・顧客対応・運営' },
    ]
  },
  {
    id: 'medical_care',
    name: '医療・介護・クリニック',
    badge: '🩺 医療・介護',
    icon: '🩺',
    targetScale: 'クリニック・介護施設・薬局',
    description: '診療・ケア部門と受付・事務部門を分けた医療福祉構成',
    departments: [
      { name: '診療・医療技術部', description: '医師・歯科医師・技師・リハビリ' },
      { name: '看護・ケア部門', description: '看護師・介護福祉士・現場スタッフ' },
      { name: '事務・受付部門', description: '医療事務・受付・総務経理' },
    ]
  },
  {
    id: 'construction_craft',
    name: '建設・工務店・現場技術',
    badge: '🏗️ 建設・現場',
    icon: '🏗️',
    targetScale: '工務店・施工会社・設備・物流',
    description: '工事現場と営業設計、本社管理を明確に分けた現場対応構成',
    departments: [
      { name: '本社・管理部', description: '総務・経理・安全管理・労務' },
      { name: '施工・工事部', description: '現場監督・施工管理・技術職' },
      { name: '営業・設計部', description: '案件受注・積算・図面設計' },
    ]
  }
];

// 🎨 部署名に応じたスマート・テーマカラー＆アイコン自動判定ヘルパー
export interface DepartmentTheme {
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderHover: string;
  headerBg: string;
  accentBar: string;
}

export const getDepartmentTheme = (deptName: string): DepartmentTheme => {
  const n = (deptName || '').trim();
  if (/管理|総務|経理|人事|労務|法務|コーポレート|本部|役員/.test(n)) {
    return {
      icon: '💼',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-800 border-emerald-200',
      borderHover: 'hover:border-emerald-400',
      headerBg: 'bg-gradient-to-r from-emerald-50/90 to-teal-50/60',
      accentBar: 'bg-emerald-500'
    };
  }
  if (/営業|セールス|マーケ|広報|販売|ビジネス|企画/.test(n)) {
    return {
      icon: '📈',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-800 border-blue-200',
      borderHover: 'hover:border-blue-400',
      headerBg: 'bg-gradient-to-r from-blue-50/90 to-indigo-50/60',
      accentBar: 'bg-blue-500'
    };
  }
  if (/開発|技術|エンジニア|システム|プロダクト|IT|デザイン/.test(n)) {
    return {
      icon: '💻',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-800 border-purple-200',
      borderHover: 'hover:border-purple-400',
      headerBg: 'bg-gradient-to-r from-purple-50/90 to-indigo-50/60',
      accentBar: 'bg-purple-500'
    };
  }
  if (/店舗|店|サービス|飲食|ホール|キッチン|フロント|運営|拠点/.test(n)) {
    return {
      icon: '🏪',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800 border-amber-200',
      borderHover: 'hover:border-amber-400',
      headerBg: 'bg-gradient-to-r from-amber-50/90 to-orange-50/60',
      accentBar: 'bg-amber-500'
    };
  }
  if (/製造|現場|工事|施工|設備|物流|仕入|配送|工場/.test(n)) {
    return {
      icon: '⚙️',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-800 border-rose-200',
      borderHover: 'hover:border-rose-400',
      headerBg: 'bg-gradient-to-r from-rose-50/90 to-pink-50/60',
      accentBar: 'bg-rose-500'
    };
  }
  if (/医療|診療|看護|介護|ケア|リハビリ|薬|クリニック/.test(n)) {
    return {
      icon: '🩺',
      badgeBg: 'bg-teal-50',
      badgeText: 'text-teal-800 border-teal-200',
      borderHover: 'hover:border-teal-400',
      headerBg: 'bg-gradient-to-r from-teal-50/90 to-cyan-50/60',
      accentBar: 'bg-teal-500'
    };
  }
  return {
    icon: '🏢',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700 border-slate-200',
    borderHover: 'hover:border-slate-400',
    headerBg: 'bg-gradient-to-r from-slate-50 to-slate-100/60',
    accentBar: 'bg-slate-500'
  };
};