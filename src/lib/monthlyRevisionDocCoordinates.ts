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
    x: 14.5,
    y: 5.7,
    fontSize: 11,
    width: 3.5,
    example: '8',
    description: '最上部「令和」と「年」の間の空欄'
  },
  {
    id: 'subDateM',
    name: '提出月（数字）',
    section: 'submission',
    x: 19.5,
    y: 5.7,
    fontSize: 11,
    width: 3.5,
    example: '9',
    description: '最上部「年」と「月」の間の空欄'
  },
  {
    id: 'subDateD',
    name: '提出日（数字）',
    section: 'submission',
    x: 24.2,
    y: 5.7,
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
    x: 14.8,
    y: 8.4,
    fontSize: 13,
    pitch: 2.30,
    width: 9.8,
    example: '2501',
    description: '整理記号左側4マス（数字・各マス中央揃え）'
  },
  {
    id: 'symbolKana',
    name: '事業所整理記号（カタカナ4マス）',
    section: 'office',
    x: 26.6,
    y: 8.4,
    fontSize: 12.5,
    pitch: 2.30,
    width: 9.8,
    example: 'カア',
    description: '整理記号右側4マス（カタカナ・ハイフンの右）'
  },
  {
    id: 'companyZipFirst',
    name: '事業所郵便番号（上3桁）',
    section: 'office',
    x: 17.5,
    y: 11.8,
    fontSize: 11.0,
    width: 4.0,
    pitch: 1.30,
    example: '520',
    description: '事業所所在地 郵便番号 上3桁（〒の直後、ハイフンの左）'
  },
  {
    id: 'companyZipLast',
    name: '事業所郵便番号（下4桁）',
    section: 'office',
    x: 23.2,
    y: 11.8,
    fontSize: 11.0,
    width: 5.5,
    pitch: 1.30,
    example: '0043',
    description: '事業所所在地 郵便番号 下4桁（ハイフンの右）'
  },
  {
    id: 'companyAddress',
    name: '事業所所在地（住所）',
    section: 'office',
    x: 12.0,
    y: 13.0,
    fontSize: 9.0,
    width: 36.0,
    example: '滋賀県大津市中央1-2-3 サンプルビル4F',
    description: '事業所所在地欄'
  },
  {
    id: 'companyName',
    name: '事業所名称（会社名）',
    section: 'office',
    x: 12.0,
    y: 16.5,
    fontSize: 10.5,
    width: 36.0,
    example: '株式会社サンプル商事',
    description: '事業所名称欄'
  },
  {
    id: 'companyOwnerName',
    name: '事業主氏名（代表者名）',
    section: 'office',
    x: 12.0,
    y: 19.2,
    fontSize: 10.5,
    width: 36.0,
    example: '代表取締役 山田 太郎',
    description: '事業主氏名欄'
  },
  {
    id: 'companyPhone',
    name: '事業所電話番号',
    section: 'office',
    x: 13.0,
    y: 21.8,
    fontSize: 9.5,
    width: 22.0,
    example: '077-512-3456',
    description: '電話番号欄'
  },
  {
    id: 'sharoushiName',
    name: '社会保険労務士記載欄',
    section: 'office',
    x: 54.0,
    y: 19.5,
    fontSize: 9.5,
    width: 38.0,
    example: '社会保険労務士 鈴木 一郎 印',
    description: '社会保険労務士記載欄（右側）'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 従業員 行共通マスター（1行の基本座標と次行へのピッチ）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'rowBaseTop',
    name: '1行目 基準Y座標 (%)',
    section: 'row_template',
    x: 0,
    y: 31.6,
    fontSize: 0,
    example: '31.6',
    description: '1行目上端の全体Y座標パーセント'
  },
  {
    id: 'rowPitchY',
    name: '行間ピッチY (%)',
    section: 'row_template',
    x: 0,
    y: 11.93,
    fontSize: 0,
    example: '11.93',
    description: '次行（2行目、3行目...）までの縦方向の幅'
  },

  // ── 行内 1段目（氏名・番号等） ──
  {
    id: 'empInsuranceNumber',
    name: '① 被保険者整理番号',
    section: 'row_template',
    x: 9.8,
    y: 0.6,
    fontSize: 11,
    width: 11.0,
    example: '101',
    description: '1段目：被保険者整理番号（中央揃え）'
  },
  {
    id: 'empName',
    name: '② 被保険者氏名',
    section: 'row_template',
    x: 21.6,
    y: 0.6,
    fontSize: 11,
    width: 22.0,
    example: '駒井 修一郎',
    description: '1段目：氏名（左寄せ/中央）'
  },
  {
    id: 'empBirth',
    name: '③ 生年月日（年金機構元号コード形式）',
    section: 'row_template',
    x: 44.2,
    y: 0.6,
    fontSize: 10.5,
    width: 18.0,
    example: '5-630503',
    description: '1段目：生年月日（5:昭和 7:平成 9:令和 - YYMMDD）'
  },
  {
    id: 'empRevisionYearMonth',
    name: '④ 改定年月',
    section: 'row_template',
    x: 63.0,
    y: 0.6,
    fontSize: 10.5,
    width: 9.5,
    example: '8-09',
    description: '1段目：改定年月（元号年-月）'
  },
  {
    id: 'empMyNumber',
    name: '⑰ 個人番号（70歳以上のみ・12マス）',
    section: 'row_template',
    x: 73.6,
    y: 0.6,
    fontSize: 10,
    pitch: 1.65,
    width: 21.0,
    example: '123456789012',
    description: '1段目：個人番号12桁マス目'
  },

  // ── 行内 2段目（従前標準報酬・改定理由等） ──
  {
    id: 'empCurrentHealthStandard',
    name: '⑤ 従前標準報酬（健康保険・千円）',
    section: 'row_template',
    x: 9.8,
    y: 2.8,
    fontSize: 10.5,
    width: 10.5,
    example: '300',
    description: '2段目：従前健康保険標準報酬（千円単位・右寄せ）'
  },
  {
    id: 'empCurrentPensionStandard',
    name: '⑤ 従前標準報酬（厚生年金・千円）',
    section: 'row_template',
    x: 21.0,
    y: 2.8,
    fontSize: 10.5,
    width: 10.5,
    example: '300',
    description: '2段目：従前厚生年金標準報酬（千円単位・右寄せ）'
  },
  {
    id: 'empPreviousRevisionYM',
    name: '⑥ 従前改定月',
    section: 'row_template',
    x: 32.5,
    y: 2.8,
    fontSize: 9.5,
    width: 11.0,
    example: '7-09',
    description: '2段目：従前の改定月'
  },
  {
    id: 'empWageChangeType',
    name: '⑦ 昇(降)給（区分・年月）',
    section: 'row_template',
    x: 44.5,
    y: 2.8,
    fontSize: 9.5,
    width: 12.0,
    example: '1.昇給 8-06',
    description: '2段目：昇降給区分および変動年月'
  },
  {
    id: 'empRetroactiveAmount',
    name: '⑧ 遡及支払額',
    section: 'row_template',
    x: 57.2,
    y: 2.8,
    fontSize: 9.5,
    width: 15.5,
    example: '0',
    description: '2段目：遡及支払額（右寄せ）'
  },
  {
    id: 'empRemarks',
    name: '⑱ 備考欄',
    section: 'row_template',
    x: 73.6,
    y: 2.8,
    fontSize: 8.5,
    width: 21.0,
    example: '4.昇給・降給の理由（基本給昇給）',
    description: '2段目：備考欄'
  },

  // ── 行内 3段目（3ヶ月支給実績・小行1〜3） ──
  {
    id: 'm1Month',
    name: '⑨ 1ヶ月目 支給月',
    section: 'row_template',
    x: 9.5,
    y: 5.6,
    fontSize: 9.5,
    width: 4.0,
    example: '6',
    description: '1ヶ月目：支給月'
  },
  {
    id: 'm1Days',
    name: '⑩ 1ヶ月目 基礎日数',
    section: 'row_template',
    x: 14.0,
    y: 5.6,
    fontSize: 9.5,
    width: 7.0,
    example: '21',
    description: '1ヶ月目：支払基礎日数'
  },
  {
    id: 'm1Cash',
    name: '⑪ 1ヶ月目 通貨による額',
    section: 'row_template',
    x: 21.5,
    y: 5.6,
    fontSize: 9.5,
    width: 10.5,
    example: '360,000',
    description: '1ヶ月目：通貨によるものの額'
  },
  {
    id: 'm1InKind',
    name: '⑫ 1ヶ月目 現物による額',
    section: 'row_template',
    x: 32.5,
    y: 5.6,
    fontSize: 9.5,
    width: 10.5,
    example: '0',
    description: '1ヶ月目：現物によるものの額'
  },
  {
    id: 'm1Total',
    name: '⑬ 1ヶ月目 合計額',
    section: 'row_template',
    x: 43.5,
    y: 5.6,
    fontSize: 9.5,
    width: 13.0,
    example: '360,000',
    description: '1ヶ月目：合計(⑪+⑫)'
  },

  {
    id: 'm2Month',
    name: '⑨ 2ヶ月目 支給月',
    section: 'row_template',
    x: 9.5,
    y: 7.7,
    fontSize: 9.5,
    width: 4.0,
    example: '7',
    description: '2ヶ月目：支給月'
  },
  {
    id: 'm2Days',
    name: '⑩ 2ヶ月目 基礎日数',
    section: 'row_template',
    x: 14.0,
    y: 7.7,
    fontSize: 9.5,
    width: 7.0,
    example: '22',
    description: '2ヶ月目：支払基礎日数'
  },
  {
    id: 'm2Cash',
    name: '⑪ 2ヶ月目 通貨による額',
    section: 'row_template',
    x: 21.5,
    y: 7.7,
    fontSize: 9.5,
    width: 10.5,
    example: '360,000',
    description: '2ヶ月目：通貨によるものの額'
  },
  {
    id: 'm2InKind',
    name: '⑫ 2ヶ月目 現物による額',
    section: 'row_template',
    x: 32.5,
    y: 7.7,
    fontSize: 9.5,
    width: 10.5,
    example: '0',
    description: '2ヶ月目：現物によるものの額'
  },
  {
    id: 'm2Total',
    name: '⑬ 2ヶ月目 合計額',
    section: 'row_template',
    x: 43.5,
    y: 7.7,
    fontSize: 9.5,
    width: 13.0,
    example: '360,000',
    description: '2ヶ月目：合計(⑪+⑫)'
  },

  {
    id: 'm3Month',
    name: '⑨ 3ヶ月目 支給月',
    section: 'row_template',
    x: 9.5,
    y: 9.8,
    fontSize: 9.5,
    width: 4.0,
    example: '8',
    description: '3ヶ月目：支給月'
  },
  {
    id: 'm3Days',
    name: '⑩ 3ヶ月目 基礎日数',
    section: 'row_template',
    x: 14.0,
    y: 9.8,
    fontSize: 9.5,
    width: 7.0,
    example: '20',
    description: '3ヶ月目：支払基礎日数'
  },
  {
    id: 'm3Cash',
    name: '⑪ 3ヶ月目 通貨による額',
    section: 'row_template',
    x: 21.5,
    y: 9.8,
    fontSize: 9.5,
    width: 10.5,
    example: '360,000',
    description: '3ヶ月目：通貨によるものの額'
  },
  {
    id: 'm3InKind',
    name: '⑫ 3ヶ月目 現物による額',
    section: 'row_template',
    x: 32.5,
    y: 9.8,
    fontSize: 9.5,
    width: 10.5,
    example: '0',
    description: '3ヶ月目：現物によるものの額'
  },
  {
    id: 'm3Total',
    name: '⑬ 3ヶ月目 合計額',
    section: 'row_template',
    x: 43.5,
    y: 9.8,
    fontSize: 9.5,
    width: 13.0,
    example: '360,000',
    description: '3ヶ月目：合計(⑪+⑫)'
  },

  // ── 3ヶ月総計・平均額・修正平均額 ──
  {
    id: 'empTotalWage',
    name: '⑭ 3ヶ月総計',
    section: 'row_template',
    x: 57.2,
    y: 5.6,
    fontSize: 10.5,
    width: 15.5,
    example: '1,080,000',
    description: '3ヶ月間の合計額の総計'
  },
  {
    id: 'empAverageWage',
    name: '⑮ 3ヶ月平均額',
    section: 'row_template',
    x: 57.2,
    y: 7.7,
    fontSize: 11,
    width: 15.5,
    example: '360,000',
    description: '3ヶ月総計÷3（1円未満切捨）'
  },
  {
    id: 'empModifiedAverage',
    name: '⑯ 修正平均額',
    section: 'row_template',
    x: 57.2,
    y: 9.8,
    fontSize: 10.5,
    width: 15.5,
    example: '360,000',
    description: '遡及差額等の補正後平均額'
  }
];

export function mergeWithDefaultMonthlyRevisionFields(
  customList: any[]
): MonthlyRevisionDocFieldConfig[] {
  if (!Array.isArray(customList) || customList.length === 0) {
    return [...DEFAULT_MONTHLY_REVISION_FIELDS];
  }

  return DEFAULT_MONTHLY_REVISION_FIELDS.map(def => {
    let custom = customList.find((p: any) => p.id === def.id);

    // 旧 companyZip（単一設定）からの安全自動マイグレーション
    if (!custom) {
      if (def.id === 'companyZipFirst' || def.id === 'companyZipLast') {
        const oldZip = customList.find((p: any) => p.id === 'companyZip');
        if (oldZip) {
          custom = {
            ...def,
            y: oldZip.y !== undefined ? oldZip.y : def.y,
            fontSize: oldZip.fontSize !== undefined ? oldZip.fontSize : def.fontSize
          };
        }
      }
    }

    if (custom) {
      return {
        ...def,
        x: custom.x !== undefined ? custom.x : def.x,
        y: custom.y !== undefined ? custom.y : def.y,
        fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
        pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
        width: custom.width !== undefined ? custom.width : def.width,
        example: def.example,
        disabled: custom.disabled
      };
    }

    return def;
  });
}

export const loadMonthlyRevisionDocCoordinates = (tenantId?: string): MonthlyRevisionDocFieldConfig[] => {
  const tKey = tenantId ? `monthly_revision_coords_${tenantId}` : 'monthly_revision_coords_default';
  const saved = localStorage.getItem(tKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return mergeWithDefaultMonthlyRevisionFields(parsed);
      }
    } catch (e) {
      console.error('Failed to parse local monthly revision coordinates:', e);
    }
  }
  return [...DEFAULT_MONTHLY_REVISION_FIELDS];
};

export const saveMonthlyRevisionDocCoordinates = (
  fields: MonthlyRevisionDocFieldConfig[],
  tenantId?: string
): void => {
  const tKey = tenantId ? `monthly_revision_coords_${tenantId}` : 'monthly_revision_coords_default';
  localStorage.setItem(tKey, JSON.stringify(fields));
  window.dispatchEvent(new CustomEvent(MONTHLY_REVISION_COORDS_UPDATE_EVENT, { detail: fields }));
};

export const resetMonthlyRevisionDocCoordinates = (tenantId?: string): MonthlyRevisionDocFieldConfig[] => {
  const tKey = tenantId ? `monthly_revision_coords_${tenantId}` : 'monthly_revision_coords_default';
  localStorage.removeItem(tKey);
  window.dispatchEvent(new CustomEvent(MONTHLY_REVISION_COORDS_UPDATE_EVENT, { detail: DEFAULT_MONTHLY_REVISION_FIELDS }));
  return [...DEFAULT_MONTHLY_REVISION_FIELDS];
};

export const fetchMonthlyRevisionDocCoordinatesFromDb = async (
  tenantId?: string
): Promise<MonthlyRevisionDocFieldConfig[]> => {
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
      const { data: sysData } = await supabase
        .from('system_settings')
        .select('monthly_revision_doc_coordinates')
        .limit(1)
        .maybeSingle();
      if (sysData?.monthly_revision_doc_coordinates && Array.isArray(sysData.monthly_revision_doc_coordinates)) {
        saved = sysData.monthly_revision_doc_coordinates;
      }
    }

    if (saved && Array.isArray(saved) && saved.length > 0) {
      const merged = mergeWithDefaultMonthlyRevisionFields(saved);
      saveMonthlyRevisionDocCoordinates(merged, tenantId);
      return merged;
    }
  } catch (err) {
    console.warn('DBから月額変更届座標の取得をスキップ（ローカル値を使用）:', err);
  }
  return loadMonthlyRevisionDocCoordinates(tenantId);
};

export interface SaveMonthlyRevisionCoordsResult {
  ok: boolean;
  inDb: boolean;
  message?: string;
}

export const saveMonthlyRevisionDocCoordinatesToDb = async (
  fields: MonthlyRevisionDocFieldConfig[],
  tenantId?: string
): Promise<SaveMonthlyRevisionCoordsResult> => {
  // ① まず確実にローカルストレージへ保存＆同一画面・他コンポーネントへブロードキャスト
  saveMonthlyRevisionDocCoordinates(fields, tenantId);

  let inDb = false;
  try {
    // ② テナント指定がある場合：tenants テーブルへ保存を試行
    if (tenantId) {
      const { error: tenantErr } = await supabase
        .from('tenants')
        .update({
          monthly_revision_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (!tenantErr) {
        inDb = true;
      } else {
        console.warn('tenantsテーブルへの月額変更届座標保存をスキップ（カラム未配備等）:', tenantErr.message);
      }
    }

    // ③ system_settings テーブルへの保存を試行（SuperAdmin・全社共通マスタ）
    const { data: current } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (current?.id) {
      const { error: sysUpdateErr } = await supabase
        .from('system_settings')
        .update({
          monthly_revision_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);

      if (!sysUpdateErr) inDb = true;
      else console.warn('system_settings update スキップ（カラム未配備等）:', sysUpdateErr.message);
    } else {
      const { error: sysInsertErr } = await supabase
        .from('system_settings')
        .insert([{
          monthly_revision_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        }]);

      if (!sysInsertErr) inDb = true;
      else console.warn('system_settings insert スキップ（カラム未配備等）:', sysInsertErr.message);
    }

    return { ok: true, inDb };
  } catch (err: any) {
    console.warn('DB永続化バックグラウンド例外（ローカル設定を維持）:', err);
    return { ok: true, inDb: false, message: err?.message };
  }
};
