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
    const key = tenantId ? `company_position_masters_${tenantId}` : null;
    if (key) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
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
    localStorage.removeItem('company_position_masters');
  } catch (e) {
    console.warn('Save positions error:', e);
  }
};