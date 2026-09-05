import { supabase } from './supabase';

// 日本年金機構「健康保険・厚生年金保険 被保険者賞与支払届（コード2265用紙）」
// 原本マス目・枠内印字の精密座標マスター定義

export const BONUS_COORDS_UPDATE_EVENT = 'bonus-doc-coords-updated';

export interface BonusDocFieldConfig {
  id: string;
  name: string;
  section: 'submission' | 'office' | 'common_payment' | 'row_template';
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当（6〜24）
  pitch?: number; // % または gap (マス目・数字間隔)
  width?: number; // % (表示枠の幅)
  example: string;
  description: string;
  disabled?: boolean;
}

// 🎯 原本PDF（コード2265用紙）にぴったり収まる黄金比率デフォルト値
export const DEFAULT_BONUS_FIELDS: BonusDocFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① 提出年月日
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'subDateY',
    name: '提出年（和暦数字）',
    section: 'submission',
    x: 5.2,
    y: 4.5,
    fontSize: 11,
    width: 2.4,
    example: '8',
    description: '最上部「令和」と「年」の間の空欄'
  },
  {
    id: 'subDateM',
    name: '提出月（数字）',
    section: 'submission',
    x: 10.0,
    y: 4.5,
    fontSize: 11,
    width: 3.0,
    example: '12',
    description: '最上部「年」と「月」の間の空欄'
  },
  {
    id: 'subDateD',
    name: '提出日（数字）',
    section: 'submission',
    x: 15.6,
    y: 4.5,
    fontSize: 11,
    width: 4.0,
    example: '15',
    description: '最上部「月」と「日提出」の間の空欄'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 事業所情報 ＆ 整理記号
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'symbolDigits',
    name: '事業所整理記号（数字2マス）',
    section: 'office',
    x: 10.00,
    y: 6.16,
    fontSize: 14,
    pitch: 2.58,
    width: 5.16,
    example: '25',
    description: '整理記号左側2マス（数字、ハイフンの左）'
  },
  {
    id: 'symbolKana',
    name: '事業所整理記号（カタカナ4マス）',
    section: 'office',
    x: 17.42,
    y: 6.16,
    fontSize: 13,
    pitch: 2.42,
    width: 9.68,
    example: 'カア',
    description: '整理記号右側4マス（カタカナ、ハイフンの右）'
  },
  {
    id: 'companyAddress',
    name: '事業所所在地（住所）',
    section: 'office',
    x: 11.0,
    y: 12.0,
    fontSize: 9,
    width: 38.0,
    example: '滋賀県大津市坂本3丁目21-16',
    description: '事業所所在地欄'
  },
  {
    id: 'companyName',
    name: '事業所名称（会社名）',
    section: 'office',
    x: 11.0,
    y: 18.0,
    fontSize: 11,
    width: 38.0,
    example: '株式会社cocotte',
    description: '事業所名称欄'
  },
  {
    id: 'companyOwnerName',
    name: '事業主氏名（代表者）',
    section: 'office',
    x: 11.0,
    y: 21.8,
    fontSize: 11,
    width: 38.0,
    example: '代表取締役 駒井 秀一朗',
    description: '事業主氏名欄'
  },
  {
    id: 'companyPhone',
    name: '電話番号',
    section: 'office',
    x: 19.0,
    y: 24.6,
    fontSize: 10,
    width: 24.0,
    example: '077-512-3456',
    description: '電話番号欄（市外局番右側）'
  },
  {
    id: 'sharoushiName',
    name: '社会保険労務士記載欄',
    section: 'office',
    x: 54.5,
    y: 22.5,
    fontSize: 11,
    width: 38.0,
    example: '社会保険労務士法人 テスト',
    description: '右側 社会保険労務士記載欄'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 共通賞与支払年月日
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'commonDateY',
    name: '共通支払年（和暦数字）',
    section: 'common_payment',
    x: 37.5,
    y: 31.3,
    fontSize: 12,
    width: 5.5,
    example: '8',
    description: '共通支払年月日「年」枠内'
  },
  {
    id: 'commonDateM',
    name: '共通支払月（数字）',
    section: 'common_payment',
    x: 46.0,
    y: 31.3,
    fontSize: 12,
    width: 5.5,
    example: '12',
    description: '共通支払年月日「月」枠内'
  },
  {
    id: 'commonDateD',
    name: '共通支払日（数字）',
    section: 'common_payment',
    x: 54.5,
    y: 31.3,
    fontSize: 12,
    width: 5.5,
    example: '10',
    description: '共通支払年月日「日」枠内'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ④ 被保険者行テンプレート（行1のオフセットおよび行ピッチ）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'rowBaseTop',
    name: '【行基準】1行目の上端Y座標',
    section: 'row_template',
    x: 0,
    y: 34.26,
    fontSize: 0,
    example: '34.26%',
    description: '被保険者行1の開始Y位置（%）'
  },
  {
    id: 'rowPitchY',
    name: '【行基準】1行あたりの高さピッチ',
    section: 'row_template',
    x: 0,
    y: 5.770,
    fontSize: 0,
    example: '5.770%',
    description: '次の行までの垂直間隔（%）'
  },
  {
    id: 'empInsuranceNumber',
    name: '① 被保険者整理番号',
    section: 'row_template',
    x: 4.8,
    y: 0.92,
    fontSize: 12,
    width: 18.0,
    example: '0001',
    description: '上段左端 ①整理番号（マス内中央）'
  },
  {
    id: 'empKana',
    name: '② 被保険者ふりがな',
    section: 'row_template',
    x: 23.8,
    y: 0.30,
    fontSize: 8.5,
    width: 31.0,
    example: 'テスト タロウ',
    description: '上段氏名欄の「上半分（ふりがな）」'
  },
  {
    id: 'empName',
    name: '② 被保険者漢字氏名',
    section: 'row_template',
    x: 23.8,
    y: 1.30,
    fontSize: 12.5,
    width: 31.0,
    example: '山田 太郎',
    description: '上段氏名欄の「下半分（漢字）」'
  },
  {
    id: 'empBirth',
    name: '③ 生年月日（公式書式 元号-YYMMDD）',
    section: 'row_template',
    x: 55.6,
    y: 0.90,
    fontSize: 12.5,
    width: 14.5,
    example: '7 - 051020',
    description: '上段中央 ③生年月日枠内（中央揃え）'
  },
  {
    id: 'empMyNumber',
    name: '⑦ 個人番号［基礎年金番号］（70歳以上）',
    section: 'row_template',
    x: 70.4,
    y: 0.90,
    fontSize: 10,
    pitch: 1.88,
    width: 22.8,
    example: '123456789012',
    description: '上段右端 ⑦個人番号マス目'
  },
  {
    id: 'empIndivPayDate',
    name: '④ 個別賞与支払日（共通と異なる場合）',
    section: 'row_template',
    x: 4.8,
    y: 3.60,
    fontSize: 10,
    width: 18.0,
    example: '令08.12.20',
    description: '下段左端 ④個別支払日'
  },
  {
    id: 'empCurrencyAmount',
    name: '⑤ ㋐ 通貨による賞与額',
    section: 'row_template',
    x: 23.8,
    y: 3.60,
    fontSize: 11.5,
    width: 14.6,
    example: '500,000',
    description: '下段 ⑤㋐通貨賞与額（右端は「円」の左隣）'
  },
  {
    id: 'empGoodsAmount',
    name: '⑤ ㋑ 現物による賞与額',
    section: 'row_template',
    x: 39.8,
    y: 3.60,
    fontSize: 11.5,
    width: 14.6,
    example: '0',
    description: '下段 ⑤㋑現物賞与額（右端は「円」の左隣）'
  },
  {
    id: 'empTotalThousands',
    name: '⑥ 合計賞与額（千円未満切捨て、千円以上数値）',
    section: 'row_template',
    x: 55.8,
    y: 3.60,
    fontSize: 11.5,
    width: 9.8,
    example: '500',
    description: '下段 ⑥「,000円」の左隣（右寄せ・備考欄への被り完全防止）'
  }
];

// デフォルト値とカスタム設定を安全にマージする関数
export const mergeWithDefaultBonusFields = (customList: any[]): BonusDocFieldConfig[] => {
  if (!Array.isArray(customList) || customList.length === 0) {
    return DEFAULT_BONUS_FIELDS;
  }
  const map = new Map<string, any>(customList.map((p: any) => [p.id, p]));
  return DEFAULT_BONUS_FIELDS.map(def => {
    const custom = map.get(def.id);
    if (custom) {
      return {
        ...def,
        x: typeof custom.x === 'number' ? custom.x : def.x,
        y: typeof custom.y === 'number' ? custom.y : def.y,
        fontSize: typeof custom.fontSize === 'number' ? custom.fontSize : def.fontSize,
        pitch: typeof custom.pitch === 'number' ? custom.pitch : def.pitch,
        width: typeof custom.width === 'number' ? custom.width : def.width,
        disabled: custom.disabled !== undefined ? custom.disabled : def.disabled
      };
    }
    return def;
  });
};

// 設定をローカルストレージから読み込むヘルパー（精密比率 v3_pixel_perfect_2026 への自動マイグレーション付き）
export const BONUS_DOC_COORDINATES_VERSION = 'v3_pixel_perfect_2026';

export const loadBonusDocCoordinates = (): BonusDocFieldConfig[] => {
  try {
    const savedVersion = localStorage.getItem('bonusDocMasterVersion');
    const local = localStorage.getItem('bonusDocMasterFields');

    // バージョンが古い、または未定義の場合は最新の精密測定デフォルト値へ自動マイグレーション
    if (savedVersion !== BONUS_DOC_COORDINATES_VERSION || !local) {
      localStorage.setItem('bonusDocMasterVersion', BONUS_DOC_COORDINATES_VERSION);
      localStorage.setItem('bonusDocMasterFields', JSON.stringify(DEFAULT_BONUS_FIELDS));
      return DEFAULT_BONUS_FIELDS;
    }

    const parsed = JSON.parse(local);
    if (Array.isArray(parsed)) {
      // 提出月や整理記号カタカナがズレている古い座標だった場合は最新値に自動更新
      const subM = parsed.find((p: any) => p.id === 'subDateM');
      const kanaF = parsed.find((p: any) => p.id === 'symbolKana');
      const totalField = parsed.find((p: any) => p.id === 'empTotalThousands');
      if ((subM && subM.x > 18.0) || (kanaF && kanaF.x > 20.0) || (totalField && totalField.x >= 57.0)) {
        localStorage.setItem('bonusDocMasterVersion', BONUS_DOC_COORDINATES_VERSION);
        localStorage.setItem('bonusDocMasterFields', JSON.stringify(DEFAULT_BONUS_FIELDS));
        return DEFAULT_BONUS_FIELDS;
      }
      return mergeWithDefaultBonusFields(parsed);
    }
  } catch (e) {
    console.error('Failed to load bonus doc coordinates from localStorage:', e);
  }
  return DEFAULT_BONUS_FIELDS;
};

// 座標設定をlocalStorageに保存し、同一タブ・別コンポーネントへリアルタイムイベントを通知する
export const broadcastBonusDocCoordinates = (fields: BonusDocFieldConfig[]) => {
  try {
    localStorage.setItem('bonusDocMasterFields', JSON.stringify(fields));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(BONUS_COORDS_UPDATE_EVENT, { detail: fields }));
    }
  } catch (e) {
    console.error('Failed to broadcast bonus doc coordinates:', e);
  }
};

// DB（Supabase system_settings）から最新座標を取得し、localStorageを更新して返す
export const fetchBonusDocCoordinatesFromDb = async (): Promise<BonusDocFieldConfig[]> => {
  try {
    const { data } = await supabase.from('system_settings').select('bonus_doc_coordinates').limit(1).maybeSingle();
    const saved = data?.bonus_doc_coordinates;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      const merged = mergeWithDefaultBonusFields(saved);
      broadcastBonusDocCoordinates(merged);
      return merged;
    }
  } catch (err) {
    console.warn('DBから賞与支払届座標の取得をスキップ（ローカル値を使用）:', err);
  }
  return loadBonusDocCoordinates();
};

