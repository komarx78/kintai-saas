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

// 🎯 原本PDF（様式第2号 A4縦: 210mm × 297mm）の実寸枠内に100%合致する画像解析実測ブロック定義 v5
// ハローワーク標準OCRマス目規格: マス幅 2.38% (5.0mm) + 隙間 0.48% (1.0mm) = ピッチ 2.86% (6.01mm)
// ハイフン印刷枠を跨ぐブロック設計
export const DEFAULT_EMPLOYMENT_ACQ_FIELDS: EmploymentAcqFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① ヘッダー・番号欄（被保険者番号は4桁-6桁-1桁に分割）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'myNumber',
    name: '1. 個人番号（マイナンバー12桁）',
    section: 'header',
    x: 29.5,
    y: 8.3,
    fontSize: 11.5,
    pitch: 2.86,
    width: 34.3,
    example: '123456789012',
    description: 'マイナンバー12桁連続枠'
  },
  {
    id: 'insuredNumber_1',
    name: '2. 被保険者番号［前4桁］',
    section: 'header',
    x: 10.0,
    y: 12.7,
    fontSize: 11.5,
    pitch: 2.86,
    width: 11.4,
    example: '1234',
    description: '被保険者番号の最初の4桁枠'
  },
  {
    id: 'insuredNumber_2',
    name: '2. 被保険者番号［中6桁］',
    section: 'header',
    x: 23.8,
    y: 12.7,
    fontSize: 11.5,
    pitch: 2.86,
    width: 17.2,
    example: '567890',
    description: 'ハイフン枠の右、中央の6桁枠'
  },
  {
    id: 'insuredNumber_3',
    name: '2. 被保険者番号［後1桁］',
    section: 'header',
    x: 40.9,
    y: 12.7,
    fontSize: 11.5,
    width: 2.5,
    example: '1',
    description: '最後の1桁チェックディジット枠'
  },
  {
    id: 'acqType',
    name: '3. 取得区分（1新規 / 2再取得）',
    section: 'header',
    x: 52.8,
    y: 12.7,
    fontSize: 11.5,
    width: 2.5,
    example: '1',
    description: '1:新規、2:再取得'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 氏名・生年月日・性別・事業所番号（4桁-6桁-1桁に分割）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'nameKana',
    name: '4. 被保険者氏名 フリガナ（カタカナ28マス）',
    section: 'employee_basic',
    x: 32.4,
    y: 17.0,
    fontSize: 9.5,
    pitch: 2.86,
    width: 55.0,
    example: 'コマイ　シュウイチロウ',
    description: 'カタカナ28マス枠（姓と名の間は1マス空け）'
  },
  {
    id: 'nameKanji',
    name: '4. 被保険者氏名（漢字氏名枠）',
    section: 'employee_basic',
    x: 9.8,
    y: 19.3,
    fontSize: 10.5,
    width: 18.0,
    example: '駒井　修一郎',
    description: '氏名漢字記入枠（フリガナの下段枠）'
  },
  {
    id: 'gender',
    name: '6. 性別（1男 / 2女）',
    section: 'employee_basic',
    x: 9.8,
    y: 25.5,
    fontSize: 11.5,
    width: 2.5,
    example: '1',
    description: '1:男、2:女'
  },
  {
    id: 'birthEra',
    name: '7. 生年月日［元号1桁］',
    section: 'employee_basic',
    x: 20.4,
    y: 25.5,
    fontSize: 11.5,
    width: 2.5,
    example: '5',
    description: '2:大正、3:昭和、4:平成、5:令和'
  },
  {
    id: 'birthYear',
    name: '7. 生年月日［年2桁］',
    section: 'employee_basic',
    x: 26.2,
    y: 25.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '02',
    description: '生年（2桁、ハイフン跨ぎ）'
  },
  {
    id: 'birthMonth',
    name: '7. 生年月日［月2桁］',
    section: 'employee_basic',
    x: 31.9,
    y: 25.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '05',
    description: '生月（2桁）'
  },
  {
    id: 'birthDay',
    name: '7. 生年月日［日2桁］',
    section: 'employee_basic',
    x: 37.6,
    y: 25.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '10',
    description: '生日（2桁）'
  },
  {
    id: 'officeNumber_1',
    name: '8. 事業所番号［前4桁］',
    section: 'employee_basic',
    x: 50.0,
    y: 25.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 11.4,
    example: '2501',
    description: '事業所番号の最初の4桁枠'
  },
  {
    id: 'officeNumber_2',
    name: '8. 事業所番号［中6桁］',
    section: 'employee_basic',
    x: 64.3,
    y: 25.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 17.2,
    example: '123456',
    description: '事業所番号の中央6桁枠（ハイフン跨ぎ）'
  },
  {
    id: 'officeNumber_3',
    name: '8. 事業所番号［後1桁］',
    section: 'employee_basic',
    x: 84.3,
    y: 25.5,
    fontSize: 11.5,
    width: 2.5,
    example: '7',
    description: '事業所番号の最後1桁枠（ハイフン跨ぎ）'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 雇用条件・賃金・取得日（元号・年・月・日、時間・分に分割）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'causeCode',
    name: '9. 被保険者となったことの原因コード',
    section: 'employment_condition',
    x: 14.3,
    y: 30.8,
    fontSize: 11.5,
    width: 2.5,
    example: '2',
    description: '1:新規雇用(学卒)、2:中途雇用等'
  },
  {
    id: 'wageType',
    name: '10. 賃金支払態様コード（1マス）',
    section: 'employment_condition',
    x: 25.5,
    y: 30.8,
    fontSize: 11.5,
    width: 2.5,
    example: '1',
    description: '1:月給、2:週給、3:日給、4:時間給、5:その他'
  },
  {
    id: 'wageThousands',
    name: '10. 賃金月額（千円単位・4マス）',
    section: 'employment_condition',
    x: 31.2,
    y: 30.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 11.4,
    example: '0250',
    description: '百万、十万、万、千円の4マス（ハイフン枠跨ぎ）'
  },
  {
    id: 'joinEra',
    name: '11. 資格取得年月日［元号1桁］',
    section: 'employment_condition',
    x: 58.6,
    y: 30.8,
    fontSize: 11.5,
    width: 2.5,
    example: '5',
    description: '4:平成、5:令和'
  },
  {
    id: 'joinYear',
    name: '11. 資格取得年月日［年2桁］',
    section: 'employment_condition',
    x: 64.3,
    y: 30.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '08',
    description: '取得年（2桁、ハイフン跨ぎ）'
  },
  {
    id: 'joinMonth',
    name: '11. 資格取得年月日［月2桁］',
    section: 'employment_condition',
    x: 70.0,
    y: 30.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '04',
    description: '取得月（2桁）'
  },
  {
    id: 'joinDay',
    name: '11. 資格取得年月日［日2桁］',
    section: 'employment_condition',
    x: 75.7,
    y: 30.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '01',
    description: '取得日（2桁）'
  },
  {
    id: 'employmentForm',
    name: '12. 雇用形態コード（1マス）',
    section: 'employment_condition',
    x: 22.0,
    y: 36.8,
    fontSize: 11.5,
    width: 2.5,
    example: '7',
    description: '1:日雇、2:派遣、3:パート、4:有期契約、7:その他(正社員等)'
  },
  {
    id: 'jobCode',
    name: '13. 職種コード（2マス）',
    section: 'employment_condition',
    x: 40.1,
    y: 36.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '03',
    description: '01〜11の2桁職種分類コード'
  },
  {
    id: 'routeCode',
    name: '14. 就職経路コード（1マス）',
    section: 'employment_condition',
    x: 52.6,
    y: 36.8,
    fontSize: 11.5,
    width: 2.5,
    example: '2',
    description: '1:安定所紹介、2:自己就職、3:民間紹介、4:把握していない'
  },
  {
    id: 'weeklyHours',
    name: '15. 週所定労働時間［時間 2マス］',
    section: 'employment_condition',
    x: 67.0,
    y: 36.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '40',
    description: '週所定労働時間の時間部分（例: 40）'
  },
  {
    id: 'weeklyMins',
    name: '15. 週所定労働時間［分 2マス］',
    section: 'employment_condition',
    x: 72.7,
    y: 36.8,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '00',
    description: '週所定労働時間の分部分（例: 00）'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ④ 契約期間の定め
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'contractFixed',
    name: '16. 契約期間の定め（1:有 / 2:無）',
    section: 'contract',
    x: 10.3,
    y: 42.9,
    fontSize: 11.5,
    width: 2.5,
    example: '2',
    description: '1:有、2:無'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ⑤ 事業所情報・事業主署名欄
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'employerAddress',
    name: '事業主 所在地',
    section: 'office',
    x: 23.0,
    y: 78.2,
    fontSize: 10,
    width: 65.0,
    example: '滋賀県大津市中央1-2-3',
    description: '事業所の所在地住所'
  },
  {
    id: 'employerName',
    name: '事業主 名称',
    section: 'office',
    x: 23.0,
    y: 81.8,
    fontSize: 11,
    width: 45.0,
    example: '株式会社サンプル',
    description: '事業所の正式名称'
  },
  {
    id: 'employerRep',
    name: '事業主 代表者職氏名',
    section: 'office',
    x: 23.0,
    y: 85.2,
    fontSize: 11,
    width: 40.0,
    example: '代表取締役　山田　太郎',
    description: '代表者の役職および氏名'
  },
  {
    id: 'employerPhone',
    name: '事業主 電話番号',
    section: 'office',
    x: 68.0,
    y: 85.2,
    fontSize: 10.5,
    width: 22.0,
    example: '077-123-4567',
    description: '事業所電話番号'
  },
  {
    id: 'targetHelloWork',
    name: '所轄公共職業安定所名',
    section: 'office',
    x: 23.0,
    y: 92.4,
    fontSize: 11,
    width: 20.0,
    example: '大津',
    description: '所轄ハローワーク名（〇〇 公共職業安定所長 殿）'
  }
];

// ローカルストレージキー（実測精密黄金比率 v5: ハイフン跨ぎ・全段完全整合版）
const STORAGE_KEY = 'employment_acq_doc_coords_v5';

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
