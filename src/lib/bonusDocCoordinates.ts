// 日本年金機構「健康保険・厚生年金保険 被保険者賞与支払届（コード2265用紙）」
// 原本マス目・枠内印字の精密座標マスター定義

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
    x: 7.5,
    y: 4.6,
    fontSize: 11,
    width: 4.5,
    example: '8',
    description: '最上部「年」の左側'
  },
  {
    id: 'subDateM',
    name: '提出月（数字）',
    section: 'submission',
    x: 25.5,
    y: 4.6,
    fontSize: 11,
    width: 5.0,
    example: '12',
    description: '最上部「月」の左側'
  },
  {
    id: 'subDateD',
    name: '提出日（数字）',
    section: 'submission',
    x: 50.0,
    y: 4.6,
    fontSize: 11,
    width: 5.5,
    example: '15',
    description: '最上部「日提出」の左側'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 事業所情報 ＆ 整理記号
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'symbolDigits',
    name: '事業所整理記号（数字4マス）',
    section: 'office',
    x: 9.88,
    y: 6.16,
    fontSize: 14,
    pitch: 2.46,
    width: 9.84,
    example: '25',
    description: '整理記号左側4マス（数字）'
  },
  {
    id: 'symbolKana',
    name: '事業所整理記号（カタカナ4マス）',
    section: 'office',
    x: 22.38,
    y: 6.16,
    fontSize: 13,
    pitch: 2.38,
    width: 9.52,
    example: 'カア',
    description: '整理記号右側4マス（カタカナ）'
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
    y: 5.787,
    fontSize: 0,
    example: '5.787%',
    description: '次の行までの垂直間隔（%）'
  },
  {
    id: 'empInsuranceNumber',
    name: '① 被保険者整理番号',
    section: 'row_template',
    x: 5.2,
    y: 0.65,
    fontSize: 12,
    width: 18.0,
    example: '0001',
    description: '上段左端 ①整理番号'
  },
  {
    id: 'empKana',
    name: '② 被保険者ふりがな',
    section: 'row_template',
    x: 24.8,
    y: 0.35,
    fontSize: 9,
    width: 30.2,
    example: 'テスト タロウ',
    description: '上段氏名欄の「上半分（ふりがな）」'
  },
  {
    id: 'empName',
    name: '② 被保険者漢字氏名',
    section: 'row_template',
    x: 24.8,
    y: 1.40,
    fontSize: 13,
    width: 30.2,
    example: '山田 太郎',
    description: '上段氏名欄の「下半分（漢字）」'
  },
  {
    id: 'empBirth',
    name: '③ 生年月日（公式書式 元号-YYMMDD）',
    section: 'row_template',
    x: 57.0,
    y: 0.55,
    fontSize: 13,
    width: 13.0,
    example: '7 - 051020',
    description: '上段中央 ③生年月日枠内'
  },
  {
    id: 'empMyNumber',
    name: '⑦ 個人番号［基礎年金番号］（70歳以上）',
    section: 'row_template',
    x: 70.8,
    y: 0.55,
    fontSize: 10,
    pitch: 1.30,
    width: 17.5,
    example: '123456789012',
    description: '上段右端 ⑦個人番号マス目'
  },
  {
    id: 'empIndivPayDate',
    name: '④ 個別賞与支払日（共通と異なる場合）',
    section: 'row_template',
    x: 5.2,
    y: 3.65,
    fontSize: 10,
    width: 18.0,
    example: '令08.12.20',
    description: '下段左端 ④個別支払日'
  },
  {
    id: 'empCurrencyAmount',
    name: '⑤ ㋐ 通貨による賞与額',
    section: 'row_template',
    x: 24.0,
    y: 3.25,
    fontSize: 12,
    width: 14.5,
    example: '500,000',
    description: '下段 ⑤㋐通貨賞与額（右寄せ）'
  },
  {
    id: 'empGoodsAmount',
    name: '⑤ ㋑ 現物による賞与額',
    section: 'row_template',
    x: 41.5,
    y: 3.25,
    fontSize: 12,
    width: 14.5,
    example: '0',
    description: '下段 ⑤㋑現物賞与額（右寄せ）'
  },
  {
    id: 'empTotalThousands',
    name: '⑥ 合計賞与額（千円未満切捨て、千円以上数値）',
    section: 'row_template',
    x: 58.5,
    y: 3.25,
    fontSize: 12,
    width: 13.5,
    example: '500',
    description: '下段 ⑥「,000円」の左側（右寄せ）'
  }
];

// 設定をローカルまたはDBから読み込むヘルパー
export const loadBonusDocCoordinates = (): BonusDocFieldConfig[] => {
  try {
    const local = localStorage.getItem('bonusDocMasterFields');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        const map = new Map<string, any>(parsed.map((p: any) => [p.id, p]));
        return DEFAULT_BONUS_FIELDS.map(def => {
          const custom = map.get(def.id);
          if (custom) {
            return {
              ...def,
              x: custom.x !== undefined ? custom.x : def.x,
              y: custom.y !== undefined ? custom.y : def.y,
              fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
              pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
              width: custom.width !== undefined ? custom.width : def.width,
              disabled: custom.disabled !== undefined ? custom.disabled : def.disabled
            };
          }
          return def;
        });
      }
    }
  } catch (e) {
    console.error('Failed to load bonus doc coordinates:', e);
  }
  return DEFAULT_BONUS_FIELDS;
};
