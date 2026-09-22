// ══════════════════════════════════════════════════════════════════════════
// 🏛️ 健康保険・厚生年金保険 被保険者資格喪失届（日本年金機構 様式コード2201）
//    公式原本PDF印字座標マスタ（SSOT・精密座標定義）
// ══════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';

export interface HealthPensionLossFieldConfig {
  id: string;
  name: string;
  section: 'header' | 'office' | 'insured_person_1';
  x: number;          // 原本幅（210mm）に対する左からの割合（%）
  y: number;          // 原本高（297mm）に対する上からの割合（%）
  fontSize?: number;  // フォントサイズ（px）
  pitch?: number;     // マス目文字ピッチ（mm）
  width?: number;     // 枠幅（mm）
  example?: string;   // サンプル表示文字
  description?: string;
  isCircle?: boolean; // 選択肢を〇で囲む描画フラグ
  circleWidth?: number;  // 〇の横幅（px）
  circleHeight?: number; // 〇の縦幅（px）
  circleValueKey?: string; // 連動するフォーム値のキー
  circleActiveValue?: string; // 〇を表示する有効な値
  disabled?: boolean;
}

export const HEALTH_PENSION_LOSS_STORAGE_KEY = 'health_pension_loss_doc_coordinates_custom_v1';
export const HEALTH_PENSION_LOSS_UPDATE_EVENT = 'health_pension_loss_coords_updated';

// 🎯 原本PDF（様式コード 2201 A4縦: 210mm × 297mm）の実寸枠内に合致する座標定義
export const DEFAULT_HEALTH_PENSION_LOSS_FIELDS: HealthPensionLossFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① 提出日・提出者記入欄（事業所情報）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'submitYear',
    name: '提出日 年（令和）',
    section: 'header',
    x: 13.5,
    y: 6.8,
    fontSize: 10.5,
    width: 3.5,
    example: '08',
    description: '届出提出日（令和年・2桁）'
  },
  {
    id: 'submitMonth',
    name: '提出日 月',
    section: 'header',
    x: 18.0,
    y: 6.8,
    fontSize: 10.5,
    width: 3.5,
    example: '04',
    description: '届出提出日（月・2桁）'
  },
  {
    id: 'submitDay',
    name: '提出日 日',
    section: 'header',
    x: 23.5,
    y: 6.8,
    fontSize: 10.5,
    width: 3.5,
    example: '15',
    description: '届出提出日（日・2桁）'
  },
  {
    id: 'officeSymbol_1',
    name: '事業所整理記号（左部）',
    section: 'office',
    x: 19.5,
    y: 8.8,
    fontSize: 10.0,
    pitch: 3.3,
    width: 14.0,
    example: '26カカ',
    description: '年金事務所整理記号の都道府県・カタカナ'
  },
  {
    id: 'officeSymbol_2',
    name: '事業所整理記号（右部）',
    section: 'office',
    x: 24.5,
    y: 8.8,
    fontSize: 10.0,
    pitch: 3.3,
    width: 14.0,
    example: '1234',
    description: '年金事務所整理記号の数字4桁'
  },
  {
    id: 'officeNumber',
    name: '事業所番号（5桁）',
    section: 'office',
    x: 37.0,
    y: 8.8,
    fontSize: 10.5,
    pitch: 2.8,
    width: 15.0,
    example: '12345',
    description: '事業所番号5桁（年金事務所付与番号）'
  },
  {
    id: 'officeZipCode_first',
    name: '事業所郵便番号（上3桁）',
    section: 'office',
    x: 11.5,
    y: 11.4,
    fontSize: 9.5,
    pitch: 2.6,
    width: 9.0,
    example: '520',
    description: '事業所所在地 郵便番号（上3桁）'
  },
  {
    id: 'officeZipCode_last',
    name: '事業所郵便番号（下4桁）',
    section: 'office',
    x: 15.5,
    y: 11.4,
    fontSize: 9.5,
    pitch: 2.6,
    width: 12.0,
    example: '0001',
    description: '事業所所在地 郵便番号（下4桁）'
  },
  {
    id: 'officeAddress',
    name: '事業所所在地',
    section: 'office',
    x: 11.5,
    y: 14.2,
    fontSize: 9.0,
    width: 48.0,
    example: '滋賀県大津市坂本3丁目21-16',
    description: '事業所所在地（丁目・番地・ビル名）'
  },
  {
    id: 'officeName',
    name: '事業所名称',
    section: 'office',
    x: 11.5,
    y: 18.2,
    fontSize: 9.5,
    width: 48.0,
    example: '株式会社cocotte',
    description: '事業所名称（会社名・屋号）'
  },
  {
    id: 'ownerName',
    name: '事業主氏名',
    section: 'office',
    x: 11.5,
    y: 22.0,
    fontSize: 9.5,
    width: 48.0,
    example: '代表取締役 駒井 秀一朗',
    description: '事業主役職および氏名'
  },
  {
    id: 'officeTel_area',
    name: '事業所電話番号（市外局番）',
    section: 'office',
    x: 23.5,
    y: 24.8,
    fontSize: 9.5,
    width: 7.0,
    example: '077',
    description: '電話番号市外局番'
  },
  {
    id: 'officeTel_local',
    name: '事業所電話番号（市内局番）',
    section: 'office',
    x: 31.0,
    y: 24.8,
    fontSize: 9.5,
    width: 7.0,
    example: '574',
    description: '電話番号市内局番'
  },
  {
    id: 'officeTel_number',
    name: '事業所電話番号（加入者番号）',
    section: 'office',
    x: 38.5,
    y: 24.8,
    fontSize: 9.5,
    width: 7.0,
    example: '6907',
    description: '電話番号加入者番号'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 被保険者1（詳細欄）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'insuredPersonNumber_1',
    name: '① 被保険者整理番号',
    section: 'insured_person_1',
    x: 10.0,
    y: 29.3,
    fontSize: 10.0,
    pitch: 2.8,
    width: 14.0,
    example: '001',
    description: '被保険者整理番号（社内番号・健保整理番号）'
  },
  // ── ② 氏名・フリガナ（氏・名 分割枠印字） ──
  {
    id: 'nameKanaSei_1',
    name: '② 氏名 フリガナ（氏 / セイ）',
    section: 'insured_person_1',
    x: 25.0,
    y: 27.6,
    fontSize: 8.5,
    width: 12.0,
    example: 'コマイ',
    description: '氏名フリガナの氏（カタカナ）'
  },
  {
    id: 'nameKanaMei_1',
    name: '② 氏名 フリガナ（名 / メイ）',
    section: 'insured_person_1',
    x: 38.0,
    y: 27.6,
    fontSize: 8.5,
    width: 14.0,
    example: 'シュウイチロウ',
    description: '氏名フリガナの名（カタカナ）'
  },
  {
    id: 'nameKanjiSei_1',
    name: '② 氏名 漢字（氏 / 姓）',
    section: 'insured_person_1',
    x: 25.0,
    y: 30.5,
    fontSize: 11.5,
    width: 12.0,
    example: '駒井',
    description: '氏名漢字の氏（住民票上の姓）'
  },
  {
    id: 'nameKanjiMei_1',
    name: '② 氏名 漢字（名）',
    section: 'insured_person_1',
    x: 38.0,
    y: 30.5,
    fontSize: 11.5,
    width: 14.0,
    example: '秀一朗',
    description: '氏名漢字の名（住民票上の名）'
  },

  // ── ③ 生年月日 元号（〇で囲む） ──
  {
    id: 'birthEra_showa_1',
    name: '③ 生年月日 元号 [5.昭和 〇]',
    section: 'insured_person_1',
    x: 74.2,
    y: 27.3,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '生年月日が昭和の場合に原本の「5.昭和」を〇で囲みます',
    isCircle: true,
    circleWidth: 24,
    circleHeight: 16,
    circleValueKey: 'birthEra_1',
    circleActiveValue: '5'
  },
  {
    id: 'birthEra_heisei_1',
    name: '③ 生年月日 元号 [7.平成 〇]',
    section: 'insured_person_1',
    x: 74.2,
    y: 28.5,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '生年月日が平成の場合に原本の「7.平成」を〇で囲みます',
    isCircle: true,
    circleWidth: 24,
    circleHeight: 16,
    circleValueKey: 'birthEra_1',
    circleActiveValue: '7'
  },
  {
    id: 'birthEra_reiwa_1',
    name: '③ 生年月日 元号 [9.令和 〇]',
    section: 'insured_person_1',
    x: 74.2,
    y: 29.7,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '生年月日が令和の場合に原本の「9.令和」を〇で囲みます',
    isCircle: true,
    circleWidth: 24,
    circleHeight: 16,
    circleValueKey: 'birthEra_1',
    circleActiveValue: '9'
  },
  {
    id: 'birthYear_1',
    name: '③ 生年月日 年',
    section: 'insured_person_1',
    x: 83.2,
    y: 27.5,
    fontSize: 9.5,
    width: 3.5,
    example: '54',
    description: '生年月日の年（和暦2桁）'
  },
  {
    id: 'birthMonth_1',
    name: '③ 生年月日 月',
    section: 'insured_person_1',
    x: 88.0,
    y: 27.5,
    fontSize: 9.5,
    width: 3.5,
    example: '03',
    description: '生年月日の月（2桁）'
  },
  {
    id: 'birthDay_1',
    name: '③ 生年月日 日',
    section: 'insured_person_1',
    x: 92.8,
    y: 27.5,
    fontSize: 9.5,
    width: 3.5,
    example: '18',
    description: '生年月日の日（2桁）'
  },

  // ── ④ 個人番号（マイナンバー）または基礎年金番号 ──
  {
    id: 'myNumberOrPension_1',
    name: '④ 個人番号（12桁）または基礎年金番号（10桁）',
    section: 'insured_person_1',
    x: 10.0,
    y: 33.3,
    fontSize: 10.5,
    pitch: 2.72,
    width: 33.0,
    example: '123456789012',
    description: 'マイナンバー12桁または基礎年金番号10桁（左詰めマス目）'
  },

  // ── ⑤ 喪失年月日（原本に9.令和が印刷済） ──
  {
    id: 'lossYear_1',
    name: '⑤ 喪失年月日 年（令和）',
    section: 'insured_person_1',
    x: 52.8,
    y: 32.2,
    fontSize: 9.5,
    width: 3.5,
    example: '08',
    description: '資格喪失年（令和年・退職日の翌日・2桁）'
  },
  {
    id: 'lossMonth_1',
    name: '⑤ 喪失年月日 月',
    section: 'insured_person_1',
    x: 57.5,
    y: 32.2,
    fontSize: 9.5,
    width: 3.5,
    example: '04',
    description: '資格喪失月（2桁）'
  },
  {
    id: 'lossDay_1',
    name: '⑤ 喪失年月日 日',
    section: 'insured_person_1',
    x: 62.2,
    y: 32.2,
    fontSize: 9.5,
    width: 3.5,
    example: '01',
    description: '資格喪失日（2桁）'
  },

  // ── ⑥ 喪失（不該当）原因（〇で囲む） ──
  {
    id: 'lossReason_taishoku_1',
    name: '⑥ 喪失原因 [4.退職等 〇]',
    section: 'insured_person_1',
    x: 74.0,
    y: 31.5,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '退職等の場合に「4.退職等」を〇で囲みます',
    isCircle: true,
    circleWidth: 26,
    circleHeight: 16,
    circleValueKey: 'lossReason_1',
    circleActiveValue: '4'
  },
  {
    id: 'lossReason_shibo_1',
    name: '⑥ 喪失原因 [5.死亡 〇]',
    section: 'insured_person_1',
    x: 74.0,
    y: 32.8,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '死亡の場合に「5.死亡」を〇で囲みます',
    isCircle: true,
    circleWidth: 24,
    circleHeight: 16,
    circleValueKey: 'lossReason_1',
    circleActiveValue: '5'
  },
  {
    id: 'lossReason_75sai_1',
    name: '⑥ 喪失原因 [7.75歳到達 〇]',
    section: 'insured_person_1',
    x: 74.0,
    y: 34.0,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '75歳到達の場合に「7.75歳到達」を〇で囲みます',
    isCircle: true,
    circleWidth: 32,
    circleHeight: 16,
    circleValueKey: 'lossReason_1',
    circleActiveValue: '7'
  },
  {
    id: 'lossReason_shogai_1',
    name: '⑥ 喪失原因 [9.障害認定 〇]',
    section: 'insured_person_1',
    x: 74.0,
    y: 35.2,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '障害認定の場合に「9.障害認定」を〇で囲みます',
    isCircle: true,
    circleWidth: 32,
    circleHeight: 16,
    circleValueKey: 'lossReason_1',
    circleActiveValue: '9'
  },
  {
    id: 'lossReason_kyotei_1',
    name: '⑥ 喪失原因 [11.社会保障協定 〇]',
    section: 'insured_person_1',
    x: 74.0,
    y: 36.4,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '社会保障協定の場合に「11.社会保障協定」を〇で囲みます',
    isCircle: true,
    circleWidth: 36,
    circleHeight: 16,
    circleValueKey: 'lossReason_1',
    circleActiveValue: '11'
  },

  // ── 退職等または死亡した日（令和 年月日） ──
  {
    id: 'retireYear_1',
    name: '⑥ 退職等（死亡）日 年（令和）',
    section: 'insured_person_1',
    x: 82.5,
    y: 31.5,
    fontSize: 9.5,
    width: 3.5,
    example: '08',
    description: '退職日または死亡日（令和年・2桁）'
  },
  {
    id: 'retireMonth_1',
    name: '⑥ 退職等（死亡）日 月',
    section: 'insured_person_1',
    x: 87.5,
    y: 31.5,
    fontSize: 9.5,
    width: 3.5,
    example: '03',
    description: '退職日または死亡日（月・2桁）'
  },
  {
    id: 'retireDay_1',
    name: '⑥ 退職等（死亡）日 日',
    section: 'insured_person_1',
    x: 92.2,
    y: 31.5,
    fontSize: 9.5,
    width: 3.5,
    example: '31',
    description: '退職日または死亡日（日・2桁）'
  },

  // ── ⑦ 備考（〇で囲む） ──
  {
    id: 'remarks_2ijou_1',
    name: '⑦ 備考 [1.二以上事業所 〇]',
    section: 'insured_person_1',
    x: 16.5,
    y: 37.8,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '二以上事業所勤務者の喪失の場合に〇で囲みます',
    isCircle: true,
    circleWidth: 38,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '1'
  },
  {
    id: 'remarks_saikoyou_1',
    name: '⑦ 備考 [2.継続再雇用者 〇]',
    section: 'insured_person_1',
    x: 16.5,
    y: 39.8,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: '退職後の継続再雇用者の喪失の場合に〇で囲みます',
    isCircle: true,
    circleWidth: 42,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '2'
  },
  {
    id: 'remarks_other_1',
    name: '⑦ 備考 [3.その他 〇]',
    section: 'insured_person_1',
    x: 34.0,
    y: 37.8,
    fontSize: 9.0,
    width: 3.0,
    example: '〇',
    description: 'その他の場合に〇で囲みます',
    isCircle: true,
    circleWidth: 26,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '3'
  },
  {
    id: 'remarks_other_text_1',
    name: '⑦ 備考 その他自由記入',
    section: 'insured_person_1',
    x: 39.0,
    y: 37.8,
    fontSize: 8.5,
    width: 18.0,
    example: '',
    description: 'その他事由（転勤等）'
  },

  // ── 資格確認書回収 ──
  {
    id: 'card_returned_count_1',
    name: '⑦ 資格確認書回収 添付（枚）',
    section: 'insured_person_1',
    x: 62.0,
    y: 37.8,
    fontSize: 9.5,
    width: 4.0,
    example: '1',
    description: '回収した資格確認書添付枚数'
  },
  {
    id: 'card_uncollected_count_1',
    name: '⑦ 資格確認書回収 返不能（枚）',
    section: 'insured_person_1',
    x: 62.0,
    y: 39.8,
    fontSize: 9.5,
    width: 4.0,
    example: '',
    description: '回収できなかった返不能枚数'
  },

  // ── ⑧ 70歳以上被用者不該当 ──
  {
    id: 'over70_not_applicable_1',
    name: '⑧ 70歳以上不該当 [レ印]',
    section: 'insured_person_1',
    x: 73.2,
    y: 37.0,
    fontSize: 11.0,
    width: 3.0,
    example: '✓',
    description: '70歳以上被用者不該当の場合のチェックマーク'
  },
  {
    id: 'over70_year_1',
    name: '⑧ 不該当年月日 年（令和）',
    section: 'insured_person_1',
    x: 82.5,
    y: 39.8,
    fontSize: 9.5,
    width: 3.5,
    example: '',
    description: '70歳不該当年月日 年（令和年）'
  },
  {
    id: 'over70_month_1',
    name: '⑧ 不該当年月日 月',
    section: 'insured_person_1',
    x: 87.5,
    y: 39.8,
    fontSize: 9.5,
    width: 3.5,
    example: '',
    description: '70歳不該当年月日 月'
  },
  {
    id: 'over70_day_1',
    name: '⑧ 不該当年月日 日',
    section: 'insured_person_1',
    x: 92.2,
    y: 39.8,
    fontSize: 9.5,
    width: 3.5,
    example: '',
    description: '70歳不該当年月日 日'
  }
];

// 座標をローカルストレージから取得
export function loadHealthPensionLossCoordinates(): HealthPensionLossFieldConfig[] {
  try {
    const raw = localStorage.getItem(HEALTH_PENSION_LOSS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return DEFAULT_HEALTH_PENSION_LOSS_FIELDS.map(def => {
          const custom = parsed.find((p: any) => p.id === def.id);
          if (custom) {
            return {
              ...def,
              x: custom.x !== undefined ? custom.x : def.x,
              y: custom.y !== undefined ? custom.y : def.y,
              fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
              pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
              width: custom.width !== undefined ? custom.width : def.width,
              circleWidth: custom.circleWidth !== undefined ? custom.circleWidth : def.circleWidth,
              circleHeight: custom.circleHeight !== undefined ? custom.circleHeight : def.circleHeight,
              disabled: custom.disabled
            };
          }
          return def;
        });
      }
    }
  } catch (e) {
    console.warn('Error loading health pension loss coordinates from localStorage:', e);
  }
  return DEFAULT_HEALTH_PENSION_LOSS_FIELDS;
}

// 座標をローカルストレージに保存
export function saveHealthPensionLossCoordinates(fields: HealthPensionLossFieldConfig[]) {
  try {
    localStorage.setItem(HEALTH_PENSION_LOSS_STORAGE_KEY, JSON.stringify(fields));
  } catch (e) {
    console.warn('Error saving health pension loss coordinates to localStorage:', e);
  }
}

// 変更イベントをブロードキャスト（リアルタイム反映）
export function broadcastHealthPensionLossCoordinates(fields: HealthPensionLossFieldConfig[]) {
  window.dispatchEvent(new CustomEvent(HEALTH_PENSION_LOSS_UPDATE_EVENT, { detail: fields }));
}

// Supabase DB から座標設定を取得
export async function fetchHealthPensionLossCoordinatesFromDb(): Promise<HealthPensionLossFieldConfig[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('health_pension_loss_doc_coordinates')
      .limit(1)
      .maybeSingle();

    if (data && data.health_pension_loss_doc_coordinates && Array.isArray(data.health_pension_loss_doc_coordinates)) {
      const merged = DEFAULT_HEALTH_PENSION_LOSS_FIELDS.map(def => {
        const custom = data.health_pension_loss_doc_coordinates.find((p: any) => p.id === def.id);
        if (custom) {
          return {
            ...def,
            x: custom.x !== undefined ? custom.x : def.x,
            y: custom.y !== undefined ? custom.y : def.y,
            fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
            pitch: custom.pitch !== undefined ? custom.pitch : def.pitch,
            width: custom.width !== undefined ? custom.width : def.width,
            circleWidth: custom.circleWidth !== undefined ? custom.circleWidth : def.circleWidth,
            circleHeight: custom.circleHeight !== undefined ? custom.circleHeight : def.circleHeight,
            disabled: custom.disabled
          };
        }
        return def;
      });
      localStorage.setItem(HEALTH_PENSION_LOSS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('DB fetch failed, fallback to local:', err);
  }
  return loadHealthPensionLossCoordinates();
}

// Supabase DB への保存
export async function saveHealthPensionLossCoordinatesToDb(fields: HealthPensionLossFieldConfig[]): Promise<boolean> {
  try {
    saveHealthPensionLossCoordinates(fields);

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
          health_pension_loss_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);
      saveError = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert([{ 
          health_pension_loss_doc_coordinates: fields,
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
    console.error('Error saving health pension loss coordinates to DB:', err);
    return false;
  }
}
