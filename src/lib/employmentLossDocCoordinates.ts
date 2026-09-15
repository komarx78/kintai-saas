import { supabase } from './supabase';

// ハローワーク公式「雇用保険被保険者資格喪失届（様式第4号・第7条関係・移行処理用）」
// 原本マス目・OCR枠内印字の精密座標マスター定義

export const EMPLOYMENT_LOSS_COORDS_UPDATE_EVENT = 'employment-loss-coords-updated';

export interface EmploymentLossFieldConfig {
  id: string;
  name: string;
  section: 'header' | 'employee_basic' | 'loss_detail' | 'lower_table' | 'office';
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当
  pitch?: number; // % マス目間隔
  width?: number; // % 表示枠の幅
  example: string;
  description: string;
  disabled?: boolean;
}

// 🎯 原本PDF（様式第4号 A4縦: 210mm × 297mm）の実寸枠内に合致する精密ブロック定義
export const DEFAULT_EMPLOYMENT_LOSS_FIELDS: EmploymentLossFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① ヘッダー・番号欄（帳票種別 17191 / 個人番号12桁 / 被保険者番号 / 事業所番号）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'docTypeNumber',
    name: '帳票種別（17191）',
    section: 'header',
    x: 7.2,
    y: 8.6,
    fontSize: 12,
    pitch: 2.86,
    width: 14.5,
    example: '17191',
    description: '帳票種別固定5桁'
  },
  {
    id: 'myNumber',
    name: '1. 個人番号（マイナンバー12桁）',
    section: 'header',
    x: 30.0,
    y: 8.6,
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
    x: 7.2,
    y: 13.5,
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
    x: 21.0,
    y: 13.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 17.2,
    example: '567890',
    description: '被保険者番号の中央6桁枠'
  },
  {
    id: 'insuredNumber_3',
    name: '2. 被保険者番号［後1桁］',
    section: 'header',
    x: 40.5,
    y: 13.5,
    fontSize: 11.5,
    width: 2.5,
    example: '1',
    description: '最後の1桁チェックディジット枠'
  },
  {
    id: 'officeNumber_1',
    name: '3. 事業所番号［前4桁］',
    section: 'header',
    x: 49.5,
    y: 13.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 11.4,
    example: '2501',
    description: '事業所番号の最初の4桁枠'
  },
  {
    id: 'officeNumber_2',
    name: '3. 事業所番号［中6桁］',
    section: 'header',
    x: 63.3,
    y: 13.5,
    fontSize: 11.5,
    pitch: 2.86,
    width: 17.2,
    example: '123456',
    description: '事業所番号の中央6桁枠'
  },
  {
    id: 'officeNumber_3',
    name: '3. 事業所番号［後1桁］',
    section: 'header',
    x: 82.8,
    y: 13.5,
    fontSize: 11.5,
    width: 2.5,
    example: '7',
    description: '事業所番号の最後1桁枠'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 取得年月日・離職年月日・喪失原因
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'acqEra',
    name: '4. 資格取得年月日［元号］（3昭/4平/5令）',
    section: 'loss_detail',
    x: 7.2,
    y: 18.6,
    fontSize: 11.5,
    width: 2.5,
    example: '5',
    description: '3:昭和, 4:平成, 5:令和'
  },
  {
    id: 'acqYear',
    name: '4. 資格取得年月日［年2桁］',
    section: 'loss_detail',
    x: 12.0,
    y: 18.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '06',
    description: '取得年2桁'
  },
  {
    id: 'acqMonth',
    name: '4. 資格取得年月日［月2桁］',
    section: 'loss_detail',
    x: 19.8,
    y: 18.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '04',
    description: '取得月2桁'
  },
  {
    id: 'acqDay',
    name: '4. 資格取得年月日［日2桁］',
    section: 'loss_detail',
    x: 27.6,
    y: 18.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '01',
    description: '取得日2桁'
  },
  {
    id: 'lossEra',
    name: '5. 離職等年月日［元号］（3昭/4平/5令）',
    section: 'loss_detail',
    x: 39.0,
    y: 18.6,
    fontSize: 11.5,
    width: 2.5,
    example: '5',
    description: '3:昭和, 4:平成, 5:令和'
  },
  {
    id: 'lossYear',
    name: '5. 離職等年月日［年2桁］',
    section: 'loss_detail',
    x: 43.8,
    y: 18.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '08',
    description: '離職等年2桁'
  },
  {
    id: 'lossMonth',
    name: '5. 離職等年月日［月2桁］',
    section: 'loss_detail',
    x: 51.6,
    y: 18.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '09',
    description: '離職等月2桁'
  },
  {
    id: 'lossDay',
    name: '5. 離職等年月日［日2桁］',
    section: 'loss_detail',
    x: 59.4,
    y: 18.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '30',
    description: '離職等日2桁'
  },
  {
    id: 'lossReasonCode',
    name: '6. 喪失原因（1離職以外 / 2他離職 / 3事業主都合）',
    section: 'loss_detail',
    x: 67.5,
    y: 18.6,
    fontSize: 11.5,
    width: 2.5,
    example: '2',
    description: '1:死亡・役員就任等, 2:自己都合・定年等, 3:解雇等'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 離職票交付希望・所定労働時間・補充予定・新氏名
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'separationCertHope',
    name: '7. 離職票交付希望（1有 / 2無）',
    section: 'loss_detail',
    x: 9.5,
    y: 23.6,
    fontSize: 11.5,
    width: 2.5,
    example: '1',
    description: '1:離職票を希望する, 2:希望しない'
  },
  {
    id: 'weeklyHours',
    name: '8. 1週間の所定労働時間［時間2桁］',
    section: 'loss_detail',
    x: 24.8,
    y: 23.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '40',
    description: '所定労働時間'
  },
  {
    id: 'weeklyMins',
    name: '8. 1週間の所定労働時間［分2桁］',
    section: 'loss_detail',
    x: 32.6,
    y: 23.6,
    fontSize: 11.5,
    pitch: 2.86,
    width: 5.7,
    example: '00',
    description: '所定労働分'
  },
  {
    id: 'replenishCode',
    name: '9. 補充採用予定の有無（空白:無 / 1:有）',
    section: 'loss_detail',
    x: 43.5,
    y: 23.6,
    fontSize: 11.5,
    width: 2.5,
    example: '',
    description: '補充採用予定がある場合は1、無ければ空白'
  },
  {
    id: 'newNameKana',
    name: '10. 新氏名 フリガナ（氏名変更時のみ）',
    section: 'loss_detail',
    x: 30.0,
    y: 28.5,
    fontSize: 9.5,
    pitch: 2.86,
    width: 55.0,
    example: '',
    description: '改姓等があった場合のみ記載'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ④ 下段確認欄（氏名・住所・生年月日・喪失原因詳細・事業所名称）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'empNameKana',
    name: '20. 被保険者氏名 フリガナ（下段）',
    section: 'lower_table',
    x: 8.5,
    y: 55.4,
    fontSize: 8.5,
    width: 38.0,
    example: 'コマイ　シュウイチロウ',
    description: '氏名フリガナ'
  },
  {
    id: 'empName',
    name: '20. 被保険者氏名 漢字（下段）',
    section: 'lower_table',
    x: 8.5,
    y: 57.5,
    fontSize: 11,
    width: 38.0,
    example: '駒井　秀一郎',
    description: '被保険者氏名漢字'
  },
  // 21. 性別（原本に「男 ・ 女」がプレプリントされているため○印を付加）
  {
    id: 'genderCircle_male',
    name: '21. 性別○印［男］',
    section: 'lower_table',
    x: 52.5,
    y: 56.4,
    fontSize: 13,
    width: 3.5,
    example: '○',
    description: '男性の場合に原本の「男」へ○印'
  },
  {
    id: 'genderCircle_female',
    name: '21. 性別○印［女］',
    section: 'lower_table',
    x: 56.2,
    y: 56.4,
    fontSize: 13,
    width: 3.5,
    example: '○',
    description: '女性の場合に原本の「女」へ○印'
  },
  // 22. 生年月日（原本に元号選択肢と年月日の文字がプレプリントされているため、元号○印と数字を分割印字）
  {
    id: 'birthEra_taisho',
    name: '22. 生年月日 元号○［大正］',
    section: 'lower_table',
    x: 63.3,
    y: 55.4,
    fontSize: 12,
    width: 3.0,
    example: '○',
    description: '大正生まれの場合に○印'
  },
  {
    id: 'birthEra_showa',
    name: '22. 生年月日 元号○［昭和］',
    section: 'lower_table',
    x: 66.5,
    y: 55.4,
    fontSize: 12,
    width: 3.0,
    example: '○',
    description: '昭和生まれの場合に○印'
  },
  {
    id: 'birthEra_heisei',
    name: '22. 生年月日 元号○［平成］',
    section: 'lower_table',
    x: 63.3,
    y: 57.4,
    fontSize: 12,
    width: 3.0,
    example: '○',
    description: '平成生まれの場合に○印'
  },
  {
    id: 'birthEra_reiwa',
    name: '22. 生年月日 元号○［令和］',
    section: 'lower_table',
    x: 66.5,
    y: 57.4,
    fontSize: 12,
    width: 3.0,
    example: '○',
    description: '令和生まれの場合に○印'
  },
  {
    id: 'birthYear',
    name: '22. 生年月日［年］',
    section: 'lower_table',
    x: 70.8,
    y: 56.8,
    fontSize: 11,
    width: 4.0,
    example: '12',
    description: '和暦年'
  },
  {
    id: 'birthMonth',
    name: '22. 生年月日［月］',
    section: 'lower_table',
    x: 76.5,
    y: 56.8,
    fontSize: 11,
    width: 4.0,
    example: '02',
    description: '月'
  },
  {
    id: 'birthDay',
    name: '22. 生年月日［日］',
    section: 'lower_table',
    x: 82.5,
    y: 56.8,
    fontSize: 11,
    width: 4.0,
    example: '02',
    description: '日'
  },
  {
    id: 'empAddress',
    name: '23. 被保険者の住所又は居所',
    section: 'lower_table',
    x: 8.5,
    y: 61.8,
    fontSize: 9.5,
    width: 82.0,
    example: '滋賀県大津市坂本3丁目21-16',
    description: '退職時の現住所'
  },
  {
    id: 'officeName',
    name: '24. 事業所名称',
    section: 'lower_table',
    x: 8.5,
    y: 65.8,
    fontSize: 10,
    width: 50.0,
    example: '株式会社KAP',
    description: '事業所名称（会社名）'
  },
  {
    id: 'lossReasonDetail',
    name: '26. 被保険者でなくなったことの原因（具体的事由）',
    section: 'lower_table',
    x: 8.5,
    y: 70.0,
    fontSize: 9.5,
    width: 82.0,
    example: '自己都合退職（一身上の都合による退職）',
    description: '退職・資格喪失の具体的事由'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ⑤ 事業主届出情報・提出先
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'submitYear',
    name: '届出日［年］',
    section: 'office',
    x: 80.5,
    y: 75.0,
    fontSize: 10,
    width: 4.0,
    example: '8',
    description: '令和の年'
  },
  {
    id: 'submitMonth',
    name: '届出日［月］',
    section: 'office',
    x: 86.8,
    y: 75.0,
    fontSize: 10,
    width: 3.5,
    example: '9',
    description: '月'
  },
  {
    id: 'submitDay',
    name: '届出日［日］',
    section: 'office',
    x: 92.2,
    y: 75.0,
    fontSize: 10,
    width: 3.5,
    example: '15',
    description: '日'
  },
  {
    id: 'employerAddress',
    name: '事業主 住所',
    section: 'office',
    x: 21.0,
    y: 76.8,
    fontSize: 9.5,
    width: 65.0,
    example: '滋賀県大津市坂本3丁目21-16',
    description: '事業主の所在地'
  },
  {
    id: 'employerName',
    name: '事業主 氏名（法人名・代表者名）',
    section: 'office',
    x: 21.0,
    y: 79.8,
    fontSize: 10.5,
    width: 65.0,
    example: '株式会社KAP 代表取締役 駒井 秀一郎',
    description: '事業主の会社名および代表者名'
  },
  {
    id: 'employerPhone',
    name: '事業主 電話番号',
    section: 'office',
    x: 21.0,
    y: 83.2,
    fontSize: 10,
    width: 30.0,
    example: '077-574-6907',
    description: '事業主の電話番号'
  },
  {
    id: 'targetHelloWork',
    name: '公共職業安定所名（所轄ハローワーク）',
    section: 'office',
    x: 77.0,
    y: 81.8,
    fontSize: 11,
    width: 12.0,
    example: '大津',
    description: '所轄公共職業安定所（例: 大津）'
  }
];

const STORAGE_KEY = 'employment_loss_doc_coordinates_custom_v2';

// ローカルストレージからの読み込み（デフォルトフォールバック付き）
export function loadEmploymentLossCoordinates(): EmploymentLossFieldConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('employment_loss_doc_coordinates_custom_v1');
    if (!raw) return DEFAULT_EMPLOYMENT_LOSS_FIELDS;
    const parsed: Partial<EmploymentLossFieldConfig>[] = JSON.parse(raw);
    return DEFAULT_EMPLOYMENT_LOSS_FIELDS.map(def => {
      const custom = parsed.find(p => p.id === def.id);
      if (custom) {
        return {
          ...def,
          x: custom.x !== undefined ? custom.x : def.x,
          y: custom.y !== undefined ? custom.y : def.y,
          fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
          pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
          width: custom.width !== undefined ? custom.width : def.width,
          disabled: custom.disabled
        };
      }
      return def;
    });
  } catch (err) {
    console.warn('Failed to parse employment loss custom coords from localStorage:', err);
    return DEFAULT_EMPLOYMENT_LOSS_FIELDS;
  }
}

// ローカルストレージへの保存
export function saveEmploymentLossCoordinates(fields: EmploymentLossFieldConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  } catch (err) {
    console.error('Failed to save employment loss coords to localStorage:', err);
  }
}

// 座標リセット（デフォルト初期化）
export function resetEmploymentLossCoordinates(): EmploymentLossFieldConfig[] {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
  return DEFAULT_EMPLOYMENT_LOSS_FIELDS;
}

// リアルタイム反映ブロードキャスト
export function broadcastEmploymentLossCoordinates(fields: EmploymentLossFieldConfig[]) {
  const ev = new CustomEvent(EMPLOYMENT_LOSS_COORDS_UPDATE_EVENT, { detail: fields });
  window.dispatchEvent(ev);
}

// Supabase DB からの全社同期座標取得
export async function fetchEmploymentLossCoordinatesFromDb(): Promise<EmploymentLossFieldConfig[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('employment_loss_doc_coordinates')
      .limit(1)
      .maybeSingle();

    if (data && data.employment_loss_doc_coordinates && Array.isArray(data.employment_loss_doc_coordinates)) {
      const dbFields = data.employment_loss_doc_coordinates as EmploymentLossFieldConfig[];
      const merged = DEFAULT_EMPLOYMENT_LOSS_FIELDS.map(def => {
        const custom = dbFields.find(p => p.id === def.id);
        if (custom) {
          return {
            ...def,
            x: custom.x !== undefined ? custom.x : def.x,
            y: custom.y !== undefined ? custom.y : def.y,
            fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
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
  return loadEmploymentLossCoordinates();
}

// Supabase DB への保存（UUID完全整合・レコード自動判定）
export async function saveEmploymentLossCoordinatesToDb(fields: EmploymentLossFieldConfig[]): Promise<boolean> {
  try {
    saveEmploymentLossCoordinates(fields);

    const { data: current } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    let saveError = null;
    if (current && current.id) {
      const res = await supabase
        .from('system_settings')
        .update({ 
          employment_loss_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);
      saveError = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert([{ 
          employment_loss_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        }]);
      saveError = res.error;
    }

    if (saveError) {
      console.warn('Could not update system_settings DB (may need column):', saveError);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving employment loss coordinates to DB:', err);
    return false;
  }
}
