// 国税庁公式「令和8年分 給与所得者の基礎控除申告書 兼 配偶者控除等申告書 兼 特定親族特別控除申告書 兼 所得金額調整控除申告書（A4横原本）」座標管理モジュール
import { supabase } from './supabase';

export type SpouseDocSection = 
  | 'header' 
  | 'basic_deduction' 
  | 'spouse_deduction' 
  | 'specific_relative' 
  | 'adjustment';

export interface SpouseDocFieldConfig {
  id: string;
  name: string;
  section: SpouseDocSection;
  x: number; // 0〜100 (%) 横位置
  y: number; // 0〜100 (%) 縦位置
  fontSize: number; // pt 相当（4〜24）
  pitch?: number; // % (マス目・文字間隔)
  width?: number; // % (フィールド幅)
  example: string;
  description: string;
  isCircle?: boolean; // ○印
  isCheck?: boolean; // ✓チェック
  disabled?: boolean; // 印字無効（非表示）
}

// 🎯 国税庁原本（A4横 297mm × 210mm）の枠内に収まる黄金比率デフォルト値
export const DEFAULT_SPOUSE_DOC_FIELDS: SpouseDocFieldConfig[] = [
  // ══════════════════════════════════════════════════════════════════════
  // ① ヘッダー（所轄税務署・給与支払者・申告者本人）
  // ══════════════════════════════════════════════════════════════════════
  { 
    id: 'taxOffice', 
    name: '所轄税務署長', 
    section: 'header', 
    x: 4.5, 
    y: 9.8, 
    fontSize: 10, 
    example: '千代田', 
    description: '左上「税務署長」の手前' 
  },
  { 
    id: 'companyName', 
    name: '給与支払者の名称（会社名）', 
    section: 'header', 
    x: 42.0, 
    y: 8.5, 
    fontSize: 10, 
    example: '株式会社オアシスホールディングス', 
    description: '右上「給与支払者 名称」欄' 
  },
  { 
    id: 'corporateNumber', 
    name: '給与支払者 法人番号（13桁）', 
    section: 'header', 
    x: 77.0, 
    y: 8.5, 
    fontSize: 10, 
    pitch: 1.55, 
    example: '1234567890123', 
    description: '右上「法人番号」13桁枠' 
  },
  { 
    id: 'companyAddress', 
    name: '給与支払者の所在地（住所）', 
    section: 'header', 
    x: 42.0, 
    y: 11.2, 
    fontSize: 9, 
    example: '東京都千代田区霞が関1-1-1', 
    description: '右上「所在地（住所）」欄' 
  },
  { 
    id: 'empKana', 
    name: 'あなたのフリガナ', 
    section: 'header', 
    x: 42.0, 
    y: 13.8, 
    fontSize: 8, 
    example: 'ヤマダ タロウ', 
    description: '「あなたの氏名」上段フリガナ' 
  },
  { 
    id: 'empName', 
    name: 'あなたの氏名', 
    section: 'header', 
    x: 42.0, 
    y: 15.6, 
    fontSize: 11, 
    example: '山田 太郎', 
    description: '「あなたの氏名」欄' 
  },
  { 
    id: 'empAddress', 
    name: 'あなたの住所又は居所', 
    section: 'header', 
    x: 65.0, 
    y: 15.2, 
    fontSize: 9, 
    example: '東京都世田谷区桜丘2-10-5', 
    description: '「あなたの住所又は居所」欄' 
  },

  // ══════════════════════════════════════════════════════════════════════
  // ② 給与所得者の基礎控除申告書（中央左側ブロック）
  // ══════════════════════════════════════════════════════════════════════
  { 
    id: 'basicSalaryIncome', 
    name: '基礎：給与所得 収入金額', 
    section: 'basic_deduction', 
    x: 18.0, 
    y: 25.0, 
    fontSize: 10, 
    example: '5,000,000', 
    description: '給与所得の収入金額' 
  },
  { 
    id: 'basicSalaryCalc', 
    name: '基礎：給与所得 所得金額', 
    section: 'basic_deduction', 
    x: 35.0, 
    y: 25.0, 
    fontSize: 10, 
    example: '3,560,000', 
    description: '給与所得の所得金額（計算結果）' 
  },
  { 
    id: 'basicOtherIncome', 
    name: '基礎：給与所得以外の所得金額', 
    section: 'basic_deduction', 
    x: 35.0, 
    y: 28.5, 
    fontSize: 10, 
    example: '0', 
    description: '給与所得以外の所得金額の合計額' 
  },
  { 
    id: 'basicTotalIncome', 
    name: '基礎：あなたの合計所得金額（見積額）', 
    section: 'basic_deduction', 
    x: 35.0, 
    y: 32.0, 
    fontSize: 11, 
    example: '3,560,000', 
    description: 'あなたの本年中の合計所得金額の見積額' 
  },
  { 
    id: 'basicJudgeA', 
    name: '基礎：判定 900万円以下 (A)（✓）', 
    section: 'basic_deduction', 
    x: 23.5, 
    y: 37.0, 
    fontSize: 11, 
    example: '✓', 
    description: '判定 900万円以下（A）チェック', 
    isCheck: true 
  },
  { 
    id: 'basicJudgeB', 
    name: '基礎：判定 900万超950万以下 (B)（✓）', 
    section: 'basic_deduction', 
    x: 23.5, 
    y: 39.8, 
    fontSize: 11, 
    example: '✓', 
    description: '判定 900万円超950万円以下（B）チェック', 
    isCheck: true 
  },
  { 
    id: 'basicJudgeC', 
    name: '基礎：判定 950万超1000万以下 (C)（✓）', 
    section: 'basic_deduction', 
    x: 23.5, 
    y: 42.6, 
    fontSize: 11, 
    example: '✓', 
    description: '判定 950万円超1000万円以下（C）チェック', 
    isCheck: true 
  },
  { 
    id: 'basicCategory1', 
    name: '基礎：区分Ⅰ（A/B/C）', 
    section: 'basic_deduction', 
    x: 30.5, 
    y: 38.0, 
    fontSize: 12, 
    example: 'A', 
    description: '控除額計算の区分Ⅰ（配偶者控除等申告書でも使用）' 
  },
  { 
    id: 'basicDeductionAmount', 
    name: '基礎：基礎控除の額', 
    section: 'basic_deduction', 
    x: 40.0, 
    y: 38.0, 
    fontSize: 11, 
    example: '480,000', 
    description: '基礎控除の額（満額48万円 / 32万円 / 16万円）' 
  },

  // ══════════════════════════════════════════════════════════════════════
  // ③ 給与所得者の配偶者控除等申告書（中央右側ブロック）
  // ══════════════════════════════════════════════════════════════════════
  { 
    id: 'spouseKana', 
    name: '配偶者フリガナ', 
    section: 'spouse_deduction', 
    x: 55.0, 
    y: 21.0, 
    fontSize: 8, 
    example: 'ヤマダ ハナコ', 
    description: '配偶者の氏名上段フリガナ' 
  },
  { 
    id: 'spouseName', 
    name: '配偶者氏名', 
    section: 'spouse_deduction', 
    x: 55.0, 
    y: 23.2, 
    fontSize: 11, 
    example: '山田 花子', 
    description: '配偶者の氏名' 
  },
  { 
    id: 'spouseMyNumber', 
    name: '配偶者個人番号（12桁）', 
    section: 'spouse_deduction', 
    x: 77.0, 
    y: 23.2, 
    fontSize: 9, 
    pitch: 1.45, 
    example: '987654321098', 
    description: '配偶者の個人番号12マス' 
  },
  { 
    id: 'spouseEraMeiji', 
    name: '配偶者元号 明（○印）', 
    section: 'spouse_deduction', 
    x: 53.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '○', 
    description: '配偶者生年月日「明」○印', 
    isCircle: true 
  },
  { 
    id: 'spouseEraTaisho', 
    name: '配偶者元号 大（○印）', 
    section: 'spouse_deduction', 
    x: 54.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '○', 
    description: '配偶者生年月日「大」○印', 
    isCircle: true 
  },
  { 
    id: 'spouseEraShowa', 
    name: '配偶者元号 昭（○印）', 
    section: 'spouse_deduction', 
    x: 55.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '○', 
    description: '配偶者生年月日「昭」○印', 
    isCircle: true 
  },
  { 
    id: 'spouseEraHeisei', 
    name: '配偶者元号 平（○印）', 
    section: 'spouse_deduction', 
    x: 56.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '○', 
    description: '配偶者生年月日「平」○印', 
    isCircle: true 
  },
  { 
    id: 'spouseEraReiwa', 
    name: '配偶者元号 令（○印）', 
    section: 'spouse_deduction', 
    x: 57.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '○', 
    description: '配偶者生年月日「令」○印', 
    isCircle: true 
  },
  { 
    id: 'spouseBirthY', 
    name: '配偶者生年（年）', 
    section: 'spouse_deduction', 
    x: 58.8, 
    y: 26.2, 
    fontSize: 10, 
    example: '4', 
    description: '配偶者生年月日「年」' 
  },
  { 
    id: 'spouseBirthM', 
    name: '配偶者生月（月）', 
    section: 'spouse_deduction', 
    x: 61.8, 
    y: 26.2, 
    fontSize: 10, 
    example: '8', 
    description: '配偶者生年月日「月」' 
  },
  { 
    id: 'spouseBirthD', 
    name: '配偶者生日（日）', 
    section: 'spouse_deduction', 
    x: 64.5, 
    y: 26.2, 
    fontSize: 10, 
    example: '15', 
    description: '配偶者生年月日「日」' 
  },
  { 
    id: 'spouseNonResidentCheck', 
    name: '非居住者配偶者（✓）', 
    section: 'spouse_deduction', 
    x: 68.5, 
    y: 26.2, 
    fontSize: 9, 
    example: '✓', 
    description: '非居住者である親族チェックボックス', 
    isCheck: true 
  },
  { 
    id: 'spouseLivingFact', 
    name: '生計を一にする事実（別居時）', 
    section: 'spouse_deduction', 
    x: 73.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '生活費・療養費送金', 
    description: '別居の場合の生計一の事実' 
  },
  { 
    id: 'spouseAddress', 
    name: '配偶者住所又は居所', 
    section: 'spouse_deduction', 
    x: 84.0, 
    y: 26.2, 
    fontSize: 8, 
    example: '同居', 
    description: '配偶者の住所（同居の場合は同上または省略）' 
  },
  { 
    id: 'spouseSalaryIncome', 
    name: '配偶者：給与所得 収入金額', 
    section: 'spouse_deduction', 
    x: 68.0, 
    y: 30.5, 
    fontSize: 10, 
    example: '1,000,000', 
    description: '配偶者の給与収入金額' 
  },
  { 
    id: 'spouseSalaryCalc', 
    name: '配偶者：給与所得 所得金額', 
    section: 'spouse_deduction', 
    x: 84.0, 
    y: 30.5, 
    fontSize: 10, 
    example: '450,000', 
    description: '配偶者の給与所得金額' 
  },
  { 
    id: 'spouseOtherIncome', 
    name: '配偶者：給与所得以外の所得金額', 
    section: 'spouse_deduction', 
    x: 84.0, 
    y: 33.2, 
    fontSize: 10, 
    example: '0', 
    description: '配偶者の給与所得以外の合計額' 
  },
  { 
    id: 'spouseTotalIncome', 
    name: '配偶者：合計所得金額（見積額）', 
    section: 'spouse_deduction', 
    x: 84.0, 
    y: 36.0, 
    fontSize: 11, 
    example: '450,000', 
    description: '配偶者の本年中の合計所得金額の見積額' 
  },
  { 
    id: 'spouseJudge1', 
    name: '配偶者判定 ①（48万以下・昭32以前）（✓）', 
    section: 'spouse_deduction', 
    x: 53.0, 
    y: 40.5, 
    fontSize: 10, 
    example: '✓', 
    description: '① 48万円以下かつ昭32.1.1以前生（老人控除対象配偶者）', 
    isCheck: true 
  },
  { 
    id: 'spouseJudge2', 
    name: '配偶者判定 ②（48万以下・昭32以後）（✓）', 
    section: 'spouse_deduction', 
    x: 53.0, 
    y: 42.5, 
    fontSize: 10, 
    example: '✓', 
    description: '② 48万円以下かつ昭32.1.2以後生（一般の控除対象配偶者）', 
    isCheck: true 
  },
  { 
    id: 'spouseJudge3', 
    name: '配偶者判定 ③（48万超〜95万以下）（✓）', 
    section: 'spouse_deduction', 
    x: 53.0, 
    y: 44.5, 
    fontSize: 10, 
    example: '✓', 
    description: '③ 48万円超〜95万円以下（配偶者特別控除 最高額枠）', 
    isCheck: true 
  },
  { 
    id: 'spouseJudge4', 
    name: '配偶者判定 ④（95万超〜100万以下）（✓）', 
    section: 'spouse_deduction', 
    x: 53.0, 
    y: 46.5, 
    fontSize: 10, 
    example: '✓', 
    description: '④ 95万円超〜100万円以下', 
    isCheck: true 
  },
  { 
    id: 'spouseJudge5', 
    name: '配偶者判定 ⑤（100万超〜105万以下）（✓）', 
    section: 'spouse_deduction', 
    x: 53.0, 
    y: 48.5, 
    fontSize: 10, 
    example: '✓', 
    description: '⑤ 100万円超〜105万円以下', 
    isCheck: true 
  },
  { 
    id: 'spouseCategory2', 
    name: '配偶者：区分Ⅱ（①〜④）', 
    section: 'spouse_deduction', 
    x: 72.0, 
    y: 44.5, 
    fontSize: 12, 
    example: '②', 
    description: '配偶者の区分Ⅱ' 
  },
  { 
    id: 'spouseDeductionAmount', 
    name: '配偶者控除の額', 
    section: 'spouse_deduction', 
    x: 83.5, 
    y: 43.0, 
    fontSize: 11, 
    example: '380,000', 
    description: '配偶者控除の額（38万円/26万円/13万円）' 
  },
  { 
    id: 'spouseSpecialDeductionAmount', 
    name: '配偶者特別控除の額', 
    section: 'spouse_deduction', 
    x: 93.0, 
    y: 43.0, 
    fontSize: 11, 
    example: '', 
    description: '配偶者特別控除の額（38万円〜1万円）' 
  },

  // ══════════════════════════════════════════════════════════════════════
  // ④ 給与所得者の特定親族特別控除申告書（令和8年新設枠）
  // ══════════════════════════════════════════════════════════════════════
  { 
    id: 'specificKana', 
    name: '特定親族フリガナ', 
    section: 'specific_relative', 
    x: 8.0, 
    y: 53.0, 
    fontSize: 8, 
    example: 'ヤマダ イチロウ', 
    description: '特定親族の氏名フリガナ' 
  },
  { 
    id: 'specificName', 
    name: '特定親族氏名', 
    section: 'specific_relative', 
    x: 8.0, 
    y: 55.2, 
    fontSize: 11, 
    example: '山田 一郎', 
    description: '特定親族の氏名' 
  },
  { 
    id: 'specificMyNumber', 
    name: '特定親族個人番号（12桁）', 
    section: 'specific_relative', 
    x: 23.5, 
    y: 55.2, 
    fontSize: 9, 
    pitch: 1.40, 
    example: '112233445566', 
    description: '特定親族の個人番号' 
  },
  { 
    id: 'specificRel', 
    name: '特定親族あなたとの続柄', 
    section: 'specific_relative', 
    x: 37.5, 
    y: 55.2, 
    fontSize: 10, 
    example: '長男', 
    description: '特定親族の続柄' 
  },
  { 
    id: 'specificEraHeisei', 
    name: '特定親族元号 平（○印）', 
    section: 'specific_relative', 
    x: 43.0, 
    y: 55.2, 
    fontSize: 8, 
    example: '○', 
    description: '生年月日元号「平」○印', 
    isCircle: true 
  },
  { 
    id: 'specificEraReiwa', 
    name: '特定親族元号 令（○印）', 
    section: 'specific_relative', 
    x: 44.0, 
    y: 55.2, 
    fontSize: 8, 
    example: '○', 
    description: '生年月日元号「令」○印', 
    isCircle: true 
  },
  { 
    id: 'specificBirthY', 
    name: '特定親族生年（年）', 
    section: 'specific_relative', 
    x: 46.0, 
    y: 55.2, 
    fontSize: 10, 
    example: '16', 
    description: '生年月日年' 
  },
  { 
    id: 'specificBirthM', 
    name: '特定親族生月（月）', 
    section: 'specific_relative', 
    x: 49.0, 
    y: 55.2, 
    fontSize: 10, 
    example: '5', 
    description: '生年月日月' 
  },
  { 
    id: 'specificBirthD', 
    name: '特定親族生日（日）', 
    section: 'specific_relative', 
    x: 52.0, 
    y: 55.2, 
    fontSize: 10, 
    example: '20', 
    description: '生年月日日' 
  },
  { 
    id: 'specificAddress', 
    name: '特定親族住所又は居所', 
    section: 'specific_relative', 
    x: 58.0, 
    y: 55.2, 
    fontSize: 9, 
    example: '同居', 
    description: '特定親族の住所' 
  },
  { 
    id: 'specificTotalIncome', 
    name: '特定親族所得見積額', 
    section: 'specific_relative', 
    x: 76.0, 
    y: 55.2, 
    fontSize: 10, 
    example: '0', 
    description: '特定親族の本年中の合計所得金額の見積額' 
  },
  { 
    id: 'specificDeductionAmount', 
    name: '特定親族特別控除の額', 
    section: 'specific_relative', 
    x: 88.0, 
    y: 55.2, 
    fontSize: 11, 
    example: '630,000', 
    description: '特定親族特別控除の額' 
  },

  // ══════════════════════════════════════════════════════════════════════
  // ⑤ 所得金額調整控除申告書（下段ブロック）
  // ══════════════════════════════════════════════════════════════════════
  { 
    id: 'adjCheckSelfDisabled', 
    name: '調整：本人 特別障害者（✓）', 
    section: 'adjustment', 
    x: 8.5, 
    y: 67.5, 
    fontSize: 10, 
    example: '✓', 
    description: '要件：あなた自身が特別障害者', 
    isCheck: true 
  },
  { 
    id: 'adjCheckSpouseDisabled', 
    name: '調整：同一生計配偶者 特別障害者（✓）', 
    section: 'adjustment', 
    x: 8.5, 
    y: 69.8, 
    fontSize: 10, 
    example: '✓', 
    description: '要件：同一生計配偶者が特別障害者', 
    isCheck: true 
  },
  { 
    id: 'adjCheckDepDisabled', 
    name: '調整：扶養親族 特別障害者（✓）', 
    section: 'adjustment', 
    x: 8.5, 
    y: 72.0, 
    fontSize: 10, 
    example: '✓', 
    description: '要件：扶養親族が特別障害者', 
    isCheck: true 
  },
  { 
    id: 'adjCheckUnder23', 
    name: '調整：扶養親族 年齢23歳未満（✓）', 
    section: 'adjustment', 
    x: 8.5, 
    y: 74.2, 
    fontSize: 10, 
    example: '✓', 
    description: '要件：扶養親族が年齢23歳未満（平15.1.2以後生）', 
    isCheck: true 
  },
  { 
    id: 'adjTargetKana', 
    name: '調整対象者フリガナ', 
    section: 'adjustment', 
    x: 42.0, 
    y: 68.0, 
    fontSize: 8, 
    example: 'ヤマダ ジロウ', 
    description: '要件対象者の氏名フリガナ' 
  },
  { 
    id: 'adjTargetName', 
    name: '調整対象者氏名', 
    section: 'adjustment', 
    x: 42.0, 
    y: 70.5, 
    fontSize: 11, 
    example: '山田 次郎', 
    description: '要件対象者の氏名' 
  },
  { 
    id: 'adjTargetMyNumber', 
    name: '調整対象者個人番号（12桁）', 
    section: 'adjustment', 
    x: 58.0, 
    y: 70.5, 
    fontSize: 9, 
    pitch: 1.40, 
    example: '998877665544', 
    description: '要件対象者の個人番号' 
  },
  { 
    id: 'adjTargetBirth', 
    name: '調整対象者生年月日', 
    section: 'adjustment', 
    x: 74.0, 
    y: 70.5, 
    fontSize: 9, 
    example: '平20.6.10', 
    description: '要件対象者の生年月日' 
  },
  { 
    id: 'adjTargetRel', 
    name: '調整対象者続柄', 
    section: 'adjustment', 
    x: 86.0, 
    y: 70.5, 
    fontSize: 10, 
    example: '二男', 
    description: '要件対象者のあなたとの続柄' 
  },
  { 
    id: 'adjTargetAddress', 
    name: '調整対象者住所又は居所', 
    section: 'adjustment', 
    x: 42.0, 
    y: 74.2, 
    fontSize: 9, 
    example: '同居', 
    description: '要件対象者の住所' 
  },
  { 
    id: 'adjTargetIncome', 
    name: '調整対象者所得見積額', 
    section: 'adjustment', 
    x: 74.0, 
    y: 74.2, 
    fontSize: 10, 
    example: '0', 
    description: '要件対象者の合計所得金額の見積額' 
  },
  { 
    id: 'adjDisabledFact', 
    name: '特別障害者に該当する事実', 
    section: 'adjustment', 
    x: 42.0, 
    y: 78.5, 
    fontSize: 9, 
    example: '身体障害者手帳1級（第1種） 交付: 平30.4.1', 
    description: '特別障害者に該当する事実の記載欄' 
  }
];

export const SPOUSE_DOC_DEFAULT_MAP = new Map<string, SpouseDocFieldConfig>(
  DEFAULT_SPOUSE_DOC_FIELDS.map(f => [f.id, f])
);

export const SPOUSE_DOC_COORDS_STORAGE_KEY = 'spouseDocMasterFields';
export const SPOUSE_DOC_COORDS_UPDATE_EVENT = 'spouse_doc_coordinates_updated';

// ローカルストレージからのロード
export function loadSpouseDocCoordinates(): SpouseDocFieldConfig[] {
  try {
    const raw = localStorage.getItem(SPOUSE_DOC_COORDS_STORAGE_KEY);
    if (raw) {
      const parsed: SpouseDocFieldConfig[] = JSON.parse(raw);
      return DEFAULT_SPOUSE_DOC_FIELDS.map(def => {
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
    }
  } catch (err) {
    console.warn('Failed to parse local spouse doc coordinates:', err);
  }
  return [...DEFAULT_SPOUSE_DOC_FIELDS];
}

// ローカルストレージへの保存
export function saveSpouseDocCoordinates(fields: SpouseDocFieldConfig[]) {
  try {
    localStorage.setItem(SPOUSE_DOC_COORDS_STORAGE_KEY, JSON.stringify(fields));
  } catch (err) {
    console.warn('Failed to save spouse doc coordinates to localStorage:', err);
  }
}

// リアルタイム反映ブロードキャスト
export function broadcastSpouseDocCoordinates(fields: SpouseDocFieldConfig[]) {
  const ev = new CustomEvent(SPOUSE_DOC_COORDS_UPDATE_EVENT, { detail: fields });
  window.dispatchEvent(ev);
}

// Supabase DB からの全社同期座標取得
export async function fetchSpouseDocCoordinatesFromDb(): Promise<SpouseDocFieldConfig[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('spouse_doc_coordinates')
      .limit(1)
      .maybeSingle();

    if (data && data.spouse_doc_coordinates && Array.isArray(data.spouse_doc_coordinates)) {
      const dbFields = data.spouse_doc_coordinates as SpouseDocFieldConfig[];
      const merged = DEFAULT_SPOUSE_DOC_FIELDS.map(def => {
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
      saveSpouseDocCoordinates(merged);
      return merged;
    }
  } catch (err) {
    console.warn('DB fetch failed, fallback to local:', err);
  }
  return loadSpouseDocCoordinates();
}

// Supabase DB への保存（UUID完全整合・レコード自動判定）
export async function saveSpouseDocCoordinatesToDb(fields: SpouseDocFieldConfig[]): Promise<boolean> {
  try {
    saveSpouseDocCoordinates(fields);

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
          spouse_doc_coordinates: fields,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);
      saveError = res.error;
    } else {
      const res = await supabase
        .from('system_settings')
        .insert([{ 
          spouse_doc_coordinates: fields,
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
    console.error('Error saving spouse doc coordinates to DB:', err);
    return false;
  }
}
