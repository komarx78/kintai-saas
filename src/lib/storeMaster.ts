import { supabase } from './supabase';

export interface StoreMaster {
  id: string;
  name: string; // 店舗・拠点名（例: 新宿店、渋谷店、池袋店、本店）
  code?: string; // 店舗コード（例: S01, SHINJUKU）
  department_name?: string; // 統括部門（例: 店舗運営部、飲食事業部。総務等の本部は選ばない）
  manager_user_id?: string; // 店長・責任者ユーザーID
  manager_user_name?: string; // 店長名
  address?: string; // 店舗住所・所在地
  phone?: string; // 電話番号
  display_order: number;
}

export const DEFAULT_STORES: StoreMaster[] = [
  { id: 'store-1', name: '新宿店', code: 'S01', department_name: '店舗運営部', display_order: 1 },
  { id: 'store-2', name: '渋谷店', code: 'S02', department_name: '店舗運営部', display_order: 2 },
  { id: 'store-3', name: '池袋店', code: 'S03', department_name: '店舗運営部', display_order: 3 },
];

/**
 * 🧹 店舗名の安全クレンジング
 */
export const sanitizeStoreName = (name: string): string => {
  if (!name) return '';
  let cleaned = name.trim();
  if (cleaned.includes('+')) {
    cleaned = cleaned.split('+')[0].trim();
  }
  cleaned = cleaned.replace(/[:;=<>].*$/, '').trim();
  return cleaned;
};

/**
 * 🧹 初期ダミー店舗（新宿店・渋谷店・池袋店）かどうか判定するヘルパー
 */
export const isDefaultDummyStoreList = (stores: StoreMaster[]): boolean => {
  if (!Array.isArray(stores) || stores.length === 0) return false;
  if (stores.length === 3 &&
      stores.some(s => s.id === 'store-1' && s.name === '新宿店') &&
      stores.some(s => s.id === 'store-2' && s.name === '渋谷店') &&
      stores.some(s => s.id === 'store-3' && s.name === '池袋店')) {
    return true;
  }
  return false;
};

/**
 * LocalStorageから店舗一覧を取得（未登録時は空配列を返す）
 */
export const getStoresFromStorage = (tenantId?: string | null): StoreMaster[] => {
  try {
    if (tenantId) {
      const raw = localStorage.getItem(`company_stores_${tenantId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // 初期ダミー（新宿店・渋谷店・池袋店）が自動保存されてしまっていた場合は空配列へクレンジング
          if (isDefaultDummyStoreList(parsed)) {
            localStorage.setItem(`company_stores_${tenantId}`, JSON.stringify([]));
            return [];
          }
          return parsed.map((s: StoreMaster) => ({
            ...s,
            name: sanitizeStoreName(s.name)
          })).filter(s => s.name.length > 0);
        }
      }
    }
  } catch (e) {
    console.warn('LocalStorage stores parse error:', e);
  }
  return []; // 未設定時は空配列（勝手にダミー店舗を生成しない）
};

/**
 * LocalStorageへ店舗一覧を保存
 */
export const saveStoresToStorage = (tenantId: string | null, stores: StoreMaster[]): void => {
  try {
    if (tenantId) {
      const validStores = stores
        .map(s => ({ ...s, name: sanitizeStoreName(s.name) }))
        .filter(s => s.name.length > 0);
      localStorage.setItem(`company_stores_${tenantId}`, JSON.stringify(validStores));
    }
  } catch (e) {
    console.warn('LocalStorage stores save error:', e);
  }
};

// 🛡️ テーブル未作成環境での無駄な404エラー抑制フラグ
let isStoreMastersTableAvailable: boolean | null = null;

/**
 * データベースおよびLocalStorageから店舗一覧を統合取得（未設定時は0件を厳格保持）
 */
export const fetchStoresUnified = async (tenantId: string): Promise<StoreMaster[]> => {
  const localStores = getStoresFromStorage(tenantId);
  if (isStoreMastersTableAvailable === false) {
    return localStores;
  }

  try {
    // Supabaseテーブル store_masters が存在する場合は取得を試行
    const { data, error, status } = await supabase
      .from('store_masters')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('display_order');
    
    if (error || status === 404) {
      isStoreMastersTableAvailable = false;
      return localStores;
    }

    isStoreMastersTableAvailable = true;
    if (data) {
      const mapped: StoreMaster[] = data.map((d: any) => ({
        id: d.id,
        name: sanitizeStoreName(d.name),
        code: d.code,
        department_name: d.department_name,
        manager_user_id: d.manager_user_id,
        manager_user_name: d.manager_user_name,
        address: d.address,
        phone: d.phone,
        display_order: d.display_order ?? 0
      }));
      // 最新データをLocalStorageにも同期
      saveStoresToStorage(tenantId, mapped);
      return mapped;
    }
  } catch (e) {
    isStoreMastersTableAvailable = false;
  }
  return localStores;
};

/**
 * データベースおよびLocalStorageへ店舗一覧を保存
 */
export const saveStoresUnified = async (tenantId: string, stores: StoreMaster[]): Promise<void> => {
  // まず即座にLocalStorageへ保存（高速レスポンス＆オフライン保証）
  saveStoresToStorage(tenantId, stores);

  if (isStoreMastersTableAvailable === false) {
    return;
  }

  try {
    // Supabaseテーブル store_masters が存在する場合は同期更新
    // 既存データを削除して再登録、またはupsert
    const records = stores.map((s, idx) => ({
      id: s.id.startsWith('store-') ? undefined : s.id, // UUIDでない場合は自動採番
      tenant_id: tenantId,
      name: sanitizeStoreName(s.name),
      code: s.code || null,
      department_name: s.department_name || null,
      manager_user_id: s.manager_user_id || null,
      manager_user_name: s.manager_user_name || null,
      address: s.address || null,
      phone: s.phone || null,
      display_order: idx + 1
    }));

    // store_mastersテーブルへの書き込み試行
    const { error } = await supabase.from('store_masters').upsert(records, { onConflict: 'id' });
    if (error) {
      isStoreMastersTableAvailable = false;
    }
  } catch (e) {
    isStoreMastersTableAvailable = false;
  }
};
