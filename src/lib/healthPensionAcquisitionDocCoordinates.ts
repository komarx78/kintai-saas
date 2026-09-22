import { supabase } from './supabase';

// 日本年金機構 / 全国健康保険協会 公式
// 「健康保険・厚生年金保険 被保険者資格取得届（70歳以上被用者該当届 / 様式コード 2200）」
// 原本マス目・OCR枠内印字の精密座標マスター定義

export const HEALTH_PENSION_ACQ_COORDS_UPDATE_EVENT = 'health-pension-acq-coords-updated';

export interface HealthPensionAcqFieldConfig {
  id: string;
  name: string;
  section: 'header' | 'office' | 'insured_person_1' | 'insured_person_2' | 'insured_person_3' | 'insured_person_4';
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当
  pitch?: number; // % マス目間隔
  width?: number; // % 表示枠の幅
  example: string;
  description: string;
  disabled?: boolean;
  isCircle?: boolean; // ⭕ 番号・項目を〇で囲むタイプ
  circleWidth?: number; // 〇の横幅 (px) デフォルト: 24
  circleHeight?: number; // 〇の縦幅 (px) デフォルト: 16
  circleValueKey?: string; // 連動するformValuesキー（例: 'gender_1', 'birthEra_1'）
  circleActiveValue?: string; // 〇を表示する条件値（例: '1', '2', '5', '7', '9'）
}

// 🎯 原本用紙の「該当する番号を○で囲む」各選択肢の精密座標マッピング定義
export interface CircleOptionMap {
  [value: string]: { x: number; y: number; w?: number; h?: number };
}

export const CIRCLE_MARK_COORDINATES: Record<string, CircleOptionMap> = {
  // ③ 生年月日 元号（5:昭和、7:平成、9:令和）
  birthEra_1: {
    '5': { x: 62.4, y: 26.4, w: 24, h: 16 },
    '7': { x: 62.4, y: 27.5, w: 24, h: 16 },
    '9': { x: 62.4, y: 28.6, w: 24, h: 16 }
  },
  // ④ 種別（1:男、2:女、3:坑内員、5:男基金、6:女基金、7:坑内員基金）
  gender_1: {
    '1': { x: 82.8, y: 26.6, w: 22, h: 16 },
    '2': { x: 82.8, y: 27.7, w: 22, h: 16 },
    '3': { x: 82.8, y: 28.8, w: 26, h: 16 },
    '5': { x: 88.8, y: 26.6, w: 30, h: 16 },
    '6': { x: 88.8, y: 27.7, w: 30, h: 16 },
    '7': { x: 88.8, y: 28.8, w: 34, h: 16 }
  },
  // ⑤ 取得区分（1:健保・厚年、3:共済出向、4:船保任継）
  acqCategory_1: {
    '1': { x: 14.5, y: 31.9, w: 32, h: 16 },
    '3': { x: 14.5, y: 33.1, w: 28, h: 16 },
    '4': { x: 14.5, y: 34.3, w: 28, h: 16 }
  },

  // ⑧ 被扶養者（0:無、1:有）
  dependents_1: {
    '0': { x: 83.2, y: 32.5, w: 22, h: 16 },
    '1': { x: 89.6, y: 32.5, w: 22, h: 16 }
  },
  // ⑩ 備考（1:70歳以上、2:二以上事業所、3:短時間、4:再雇用、5:その他）
  remarks_1: {
    '1': { x: 66.5, y: 36.1, w: 36, h: 16 },
    '2': { x: 67.5, y: 37.3, w: 38, h: 16 },
    '3': { x: 82.5, y: 36.1, w: 42, h: 16 },
    '4': { x: 81.5, y: 37.3, w: 40, h: 16 },
    '5': { x: 78.5, y: 38.3, w: 28, h: 16 }
  }
};

// 🎯 原本PDF（様式コード 2200 A4縦: 210mm × 297mm）の実寸枠内に100%合致する座標定義
export const DEFAULT_HEALTH_PENSION_ACQ_FIELDS: HealthPensionAcqFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① 提出日・提出者記入欄（事業所情報）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'submitYear',
    name: '提出年（令和）',
    section: 'header',
    x: 8.5,
    y: 7.7,
    fontSize: 10.5,
    width: 3.5,
    example: '08',
    description: '令和の年（2桁）'
  },
  {
    id: 'submitMonth',
    name: '提出月',
    section: 'header',
    x: 14.5,
    y: 7.7,
    fontSize: 10.5,
    width: 3.5,
    example: '04',
    description: '提出月（2桁）'
  },
  {
    id: 'submitDay',
    name: '提出日',
    section: 'header',
    x: 19.5,
    y: 7.7,
    fontSize: 10.5,
    width: 3.5,
    example: '01',
    description: '提出日（2桁）'
  },
  {
    id: 'officeSymbolCode',
    name: '事業所整理記号（数字部）',
    section: 'office',
    x: 14.2,
    y: 10.3,
    fontSize: 10.5,
    pitch: 2.5,
    width: 6.0,
    example: '01',
    description: '事業所整理記号の数字2桁（例: 01）'
  },
  {
    id: 'officeSymbolKana',
    name: '事業所整理記号（カナ部）',
    section: 'office',
    x: 21.0,
    y: 10.3,
    fontSize: 10.5,
    pitch: 2.5,
    width: 6.0,
    example: 'イロ',
    description: '事業所整理記号のカナ（例: イロ）'
  },
  {
    id: 'officeNumber',
    name: '事業所番号（4〜5桁）',
    section: 'office',
    x: 34.0,
    y: 10.3,
    fontSize: 10.5,
    pitch: 2.35,
    width: 14.0,
    example: '12345',
    description: '年金事務所より付与された事業所番号'
  },
  {
    id: 'officeZipCode_first',
    name: '事業所 郵便番号（上3桁）',
    section: 'office',
    x: 13.0,
    y: 12.8,
    fontSize: 9.5,
    pitch: 2.0,
    width: 6.5,
    example: '520',
    description: '事業所の郵便番号上3桁（マス目印字）'
  },
  {
    id: 'officeZipCode_last',
    name: '事業所 郵便番号（下4桁）',
    section: 'office',
    x: 19.8,
    y: 12.8,
    fontSize: 9.5,
    pitch: 2.0,
    width: 8.5,
    example: '0000',
    description: '事業所の郵便番号下4桁（マス目印字）'
  },
  {
    id: 'officeAddress',
    name: '事業所 所在地',
    section: 'office',
    x: 13.0,
    y: 15.0,
    fontSize: 9.5,
    width: 38.0,
    example: '滋賀県大津市中央1-2-3',
    description: '事業所の本店または適用事業所所在地'
  },
  {
    id: 'officeName',
    name: '事業所 名称',
    section: 'office',
    x: 13.0,
    y: 19.5,
    fontSize: 10.0,
    width: 38.0,
    example: '株式会社cocotte',
    description: '適用事業所名'
  },
  {
    id: 'employerName',
    name: '事業主 氏名',
    section: 'office',
    x: 13.0,
    y: 23.0,
    fontSize: 10.0,
    width: 38.0,
    example: '代表取締役 駒井 修一郎',
    description: '事業主（代表者）の役職および氏名'
  },
  {
    id: 'employerPhone',
    name: '事業所 電話番号',
    section: 'office',
    x: 13.0,
    y: 25.4,
    fontSize: 9.5,
    width: 38.0,
    example: '077-574-6907',
    description: '連絡先電話番号'
  },
  {
    id: 'srName',
    name: '社会保険労務士記載欄 氏名等',
    section: 'office',
    x: 55.0,
    y: 21.5,
    fontSize: 9.0,
    width: 38.0,
    example: '',
    description: '提出代行・事務代理を行う社会保険労務士の氏名等'
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 被保険者1（メイン対象者）
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'insuredNo_1',
    name: '① 被保険者整理番号',
    section: 'insured_person_1',
    x: 7.0,
    y: 28.5,
    fontSize: 9.5,
    width: 8.0,
    example: '',
    description: '社内管理番号等（年金機構で払出時は空欄）'
  },
  {
    id: 'nameKanaSei_1',
    name: '② 氏名 フリガナ（氏 / セイ）',
    section: 'insured_person_1',
    x: 18.0,
    y: 27.2,
    fontSize: 8.5,
    width: 14.0,
    example: 'ヤマダ',
    description: '氏名フリガナの氏（カタカナ）'
  },
  {
    id: 'nameKanaMei_1',
    name: '② 氏名 フリガナ（名 / メイ）',
    section: 'insured_person_1',
    x: 33.0,
    y: 27.2,
    fontSize: 8.5,
    width: 14.0,
    example: 'タロウ',
    description: '氏名フリガナの名（カタカナ）'
  },
  {
    id: 'nameKanjiSei_1',
    name: '② 氏名 漢字（氏 / 姓）',
    section: 'insured_person_1',
    x: 18.0,
    y: 29.5,
    fontSize: 10.5,
    width: 14.0,
    example: '山田',
    description: '氏名漢字の氏（住民票上の姓）'
  },
  {
    id: 'nameKanjiMei_1',
    name: '② 氏名 漢字（名）',
    section: 'insured_person_1',
    x: 33.0,
    y: 29.5,
    fontSize: 10.5,
    width: 14.0,
    example: '太郎',
    description: '氏名漢字の名（住民票上の名）'
  },
  // ── ③ 生年月日 元号（〇で囲む・選択肢個別） ──
  {
    id: 'birthEra_showa_1',
    name: '③ 生年月日 元号 [5.昭和 〇]',
    section: 'insured_person_1',
    x: 62.4,
    y: 26.4,
    fontSize: 9.5,
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
    x: 62.4,
    y: 27.5,
    fontSize: 9.5,
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
    x: 62.4,
    y: 28.6,
    fontSize: 9.5,
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
    x: 69.2,
    y: 27.2,
    fontSize: 9.5,
    width: 3.5,
    example: '08',
    description: '和暦年（2桁）'
  },
  {
    id: 'birthMonth_1',
    name: '③ 生年月日 月',
    section: 'insured_person_1',
    x: 73.8,
    y: 27.2,
    fontSize: 9.5,
    width: 3.5,
    example: '04',
    description: '生月（2桁）'
  },
  {
    id: 'birthDay_1',
    name: '③ 生年月日 日',
    section: 'insured_person_1',
    x: 78.4,
    y: 27.2,
    fontSize: 9.5,
    width: 3.5,
    example: '15',
    description: '生日（2桁）'
  },
  // ── ④ 種別（〇で囲む・選択肢個別） ──
  {
    id: 'gender_male_1',
    name: '④ 種別 [1.男 〇]',
    section: 'insured_person_1',
    x: 82.8,
    y: 26.6,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '性別が「男」の場合に原本の「1.男」を〇で囲みます',
    isCircle: true,
    circleWidth: 22,
    circleHeight: 16,
    circleValueKey: 'gender_1',
    circleActiveValue: '1'
  },
  {
    id: 'gender_female_1',
    name: '④ 種別 [2.女 〇]',
    section: 'insured_person_1',
    x: 82.8,
    y: 27.7,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '性別が「女」の場合に原本の「2.女」を〇で囲みます',
    isCircle: true,
    circleWidth: 22,
    circleHeight: 16,
    circleValueKey: 'gender_1',
    circleActiveValue: '2'
  },
  {
    id: 'gender_miner_1',
    name: '④ 種別 [3.坑内員 〇]',
    section: 'insured_person_1',
    x: 82.8,
    y: 28.8,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '坑内員の場合に原本の「3.坑内員」を〇で囲みます',
    isCircle: true,
    circleWidth: 26,
    circleHeight: 16,
    circleValueKey: 'gender_1',
    circleActiveValue: '3'
  },
  {
    id: 'gender_male_fund_1',
    name: '④ 種別 [5.男(基金) 〇]',
    section: 'insured_person_1',
    x: 88.8,
    y: 26.6,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '男(基金)の場合に原本の「5.男(基金)」を〇で囲みます',
    isCircle: true,
    circleWidth: 30,
    circleHeight: 16,
    circleValueKey: 'gender_1',
    circleActiveValue: '5'
  },
  {
    id: 'gender_female_fund_1',
    name: '④ 種別 [6.女(基金) 〇]',
    section: 'insured_person_1',
    x: 88.8,
    y: 27.7,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '女(基金)の場合に原本の「6.女(基金)」を〇で囲みます',
    isCircle: true,
    circleWidth: 30,
    circleHeight: 16,
    circleValueKey: 'gender_1',
    circleActiveValue: '6'
  },
  {
    id: 'gender_miner_fund_1',
    name: '④ 種別 [7.坑内員(基金) 〇]',
    section: 'insured_person_1',
    x: 88.8,
    y: 28.8,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '坑内員(基金)の場合に原本の「7.坑内員(基金)」を〇で囲みます',
    isCircle: true,
    circleWidth: 34,
    circleHeight: 16,
    circleValueKey: 'gender_1',
    circleActiveValue: '7'
  },
  // ── ⑤ 取得区分（〇で囲む・選択肢個別） ──
  {
    id: 'acqCat_kenpo_1',
    name: '⑤ 取得区分 [1.健保・厚年 〇]',
    section: 'insured_person_1',
    x: 14.5,
    y: 31.9,
    fontSize: 10.0,
    width: 3.0,
    example: '〇',
    description: '健保・厚年の場合に原本の「1.健保・厚年」を〇で囲みます',
    isCircle: true,
    circleWidth: 32,
    circleHeight: 16,
    circleValueKey: 'acqCategory_1',
    circleActiveValue: '1'
  },
  {
    id: 'acqCat_kyosai_1',
    name: '⑤ 取得区分 [3.共済出向 〇]',
    section: 'insured_person_1',
    x: 14.5,
    y: 33.1,
    fontSize: 10.0,
    width: 3.0,
    example: '〇',
    description: '共済出向の場合に原本の「3.共済出向」を〇で囲みます',
    isCircle: true,
    circleWidth: 28,
    circleHeight: 16,
    circleValueKey: 'acqCategory_1',
    circleActiveValue: '3'
  },
  {
    id: 'acqCat_senpo_1',
    name: '⑤ 取得区分 [4.船保任継 〇]',
    section: 'insured_person_1',
    x: 14.5,
    y: 34.3,
    fontSize: 10.0,
    width: 3.0,
    example: '〇',
    description: '船保任継の場合に原本の「4.船保任継」を〇で囲みます',
    isCircle: true,
    circleWidth: 28,
    circleHeight: 16,
    circleValueKey: 'acqCategory_1',
    circleActiveValue: '4'
  },
  {
    id: 'myNumberOrPension_1',
    name: '⑥ 個人番号（12桁）または基礎年金番号（10桁）',
    section: 'insured_person_1',
    x: 23.4,
    y: 32.5,
    fontSize: 10.5,
    pitch: 2.72,
    width: 33.0,
    example: '123456789012',
    description: 'マイナンバー12桁または基礎年金番号10桁（左詰めマス目）'
  },

  {
    id: 'acqYear_1',
    name: '⑦ 取得年月日 年',
    section: 'insured_person_1',
    x: 69.2,
    y: 32.5,
    fontSize: 9.5,
    width: 3.5,
    example: '08',
    description: '取得年（2桁）'
  },
  {
    id: 'acqMonth_1',
    name: '⑦ 取得年月日 月',
    section: 'insured_person_1',
    x: 73.8,
    y: 32.5,
    fontSize: 9.5,
    width: 3.5,
    example: '04',
    description: '取得月（2桁）'
  },
  {
    id: 'acqDay_1',
    name: '⑦ 取得年月日 日',
    section: 'insured_person_1',
    x: 78.4,
    y: 32.5,
    fontSize: 9.5,
    width: 3.5,
    example: '01',
    description: '取得日（2桁）'
  },
  // ── ⑧ 被扶養者（〇で囲む・選択肢個別） ──
  {
    id: 'dependents_none_1',
    name: '⑧ 被扶養者 [0.無 〇]',
    section: 'insured_person_1',
    x: 83.2,
    y: 32.5,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '被扶養者なしの場合に原本の「0.無」を〇で囲みます',
    isCircle: true,
    circleWidth: 22,
    circleHeight: 16,
    circleValueKey: 'dependents_1',
    circleActiveValue: '0'
  },
  {
    id: 'dependents_has_1',
    name: '⑧ 被扶養者 [1.有 〇]',
    section: 'insured_person_1',
    x: 89.6,
    y: 32.5,
    fontSize: 10.0,
    width: 3.5,
    example: '〇',
    description: '被扶養者ありの場合に原本の「1.有」を〇で囲みます',
    isCircle: true,
    circleWidth: 22,
    circleHeight: 16,
    circleValueKey: 'dependents_1',
    circleActiveValue: '1'
  },
  {
    id: 'currencyRemuneration_1',
    name: '⑨ 報酬月額 ㋐通貨（円）',
    section: 'insured_person_1',
    x: 20.6,
    y: 35.3,
    fontSize: 9.5,
    pitch: 1.9,
    width: 15.0,
    example: '250000',
    description: '金銭で支払われる基本給・手当の合計（右詰めマス目）'
  },
  {
    id: 'goodsRemuneration_1',
    name: '⑨ 報酬月額 ㋑現物（円）',
    section: 'insured_person_1',
    x: 20.6,
    y: 37.3,
    fontSize: 9.5,
    pitch: 1.9,
    width: 15.0,
    example: '',
    description: '食事・住宅等、現物で支給される評価額（右詰めマス目）'
  },
  {
    id: 'totalRemuneration_1',
    name: '⑨ 報酬月額 ㋒合計（円）',
    section: 'insured_person_1',
    x: 38.6,
    y: 36.3,
    fontSize: 10.0,
    pitch: 1.9,
    width: 15.0,
    example: '250000',
    description: '㋐通貨 + ㋑現物の合計額（右詰めマス目）'
  },
  // ── ⑩ 備考（〇で囲む・選択肢個別） ──
  {
    id: 'remarks_70_1',
    name: '⑩ 備考 [1.70歳以上 〇]',
    section: 'insured_person_1',
    x: 66.5,
    y: 36.1,
    fontSize: 9.0,
    width: 32.0,
    example: '〇',
    description: '70歳以上被用者の場合に原本の「1.70歳以上被用者該当」を〇で囲みます',
    isCircle: true,
    circleWidth: 36,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '1'
  },
  {
    id: 'remarks_two_1',
    name: '⑩ 備考 [2.二以上事業所 〇]',
    section: 'insured_person_1',
    x: 67.5,
    y: 37.3,
    fontSize: 9.0,
    width: 32.0,
    example: '〇',
    description: '二以上事業所勤務の場合に原本の「2.二以上事業所勤務者の取得」を〇で囲みます',
    isCircle: true,
    circleWidth: 38,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '2'
  },
  {
    id: 'remarks_part_1',
    name: '⑩ 備考 [3.短時間労働者 〇]',
    section: 'insured_person_1',
    x: 82.5,
    y: 36.1,
    fontSize: 9.0,
    width: 32.0,
    example: '〇',
    description: '短時間労働者の場合に原本の「3.短時間労働者の取得」を〇で囲みます',
    isCircle: true,
    circleWidth: 42,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '3'
  },
  {
    id: 'remarks_rehire_1',
    name: '⑩ 備考 [4.再雇用 〇]',
    section: 'insured_person_1',
    x: 81.5,
    y: 37.3,
    fontSize: 9.0,
    width: 32.0,
    example: '〇',
    description: '退職後継続再雇用の取得の場合に原本の「4.退職後の継続再雇用者の取得」を〇で囲みます',
    isCircle: true,
    circleWidth: 40,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '4'
  },
  {
    id: 'remarks_other_1',
    name: '⑩ 備考 [5.その他 〇]',
    section: 'insured_person_1',
    x: 78.5,
    y: 38.3,
    fontSize: 9.0,
    width: 32.0,
    example: '〇',
    description: 'その他の場合に原本の「5.その他」を〇で囲みます',
    isCircle: true,
    circleWidth: 28,
    circleHeight: 16,
    circleValueKey: 'remarks_1',
    circleActiveValue: '5'
  },
  {
    id: 'zipCode_first_1',
    name: '⑪ 住所 郵便番号（上3桁）',
    section: 'insured_person_1',
    x: 13.5,
    y: 39.5,
    fontSize: 9.0,
    pitch: 2.0,
    width: 6.5,
    example: '520',
    description: '住民票住所の郵便番号上3桁（マス目印字）'
  },
  {
    id: 'zipCode_last_1',
    name: '⑪ 住所 郵便番号（下4桁）',
    section: 'insured_person_1',
    x: 20.3,
    y: 39.5,
    fontSize: 9.0,
    pitch: 2.0,
    width: 8.5,
    example: '0001',
    description: '住民票住所の郵便番号下4桁（マス目印字）'
  },
  {
    id: 'addressKana_1',
    name: '⑪ 住所 フリガナ',
    section: 'insured_person_1',
    x: 26.0,
    y: 38.8,
    fontSize: 7.5,
    width: 50.0,
    example: 'シガケンオオツシハマオオツ1-1-1',
    description: '住民票住所のフリガナ（上段枠・カタカナ）'
  },
  {
    id: 'address_1',
    name: '⑪ 住所（漢字）',
    section: 'insured_person_1',
    x: 26.0,
    y: 40.2,
    fontSize: 9.0,
    width: 50.0,
    example: '滋賀県大津市浜大津1-1-1',
    description: '住民票上の住所（下段枠・個人番号記入時は省略可）'
  },
  {
    id: 'certIssue_1',
    name: '⑫ 資格確認書 発行要否（チェック）',
    section: 'insured_person_1',
    x: 85.0,
    y: 39.5,
    fontSize: 11.0,
    width: 5.0,
    example: '',
    description: 'マイナ保険証未所持等で発行が必要な場合「レ」'
  }
];

const STORAGE_KEY = 'mock_health_pension_acq_doc_coords_v3';

// ローカルストレージから座標を取得
export function loadHealthPensionAcqCoordinates(): HealthPensionAcqFieldConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return DEFAULT_HEALTH_PENSION_ACQ_FIELDS.map(def => {
          let custom = parsed.find((p: any) => p.id === def.id);
          // 旧郵便番号ID（officeZipCode, zipCode_1）からの安全マイグレーション
          if (!custom) {
            if (def.id === 'officeZipCode_first' || def.id === 'officeZipCode_last') {
              const old = parsed.find((p: any) => p.id === 'officeZipCode');
              if (old) {
                custom = {
                  ...def,
                  y: old.y !== undefined ? old.y : def.y,
                  fontSize: old.fontSize !== undefined ? old.fontSize : def.fontSize
                };
              }
            } else if (def.id === 'zipCode_first_1' || def.id === 'zipCode_last_1') {
              const old = parsed.find((p: any) => p.id === 'zipCode_1');
              if (old) {
                custom = {
                  ...def,
                  y: old.y !== undefined ? old.y : def.y,
                  fontSize: old.fontSize !== undefined ? old.fontSize : def.fontSize
                };
              }
            }
          }

          if (custom) {
            // 異常ピッチ（過去の計算破綻時に入力された5.0%超等）を原本規定値へ安全修復
            const safePitch = (custom.pitch !== undefined && custom.pitch > 0 && custom.pitch <= 5.0) 
              ? custom.pitch 
              : def.pitch;

            const isZipField = def.id === 'officeZipCode_first' || def.id === 'officeZipCode_last' || def.id === 'zipCode_first_1' || def.id === 'zipCode_last_1';

            // 旧 address_1 の初期値（39.5）だった場合は新下段初期値（40.2）へ自動補正
            let safeY = custom.y !== undefined ? custom.y : def.y;
            if (def.id === 'address_1' && safeY === 39.5) {
              safeY = 40.2;
            }

            return {
              ...def,
              x: custom.x !== undefined ? custom.x : def.x,
              y: safeY,
              fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
              pitch: safePitch,
              width: custom.width !== undefined ? custom.width : def.width,
              circleWidth: custom.circleWidth !== undefined ? custom.circleWidth : def.circleWidth,
              circleHeight: custom.circleHeight !== undefined ? custom.circleHeight : def.circleHeight,
              example: isZipField ? def.example : (custom.example || def.example),
              disabled: custom.disabled
            };
          }
          return def;
        });
      }
    }
  } catch (e) {
    console.warn('Error loading health pension acq coordinates from localStorage:', e);
  }
  return DEFAULT_HEALTH_PENSION_ACQ_FIELDS;
}

// 座標をローカルストレージに保存
export function saveHealthPensionAcqCoordinates(fields: HealthPensionAcqFieldConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
  } catch (e) {
    console.warn('Error saving health pension acq coordinates to localStorage:', e);
  }
}

// 変更イベントをブロードキャスト（リアルタイム反映）
export function broadcastHealthPensionAcqCoordinates(fields: HealthPensionAcqFieldConfig[]) {
  window.dispatchEvent(new CustomEvent(HEALTH_PENSION_ACQ_COORDS_UPDATE_EVENT, { detail: fields }));
}

// Supabase DB から座標設定を取得
export async function fetchHealthPensionAcqCoordinatesFromDb(): Promise<HealthPensionAcqFieldConfig[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('health_pension_acq_doc_coordinates')
      .limit(1)
      .maybeSingle();

    if (data && data.health_pension_acq_doc_coordinates && Array.isArray(data.health_pension_acq_doc_coordinates)) {
      const merged = DEFAULT_HEALTH_PENSION_ACQ_FIELDS.map(def => {
        let custom = data.health_pension_acq_doc_coordinates.find((p: any) => p.id === def.id);
        // 旧郵便番号ID（officeZipCode, zipCode_1）からの安全マイグレーション
        if (!custom) {
          if (def.id === 'officeZipCode_first' || def.id === 'officeZipCode_last') {
            const old = data.health_pension_acq_doc_coordinates.find((p: any) => p.id === 'officeZipCode');
            if (old) {
              custom = {
                ...def,
                y: old.y !== undefined ? old.y : def.y,
                fontSize: old.fontSize !== undefined ? old.fontSize : def.fontSize
              };
            }
          } else if (def.id === 'zipCode_first_1' || def.id === 'zipCode_last_1') {
            const old = data.health_pension_acq_doc_coordinates.find((p: any) => p.id === 'zipCode_1');
            if (old) {
              custom = {
                ...def,
                y: old.y !== undefined ? old.y : def.y,
                fontSize: old.fontSize !== undefined ? old.fontSize : def.fontSize
              };
            }
          }
        }

        if (custom) {
          const safePitch = (custom.pitch !== undefined && custom.pitch > 0 && custom.pitch <= 5.0) 
            ? custom.pitch 
            : def.pitch;

          const isZipField = def.id === 'officeZipCode_first' || def.id === 'officeZipCode_last' || def.id === 'zipCode_first_1' || def.id === 'zipCode_last_1';

          // 旧 address_1 の初期値（39.5）だった場合は新下段初期値（40.2）へ自動補正
          let safeY = custom.y !== undefined ? custom.y : def.y;
          if (def.id === 'address_1' && safeY === 39.5) {
            safeY = 40.2;
          }

          return {
            ...def,
            x: custom.x !== undefined ? custom.x : def.x,
            y: safeY,
            fontSize: custom.fontSize !== undefined ? custom.fontSize : def.fontSize,
            pitch: safePitch,
            width: custom.width !== undefined ? custom.width : def.width,
            circleWidth: custom.circleWidth !== undefined ? custom.circleWidth : def.circleWidth,
            circleHeight: custom.circleHeight !== undefined ? custom.circleHeight : def.circleHeight,
            example: isZipField ? def.example : (custom.example || def.example),
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
  return loadHealthPensionAcqCoordinates();
}

// Supabase DB への保存
export async function saveHealthPensionAcqCoordinatesToDb(fields: HealthPensionAcqFieldConfig[]): Promise<boolean> {
  try {
    saveHealthPensionAcqCoordinates(fields);

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
          health_pension_acq_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);
      saveError = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert([{ 
          health_pension_acq_doc_coordinates: fields,
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
    console.error('Error saving health pension acq coordinates to DB:', err);
    return false;
  }
}
