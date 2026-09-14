import { supabase } from './supabase';

// ハローワーク公式「雇用保険被保険者資格取得届（様式第2号・第6条関係）」
// 原本マス目・OCR枠内印字の精密座標マスター定義

export const EMPLOYMENT_ACQ_COORDS_UPDATE_EVENT = 'employment-acq-coords-updated';

export interface EmploymentAcqFieldConfig {
  id: string;
  name: string;
  section: 'header' | 'employee_basic' | 'employment_condition' | 'contract' | 'foreigner' | 'office';
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当
  pitch?: number; // % マス目間隔
  width?: number; // % 表示枠の幅
  example: string;
  description: string;
  disabled?: boolean;
}

// 🎯 原本PDF（様式第2号 A4縦）の枠内にぴったり収まる黄金比率デフォルト値
export const DEFAULT_EMPLOYMENT_ACQ_FIELDS: EmploymentAcqFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① ヘッダー・番号欄
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'docTypeFixed',
    name: '帳票種別（19101）',
    section: 'header',
    x: 8.8,
    y: 8.5,
    fontSize: 13,
    pitch: 2.7,
    width: 14.0,
    example: '19101',
    description: '左上固定帳票種別コード（5マス）'
  },
  {
    id: 'myNumber',
    name: '1. 個人番号（マイナンバー12桁）',
    section: 'header',
    x: 29.8,
    y: 8.5,
    fontSize: 13,
    pitch: 2.7,
    width: 33.0,
    example: '123456789012',
    description: 'マイナンバー12桁枠'
  },
  {
    id: 'insuredNumber',
    name: '2. 被保険者番号（4桁-6桁-1桁）',
    section: 'header',
    x: 8.8,
    y: 13.7,
    fontSize: 13,
    pitch: 2.7,
    width: 32.5,
    example: '12345678901',
    description: '被保険者番号枠（再取得時のみ記載）'
  },
  {
    id: 'acqType',
    name: '3. 取得区分（1:新規 / 2:再取得）',
    section: 'header',
    x: 52.8,
    y: 13.7,
    fontSize: 13,
    width: 3.5,
    example: '1',
    description: '1:新規、2:再取得'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 氏名・生年月日・性別
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'nameKana',
    name: '4. 被保険者氏名 フリガナ（カタカナ）',
    section: 'employee_basic',
    x: 30.2,
    y: 17.8,
    fontSize: 11,
    pitch: 2.25,
    width: 63.0,
    example: 'コマイ　シュウイチロウ',
    description: 'カタカナ氏名枠（姓と名の間は1マス空け）'
  },
  {
    id: 'nameKanaChanged',
    name: '5. 変更後の氏名 フリガナ',
    section: 'employee_basic',
    x: 30.2,
    y: 21.8,
    fontSize: 11,
    pitch: 2.25,
    width: 63.0,
    example: '',
    description: '再取得時で氏名変更があった場合のみ'
  },
  {
    id: 'gender',
    name: '6. 性別（1:男 / 2:女）',
    section: 'employee_basic',
    x: 8.8,
    y: 26.2,
    fontSize: 13,
    width: 3.5,
    example: '1',
    description: '1:男、2:女'
  },
  {
    id: 'birthEra',
    name: '7. 生年月日 元号（2大正 3昭和 4平成 5令和）',
    section: 'employee_basic',
    x: 18.0,
    y: 26.2,
    fontSize: 13,
    width: 3.5,
    example: '5',
    description: '2:大正、3:昭和、4:平成、5:令和'
  },
  {
    id: 'birthYMD',
    name: '7. 生年月日（YYMMDD 6桁）',
    section: 'employee_basic',
    x: 23.2,
    y: 26.2,
    fontSize: 13,
    pitch: 2.7,
    width: 17.0,
    example: '020510',
    description: '年月日（各2桁、1桁の場合は0埋め）'
  },
  {
    id: 'officeNumber',
    name: '8. 事業所番号（4桁-6桁-1桁）',
    section: 'employee_basic',
    x: 50.5,
    y: 26.2,
    fontSize: 13,
    pitch: 2.7,
    width: 32.5,
    example: '25011234567',
    description: '雇用保険適用事業所番号（4桁-6桁-1桁）'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 雇用条件・賃金・取得年月日
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'causeCode',
    name: '9. 被保険者となったことの原因コード',
    section: 'employment_condition',
    x: 8.8,
    y: 31.8,
    fontSize: 13,
    width: 3.5,
    example: '2',
    description: '1:新卒、2:中途・その他、3:日雇切替、4:その他、8:出向復帰'
  },
  {
    id: 'wageType',
    name: '10. 賃金支払態様コード（1月給〜5他）',
    section: 'employment_condition',
    x: 25.5,
    y: 31.8,
    fontSize: 13,
    width: 3.5,
    example: '1',
    description: '1:月給、2:週給、3:日給、4:時間給、5:その他'
  },
  {
    id: 'wageAmount',
    name: '10. 賃金月額（単位千円・4桁）',
    section: 'employment_condition',
    x: 33.2,
    y: 31.8,
    fontSize: 13,
    pitch: 2.7,
    width: 11.5,
    example: '0250',
    description: '月額（百万、十万、万、千円の4マス、千円未満四捨五入）'
  },
  {
    id: 'acqEra',
    name: '11. 資格取得年月日 元号（4平成 5令和）',
    section: 'employment_condition',
    x: 59.2,
    y: 31.8,
    fontSize: 13,
    width: 3.5,
    example: '5',
    description: '4:平成、5:令和'
  },
  {
    id: 'acqYMD',
    name: '11. 資格取得年月日（YYMMDD 6桁）',
    section: 'employment_condition',
    x: 64.5,
    y: 31.8,
    fontSize: 13,
    pitch: 2.7,
    width: 17.0,
    example: '080401',
    description: '雇用開始日（YYMMDD）'
  },
  {
    id: 'employmentForm',
    name: '12. 雇用形態コード（1日雇〜7他）',
    section: 'employment_condition',
    x: 22.0,
    y: 37.0,
    fontSize: 13,
    width: 3.5,
    example: '7',
    description: '1:日雇、2:派遣、3:パート、4:有期契約、5:季節、6:船員、7:その他(正社員等)'
  },
  {
    id: 'jobCode',
    name: '13. 職種コード（01〜11 2桁）',
    section: 'employment_condition',
    x: 40.0,
    y: 37.0,
    fontSize: 13,
    pitch: 2.7,
    width: 6.0,
    example: '03',
    description: '01管理的、02専門技術、03事務、04販売、05サービス等の2桁コード'
  },
  {
    id: 'routeCode',
    name: '14. 就職経路コード（1安定所〜4他）',
    section: 'employment_condition',
    x: 52.8,
    y: 37.0,
    fontSize: 13,
    width: 3.5,
    example: '2',
    description: '1:安定所紹介、2:自己就職、3:民間紹介、4:把握していない'
  },
  {
    id: 'weeklyHours',
    name: '15. 1週間の所定労働時間（時間2桁 分2桁）',
    section: 'employment_condition',
    x: 67.2,
    y: 37.0,
    fontSize: 13,
    pitch: 2.7,
    width: 15.0,
    example: '4000',
    description: '週所定労働時間（例: 40時間00分なら 4000）'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ④ 契約期間の定め
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'contractFixed',
    name: '16. 契約期間の定め（1:有 / 2:無）',
    section: 'contract',
    x: 20.0,
    y: 43.5,
    fontSize: 13,
    width: 3.5,
    example: '2',
    description: '1:有、2:無'
  },
  {
    id: 'contractRenew',
    name: '16. 契約更新条項の有無（1:有 / 2:無）',
    section: 'contract',
    x: 42.8,
    y: 46.8,
    fontSize: 12,
    width: 3.0,
    example: '2',
    description: '1:有、2:無'
  },
  {
    id: 'officeNameText',
    name: '事業所名（漢字）',
    section: 'office',
    x: 15.0,
    y: 50.2,
    fontSize: 10,
    width: 32.0,
    example: '株式会社KAP',
    description: '事業所名'
  },
  {
    id: 'remarksText',
    name: '備考（役員兼務や具体的理由等）',
    section: 'office',
    x: 55.0,
    y: 50.2,
    fontSize: 10,
    width: 30.0,
    example: '',
    description: '備考欄'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ⑤ 事業主署名・届出日・提出先
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'submitYear',
    name: '届出日 令和年',
    section: 'office',
    x: 75.2,
    y: 77.8,
    fontSize: 11,
    width: 4.0,
    example: '8',
    description: '令和〇年'
  },
  {
    id: 'submitMonth',
    name: '届出日 月',
    section: 'office',
    x: 82.5,
    y: 77.8,
    fontSize: 11,
    width: 4.0,
    example: '4',
    description: '〇月'
  },
  {
    id: 'submitDay',
    name: '届出日 日',
    section: 'office',
    x: 89.2,
    y: 77.8,
    fontSize: 11,
    width: 4.0,
    example: '10',
    description: '〇日'
  },
  {
    id: 'employerAddress',
    name: '事業主 住所',
    section: 'office',
    x: 16.0,
    y: 78.5,
    fontSize: 10,
    width: 50.0,
    example: '滋賀県大津市坂本3丁目21-16',
    description: '事業主所在地'
  },
  {
    id: 'employerName',
    name: '事業主 氏名・代表者名',
    section: 'office',
    x: 16.0,
    y: 81.8,
    fontSize: 11,
    width: 50.0,
    example: '株式会社KAP　代表取締役 駒井 秀一朗',
    description: '事業主名称および代表取締役氏名'
  },
  {
    id: 'employerPhone',
    name: '事業主 電話番号',
    section: 'office',
    x: 16.0,
    y: 85.0,
    fontSize: 11,
    width: 30.0,
    example: '077-574-6907',
    description: '事業所電話番号'
  },
  {
    id: 'targetHelloWork',
    name: '所轄公共職業安定所名',
    section: 'office',
    x: 70.0,
    y: 81.8,
    fontSize: 11,
    width: 15.0,
    example: '大津',
    description: '〇〇 公共職業安定所長 殿'
  }
];

// ローカルストレージキー
const STORAGE_KEY = 'employment_acq_doc_coords';

// 座標設定の読み込み
export function loadEmploymentAcqCoordinates(): EmploymentAcqFieldConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const map = new Map(parsed.map(f => [f.id, f]));
        return DEFAULT_EMPLOYMENT_ACQ_FIELDS.map(def => {
          const custom = map.get(def.id);
          if (custom) {
            return {
              ...def,
              x: custom.x,
              y: custom.y,
              fontSize: custom.fontSize,
              pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
              width: custom.width !== undefined ? custom.width : def.width,
              disabled: custom.disabled
            };
          }
          return def;
        });
      }
    }
  } catch (err) {
    console.warn('Failed to parse local employment acq coordinates:', err);
  }
  return DEFAULT_EMPLOYMENT_ACQ_FIELDS;
}

// 座標設定の保存
export function saveEmploymentAcqCoordinates(fields: EmploymentAcqFieldConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
    broadcastEmploymentAcqCoordinates(fields);
  } catch (err) {
    console.error('Failed to save employment acq coordinates:', err);
  }
}

// リアルタイム反映イベント送信
export function broadcastEmploymentAcqCoordinates(fields: EmploymentAcqFieldConfig[]) {
  window.dispatchEvent(new CustomEvent(EMPLOYMENT_ACQ_COORDS_UPDATE_EVENT, { detail: fields }));
}

// Supabase DB からの読み込み
export async function fetchEmploymentAcqCoordinatesFromDb(): Promise<EmploymentAcqFieldConfig[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('employment_acq_doc_coordinates')
      .limit(1)
      .single();

    const saved = data?.employment_acq_doc_coordinates;
    if (saved && Array.isArray(saved)) {
      const map = new Map(saved.map((f: any) => [f.id, f]));
      const merged = DEFAULT_EMPLOYMENT_ACQ_FIELDS.map(def => {
        const custom = map.get(def.id);
        if (custom) {
          return {
            ...def,
            x: custom.x,
            y: custom.y,
            fontSize: custom.fontSize,
            pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
            width: custom.width !== undefined ? custom.width : def.width,
            disabled: custom.disabled
          };
        }
        return def;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('DB fetch failed, fallback to local:', err);
  }
  return loadEmploymentAcqCoordinates();
}

// Supabase DB への保存
export async function saveEmploymentAcqCoordinatesToDb(fields: EmploymentAcqFieldConfig[]): Promise<boolean> {
  try {
    saveEmploymentAcqCoordinates(fields);
    const { error } = await supabase
      .from('system_settings')
      .update({ employment_acq_doc_coordinates: fields })
      .match({ id: 1 });

    if (error) {
      console.warn('Could not update system_settings DB (may need column):', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving employment acq coordinates to DB:', err);
    return false;
  }
}
