import { supabase } from './supabase';

// 日本年金機構「健康保険・厚生年金保険 被保険者報酬月額変更届（コード2221用紙）」
// (兼) 厚生年金保険 70歳以上被用者月額変更届
// 原本マス目・枠内印字の精密座標マスター定義

export const MONTHLY_REVISION_COORDS_UPDATE_EVENT = 'monthly-revision-doc-coords-updated';

export interface MonthlyRevisionDocFieldConfig {
  id: string;
  name: string;
  section: 'submission' | 'office' | 'row_template';
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当（6〜24）
  pitch?: number; // % または gap (マス目・数字間隔)
  width?: number; // % (表示枠の幅)
  example: string;
  description: string;
  disabled?: boolean;
}

// 🎯 原本PDF（コード2221用紙）にぴったり収まる黄金比率デフォルト値
export const DEFAULT_MONTHLY_REVISION_FIELDS: MonthlyRevisionDocFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① 提出年月日
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'subDateY',
    name: '提出年（和暦数字）',
    section: 'submission',
    x: 17.5,
    y: 7.0,
    fontSize: 11,
    width: 3.5,
    example: '8',
    description: '最上部「令和」と「年」の間の空欄'
  },
  {
    id: 'subDateM',
    name: '提出月（数字）',
    section: 'submission',
    x: 21.8,
    y: 7.0,
    fontSize: 11,
    width: 3.5,
    example: '9',
    description: '最上部「年」と「月」の間の空欄'
  },
  {
    id: 'subDateD',
    name: '提出日（数字）',
    section: 'submission',
    x: 26.0,
    y: 7.0,
    fontSize: 11,
    width: 3.5,
    example: '15',
    description: '最上部「月」と「日提出」の間の空欄'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 事業所情報 ＆ 整理記号
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'symbolDigits',
    name: '事業所整理記号（数字4マス）',
    section: 'office',
    x: 15.0,
    y: 8.8,
    fontSize: 13,
    pitch: 2.35,
    width: 9.8,
    example: '2501',
    description: '整理記号左側4マス（数字・各マス中央揃え）'
  },
  {
    id: 'symbolKana',
    name: '事業所整理記号（カタカナ4マス）',
    section: 'office',
    x: 27.2,
    y: 8.8,
    fontSize: 12.5,
    pitch: 2.35,
    width: 9.8,
    example: 'カア',
    description: '整理記号右側4マス（カタカナ・ハイフンの右）'
  },
  {
    id: 'companyZip',
    name: '事業所郵便番号',
    section: 'office',
    x: 14.5,
    y: 12.2,
    fontSize: 9.5,
    width: 15.0,
    example: '520-0043',
    description: '事業所所在地 郵便番号'
  },
  {
    id: 'companyAddress',
    name: '事業所所在地（住所）',
    section: 'office',
    x: 14.5,
    y: 14.0,
    fontSize: 9.0,
    width: 33.0,
    example: '滋賀県大津市中央1-2-3 サンプルビル4F',
    description: '事業所所在地欄'
  },
  {
    id: 'companyName',
    name: '事業所名称（会社名）',
    section: 'office',
    x: 14.5,
    y: 18.2,
    fontSize: 10.5,
    width: 33.0,
    example: '株式会社サンプル商事',
    description: '事業所名称欄'
  },
  {
    id: 'companyOwnerName',
    name: '事業主氏名（代表者）',
    section: 'office',
    x: 14.5,
    y: 21.6,
    fontSize: 10.5,
    width: 33.0,
    example: '代表取締役 山田 太郎',
    description: '事業主氏名欄'
  },
  {
    id: 'companyPhone',
    name: '電話番号',
    section: 'office',
    x: 18.0,
    y: 23.6,
    fontSize: 9.5,
    width: 25.0,
    example: '077 ( 512 ) 3456',
    description: '電話番号欄'
  },
  {
    id: 'sharoushiName',
    name: '社会保険労務士記載欄',
    section: 'office',
    x: 54.0,
    y: 20.5,
    fontSize: 10.0,
    width: 38.0,
    example: '社会保険労務士法人 サンプル労務オフィス',
    description: '社会保険労務士記載欄'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 被保険者行テンプレート（行1〜行5）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'rowBaseTop',
    name: '【行基準】1行目の上端Y座標',
    section: 'row_template',
    x: 0,
    y: 31.8,
    fontSize: 0,
    example: '31.8%',
    description: '被保険者行1の開始Y位置（%）'
  },
  {
    id: 'rowPitchY',
    name: '【行基準】1行あたりの高さピッチ',
    section: 'row_template',
    x: 0,
    y: 12.60,
    fontSize: 0,
    example: '12.60%',
    description: '次の被保険者行までの垂直間隔（%）'
  },

  // ── 行上段（段1） ──────────────────────────────
  {
    id: 'empInsuranceNumber',
    name: '① 被保険者整理番号',
    section: 'row_template',
    x: 9.8,
    y: 1.2,
    fontSize: 10.5,
    width: 11.5,
    example: '1234',
    description: '① 被保険者整理番号（右詰め）'
  },
  {
    id: 'empName',
    name: '② 被保険者氏名',
    section: 'row_template',
    x: 23.0,
    y: 1.0,
    fontSize: 11.0,
    width: 23.0,
    example: '山田 太郎',
    description: '② 被保険者氏名'
  },
  {
    id: 'empBirth',
    name: '③ 生年月日（元号+6桁）',
    section: 'row_template',
    x: 47.8,
    y: 1.2,
    fontSize: 10.5,
    pitch: 1.7,
    width: 14.5,
    example: '7-010520',
    description: '③ 生年月日（例: 7-010520）'
  },
  {
    id: 'empRevisionYearMonth',
    name: '④ 改定年月（和暦YY-MM）',
    section: 'row_template',
    x: 64.0,
    y: 1.2,
    fontSize: 10.5,
    width: 8.5,
    example: '08 - 09',
    description: '④ 改定年月（例: 08年 09月）'
  },
  {
    id: 'empMyNumber',
    name: '⑰ 個人番号［基礎年金番号］（70歳以上のみ）',
    section: 'row_template',
    x: 74.0,
    y: 1.2,
    fontSize: 10.0,
    pitch: 1.9,
    width: 20.0,
    example: '123456789012',
    description: '⑰ 個人番号（70歳以上被用者のみ印字）'
  },

  // ── 行中段（段2） ──────────────────────────────
  {
    id: 'empCurrentHealthStandard',
    name: '⑤ 従前標準報酬（健保・千円）',
    section: 'row_template',
    x: 10.5,
    y: 3.8,
    fontSize: 10.5,
    width: 9.0,
    example: '300',
    description: '⑤ 従前の標準報酬月額（健康保険・千円単位）'
  },
  {
    id: 'empCurrentPensionStandard',
    name: '⑤ 従前標準報酬（厚年・千円）',
    section: 'row_template',
    x: 21.2,
    y: 3.8,
    fontSize: 10.5,
    width: 9.0,
    example: '300',
    description: '⑤ 従前の標準報酬月額（厚生年金・千円単位）'
  },
  {
    id: 'empPreviousRevisionYM',
    name: '⑥ 従前改定年月',
    section: 'row_template',
    x: 32.5,
    y: 3.8,
    fontSize: 10.0,
    width: 12.0,
    example: '07年09月',
    description: '⑥ 従前の標準報酬月額が適用された年月'
  },
  {
    id: 'empWageChangeType',
    name: '⑦ 昇(降)給（区分・年月）',
    section: 'row_template',
    x: 46.5,
    y: 3.8,
    fontSize: 10.0,
    width: 15.0,
    example: '1.昇給 08年06月',
    description: '⑦ 昇(降)給の区分および支払年月'
  },
  {
    id: 'empRetroactiveAmount',
    name: '⑧ 遡及支払額',
    section: 'row_template',
    x: 63.5,
    y: 3.8,
    fontSize: 9.5,
    width: 9.0,
    example: '',
    description: '⑧ 遡及分の支払があった月と差額'
  },
  {
    id: 'empRemarks',
    name: '⑱ 備考欄',
    section: 'row_template',
    x: 74.0,
    y: 3.8,
    fontSize: 9.0,
    width: 20.0,
    example: '基本給改定のため',
    description: '⑱ 備考（昇給理由・短時間労働者等）'
  },

  // ── 行下段（段3：3ヶ月給与実績テーブル） ────────
  // 月1
  {
    id: 'm1Month',
    name: '⑨ 月1 支給月',
    section: 'row_template',
    x: 10.0,
    y: 6.2,
    fontSize: 10.0,
    width: 4.5,
    example: '6月',
    description: '変動後1ヶ月目の支給月'
  },
  {
    id: 'm1Days',
    name: '⑩ 月1 基礎日数',
    section: 'row_template',
    x: 16.5,
    y: 6.2,
    fontSize: 10.0,
    width: 5.0,
    example: '21日',
    description: '変動後1ヶ月目の支払基礎日数'
  },
  {
    id: 'm1Cash',
    name: '⑪ 月1 通貨額',
    section: 'row_template',
    x: 23.0,
    y: 6.2,
    fontSize: 9.5,
    width: 9.5,
    example: '350,000',
    description: '変動後1ヶ月目の通貨による額'
  },
  {
    id: 'm1InKind',
    name: '⑫ 月1 現物額',
    section: 'row_template',
    x: 33.5,
    y: 6.2,
    fontSize: 9.5,
    width: 7.5,
    example: '0',
    description: '変動後1ヶ月目の現物による額'
  },
  {
    id: 'm1Total',
    name: '⑬ 月1 合計額',
    section: 'row_template',
    x: 42.0,
    y: 6.2,
    fontSize: 9.5,
    width: 10.5,
    example: '350,000',
    description: '変動後1ヶ月目の合計（⑪+⑫）'
  },

  // 月2
  {
    id: 'm2Month',
    name: '⑨ 月2 支給月',
    section: 'row_template',
    x: 10.0,
    y: 8.2,
    fontSize: 10.0,
    width: 4.5,
    example: '7月',
    description: '変動後2ヶ月目の支給月'
  },
  {
    id: 'm2Days',
    name: '⑩ 月2 基礎日数',
    section: 'row_template',
    x: 16.5,
    y: 8.2,
    fontSize: 10.0,
    width: 5.0,
    example: '22日',
    description: '変動後2ヶ月目の支払基礎日数'
  },
  {
    id: 'm2Cash',
    name: '⑪ 月2 通貨額',
    section: 'row_template',
    x: 23.0,
    y: 8.2,
    fontSize: 9.5,
    width: 9.5,
    example: '360,000',
    description: '変動後2ヶ月目の通貨による額'
  },
  {
    id: 'm2InKind',
    name: '⑫ 月2 現物額',
    section: 'row_template',
    x: 33.5,
    y: 8.2,
    fontSize: 9.5,
    width: 7.5,
    example: '0',
    description: '変動後2ヶ月目の現物による額'
  },
  {
    id: 'm2Total',
    name: '⑬ 月2 合計額',
    section: 'row_template',
    x: 42.0,
    y: 8.2,
    fontSize: 9.5,
    width: 10.5,
    example: '360,000',
    description: '変動後2ヶ月目の合計（⑪+⑫）'
  },

  // 月3
  {
    id: 'm3Month',
    name: '⑨ 月3 支給月',
    section: 'row_template',
    x: 10.0,
    y: 10.2,
    fontSize: 10.0,
    width: 4.5,
    example: '8月',
    description: '変動後3ヶ月目の支給月'
  },
  {
    id: 'm3Days',
    name: '⑩ 月3 基礎日数',
    section: 'row_template',
    x: 16.5,
    y: 10.2,
    fontSize: 10.0,
    width: 5.0,
    example: '20日',
    description: '変動後3ヶ月目の支払基礎日数'
  },
  {
    id: 'm3Cash',
    name: '⑪ 月3 通貨額',
    section: 'row_template',
    x: 23.0,
    y: 10.2,
    fontSize: 9.5,
    width: 9.5,
    example: '355,000',
    description: '変動後3ヶ月目の通貨による額'
  },
  {
    id: 'm3InKind',
    name: '⑫ 月3 現物額',
    section: 'row_template',
    x: 33.5,
    y: 10.2,
    fontSize: 9.5,
    width: 7.5,
    example: '0',
    description: '変動後3ヶ月目の現物による額'
  },
  {
    id: 'm3Total',
    name: '⑬ 月3 合計額',
    section: 'row_template',
    x: 42.0,
    y: 10.2,
    fontSize: 9.5,
    width: 10.5,
    example: '355,000',
    description: '変動後3ヶ月目の合計（⑪+⑫）'
  },

  // 3ヶ月総計・平均
  {
    id: 'empTotalWage',
    name: '⑭ 総計（3ヶ月合計）',
    section: 'row_template',
    x: 58.0,
    y: 6.8,
    fontSize: 10.0,
    width: 13.0,
    example: '1,065,000',
    description: '⑭ 3ヶ月間の合計額の総和'
  },
  {
    id: 'empAverageWage',
    name: '⑮ 平均額（総計 ÷ 3）',
    section: 'row_template',
    x: 58.0,
    y: 9.2,
    fontSize: 10.5,
    width: 13.0,
    example: '355,000',
    description: '⑮ 総計を3で除した平均額（1円未満切捨）'
  },
  {
    id: 'empModifiedAverage',
    name: '⑯ 修正平均額',
    section: 'row_template',
    x: 58.0,
    y: 11.2,
    fontSize: 9.5,
    width: 13.0,
    example: '',
    description: '⑯ 遡及差額等を除外した修正平均額'
  }
];

// ローカルストレージキー
export const MONTHLY_REVISION_COORDS_STORAGE_KEY = 'monthly_revision_doc_coordinates_custom';

export function getMonthlyRevisionStorageKey(tenantId?: string): string {
  return tenantId ? `${MONTHLY_REVISION_COORDS_STORAGE_KEY}_${tenantId}` : MONTHLY_REVISION_COORDS_STORAGE_KEY;
}

export function loadMonthlyRevisionDocCoordinates(tenantId?: string): MonthlyRevisionDocFieldConfig[] {
  try {
    const raw = localStorage.getItem(getMonthlyRevisionStorageKey(tenantId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return mergeWithDefaultRevisionFields(parsed);
      }
    }
  } catch (e) {
    console.warn('Failed to load monthly revision doc coordinates from localStorage:', e);
  }
  return DEFAULT_MONTHLY_REVISION_FIELDS;
}

export function saveMonthlyRevisionDocCoordinates(fields: MonthlyRevisionDocFieldConfig[], tenantId?: string): void {
  try {
    localStorage.setItem(getMonthlyRevisionStorageKey(tenantId), JSON.stringify(fields));
    broadcastMonthlyRevisionDocCoordinates(fields, tenantId);
  } catch (e) {
    console.warn('Failed to save monthly revision doc coordinates to localStorage:', e);
  }
}

export function resetMonthlyRevisionDocCoordinates(tenantId?: string): MonthlyRevisionDocFieldConfig[] {
  try {
    localStorage.removeItem(getMonthlyRevisionStorageKey(tenantId));
    broadcastMonthlyRevisionDocCoordinates(DEFAULT_MONTHLY_REVISION_FIELDS, tenantId);
  } catch (e) {
    console.warn('Failed to reset monthly revision doc coordinates in localStorage:', e);
  }
  return DEFAULT_MONTHLY_REVISION_FIELDS;
}

export function broadcastMonthlyRevisionDocCoordinates(fields: MonthlyRevisionDocFieldConfig[], tenantId?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MONTHLY_REVISION_COORDS_UPDATE_EVENT, { 
      detail: { fields, tenantId } 
    }));
  }
}

export function mergeWithDefaultRevisionFields(saved: MonthlyRevisionDocFieldConfig[]): MonthlyRevisionDocFieldConfig[] {
  const map = new Map<string, MonthlyRevisionDocFieldConfig>();
  saved.forEach(f => map.set(f.id, f));

  return DEFAULT_MONTHLY_REVISION_FIELDS.map(def => {
    const found = map.get(def.id);
    if (!found) return def;
    return {
      ...def,
      ...found,
      section: def.section
    };
  });
}

// DBから最新座標を取得し、localStorageを更新して返す
export const fetchMonthlyRevisionDocCoordinatesFromDb = async (tenantId?: string): Promise<MonthlyRevisionDocFieldConfig[]> => {
  try {
    let saved: any = null;
    if (tenantId) {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('monthly_revision_doc_coordinates')
        .eq('id', tenantId)
        .maybeSingle();
      if (tenantData?.monthly_revision_doc_coordinates && Array.isArray(tenantData.monthly_revision_doc_coordinates)) {
        saved = tenantData.monthly_revision_doc_coordinates;
      }
    }
    if (!saved) {
      const { data } = await supabase.from('system_settings').select('monthly_revision_doc_coordinates').limit(1).maybeSingle();
      saved = data?.monthly_revision_doc_coordinates;
    }

    if (saved && Array.isArray(saved) && saved.length > 0) {
      const merged = mergeWithDefaultRevisionFields(saved);
      broadcastMonthlyRevisionDocCoordinates(merged, tenantId);
      return merged;
    }
  } catch (err) {
    console.warn('DBから月額変更届座標の取得をスキップ（ローカル値を使用）:', err);
  }
  return loadMonthlyRevisionDocCoordinates(tenantId);
};

// Supabase DB への保存
export async function saveMonthlyRevisionDocCoordinatesToDb(fields: MonthlyRevisionDocFieldConfig[], tenantId?: string): Promise<boolean> {
  try {
    saveMonthlyRevisionDocCoordinates(fields, tenantId);

    if (tenantId) {
      const res = await supabase
        .from('tenants')
        .update({ monthly_revision_doc_coordinates: fields })
        .eq('id', tenantId);
      if (res.error) {
        console.warn('Could not update tenant monthly_revision_doc_coordinates:', res.error);
        return false;
      }
      return true;
    }

    const { data: current } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (current && current.id) {
      const res = await supabase
        .from('system_settings')
        .update({ 
          monthly_revision_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);
      if (res.error) console.warn('Could not update system_settings:', res.error);
    }
    return true;
  } catch (err) {
    console.error('Error saving monthly revision doc coordinates to DB:', err);
    return false;
  }
}
