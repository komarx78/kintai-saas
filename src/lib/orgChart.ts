export interface PositionMaster {
  id: string;
  name: string;
  rank_level: number; // 1: 経営陣(役員), 2: 部門長(部長・統括), 3: 中間管理職(課長・店長), 4: 現場リーダー, 5: 一般・パート
  display_order: number;
}

export interface OrgMemberInfo {
  id: string;
  name: string;
  department?: string;
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
  { id: 'pos_1', name: '代表取締役', rank_level: 1, display_order: 1 },
  { id: 'pos_2', name: '専務・常務取締役', rank_level: 1, display_order: 2 },
  { id: 'pos_3', name: '取締役・役員', rank_level: 1, display_order: 3 },
  { id: 'pos_4', name: '部長・本部長', rank_level: 2, display_order: 4 },
  { id: 'pos_5', name: 'マネージャー・室長', rank_level: 2, display_order: 5 },
  { id: 'pos_6', name: '課長・店長', rank_level: 3, display_order: 6 },
  { id: 'pos_7', name: '係長・主任・リーダー', rank_level: 4, display_order: 7 },
  { id: 'pos_8', name: '一般社員（正社員）', rank_level: 5, display_order: 8 },
  { id: 'pos_9', name: '契約社員・嘱託', rank_level: 5, display_order: 9 },
  { id: 'pos_10', name: 'パート・アルバイト', rank_level: 5, display_order: 10 },
];

export const getPositionsFromStorage = (): PositionMaster[] => {
  try {
    const saved = localStorage.getItem('company_position_masters');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Load positions error:', e);
  }
  return DEFAULT_POSITIONS;
};

export const savePositionsToStorage = (positions: PositionMaster[]) => {
  try {
    localStorage.setItem('company_position_masters', JSON.stringify(positions));
  } catch (e) {
    console.warn('Save positions error:', e);
  }
};