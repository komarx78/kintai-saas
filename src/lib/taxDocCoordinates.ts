// 国税庁公式PDF（2026bun_01.pdf）原本マス目の完全較正座標テーブル（黄金比精密マスター版）

export interface TaxDocFieldConfig {
  id: string;
  name: string;
  section: 'header' | 'employee' | 'spouse' | 'dependent' | 'special' | 'resident' | 'retirement';
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当（4〜24）
  pitch?: number; // % (マス目・数字間隔)
  example: string;
  description: string;
  isCircle?: boolean; // ○印
  isCheck?: boolean; // ✓チェック
}

// 🎯 国税庁原本（2026bun_01.pdf）の枠内にぴったり収まる黄金比率デフォルト値
export const DEFAULT_TAX_FIELDS: TaxDocFieldConfig[] = [
  // ① 給与支払者
  { id: 'taxOffice', name: '所轄税務署長', section: 'header', x: 8.5, y: 13.0, fontSize: 10, example: '千代田', description: '左上「税務署長等」枠内' },
  { id: 'municipality', name: '市区町村長', section: 'header', x: 8.5, y: 17.2, fontSize: 10, example: '千代田区', description: '「市区町村長」枠内' },
  { id: 'companyName', name: '給与支払者の名称（会社名）', section: 'header', x: 23.5, y: 11.5, fontSize: 11, example: '株式会社KAP', description: '給与支払者 1段目' },
  { id: 'corporateNumber', name: '法人番号（13桁）', section: 'header', x: 23.5, y: 14.8, fontSize: 10, pitch: 1.02, example: '1010001999999', description: '給与支払者 2段目' },
  { id: 'companyAddress', name: '所在地（住所）', section: 'header', x: 23.5, y: 17.5, fontSize: 9, example: '滋賀県大津市坂本3丁目21-16', description: '給与支払者 3段目' },

  // ② 申告者本人
  { id: 'empKana', name: 'あなたのフリガナ', section: 'employee', x: 44.5, y: 10.5, fontSize: 7, example: 'テスト タロウ', description: '「（フリガナ）」行' },
  { id: 'empName', name: 'あなたの氏名', section: 'employee', x: 44.5, y: 12.8, fontSize: 12, example: '駒井 秀一朗', description: '「あなたの氏名」枠内' },
  { id: 'empMyNumber', name: 'あなたの個人番号（12桁マス目）', section: 'employee', x: 42.8, y: 15.0, fontSize: 10, pitch: 1.80, example: '123456789012', description: '12マスの四角枠' },
  { id: 'empPostal', name: 'あなたの郵便番号', section: 'employee', x: 50.8, y: 16.5, fontSize: 8, example: '160-0023', description: '住所欄の〒右側' },
  { id: 'empAddress', name: 'あなたの住所', section: 'employee', x: 42.8, y: 18.0, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'あなたの住所又は居所' },
  
  // 生年月日・元号○印
  { id: 'empEraMeiji', name: '本人元号 明（○印）', section: 'employee', x: 65.2, y: 10.3, fontSize: 8, example: '○', description: '生年月日の「明」を囲む○印', isCircle: true },
  { id: 'empEraTaisho', name: '本人元号 大（○印）', section: 'employee', x: 66.0, y: 10.3, fontSize: 8, example: '○', description: '生年月日の「大」を囲む○印', isCircle: true },
  { id: 'empEraShowa', name: '本人元号 昭（○印）', section: 'employee', x: 65.2, y: 11.2, fontSize: 8, example: '○', description: '生年月日の「昭」を囲む○印', isCircle: true },
  { id: 'empEraHeisei', name: '本人元号 平（○印）', section: 'employee', x: 66.0, y: 11.2, fontSize: 8, example: '○', description: '生年月日の「平」を囲む○印', isCircle: true },
  { id: 'empEraReiwa', name: '本人元号 令（○印）', section: 'employee', x: 66.8, y: 11.2, fontSize: 8, example: '○', description: '生年月日の「令」を囲む○印', isCircle: true },
  { id: 'empBirthY', name: '生年月日（年）', section: 'employee', x: 68.8, y: 10.8, fontSize: 10, example: '7', description: '生年月日の「年」枠' },
  { id: 'empBirthM', name: '生年月日（月）', section: 'employee', x: 73.0, y: 10.8, fontSize: 10, example: '4', description: '生年月日の「月」枠' },
  { id: 'empBirthD', name: '生年月日（日）', section: 'employee', x: 76.0, y: 10.8, fontSize: 10, example: '1', description: '生年月日の「日」枠' },
  { id: 'householderName', name: '世帯主の氏名', section: 'employee', x: 67.5, y: 13.0, fontSize: 10, example: '駒井 秀一朗', description: '世帯主欄' },
  { id: 'householderRel', name: 'あなたとの続柄', section: 'employee', x: 74.0, y: 13.0, fontSize: 10, example: '本人', description: '続柄欄' },
  { id: 'hasSpouseYes', name: '配偶者 有（○印）', section: 'employee', x: 74.6, y: 16.2, fontSize: 10, example: '○', description: '「有」の文字を囲む円', isCircle: true },
  { id: 'hasSpouseNo', name: '配偶者 無（○印）', section: 'employee', x: 76.8, y: 16.2, fontSize: 10, example: '○', description: '「無」の文字を囲む円', isCircle: true },
  { id: 'secondarySalaryCircle', name: '従たる給与申告書（○印）', section: 'employee', x: 82.5, y: 14.8, fontSize: 10, example: '○', description: '右端「従たる給与」提出○印', isCircle: true },

  // ③ Ａ. 配偶者
  { id: 'spouseKana', name: '配偶者フリガナ', section: 'spouse', x: 16.5, y: 22.0, fontSize: 7, example: 'テスト ハナコ', description: 'Ａ欄フリガナ' },
  { id: 'spouseName', name: '配偶者氏名', section: 'spouse', x: 16.5, y: 23.8, fontSize: 11, example: 'テスト 花子', description: 'Ａ欄氏名' },
  { id: 'spouseMyNumber', name: '配偶者マイナンバー', section: 'spouse', x: 26.5, y: 23.8, fontSize: 9, pitch: 0.98, example: '************', description: 'Ａ欄12桁マス目' },
  { id: 'spouseEraShowa', name: '配偶者元号 昭（○印）', section: 'spouse', x: 38.6, y: 23.3, fontSize: 7, example: '○', description: 'Ａ欄元号「昭」の○印', isCircle: true },
  { id: 'spouseEraHeisei', name: '配偶者元号 平（○印）', section: 'spouse', x: 39.4, y: 23.3, fontSize: 7, example: '○', description: 'Ａ欄元号「平」の○印', isCircle: true },
  { id: 'spouseEraReiwa', name: '配偶者元号 令（○印）', section: 'spouse', x: 39.4, y: 24.2, fontSize: 7, example: '○', description: 'Ａ欄元号「令」の○印', isCircle: true },
  { id: 'spouseBirthY', name: '配偶者生年', section: 'spouse', x: 40.5, y: 23.8, fontSize: 10, example: '8', description: 'Ａ欄生年' },
  { id: 'spouseBirthM', name: '配偶者生月', section: 'spouse', x: 43.2, y: 23.8, fontSize: 10, example: '5', description: 'Ａ欄生月' },
  { id: 'spouseBirthD', name: '配偶者生日', section: 'spouse', x: 45.8, y: 23.8, fontSize: 10, example: '15', description: 'Ａ欄生日' },
  { id: 'spouseElderlyCheck', name: '老人控除対象配偶者（○印）', section: 'spouse', x: 48.0, y: 22.0, fontSize: 8, example: '○', description: '昭32.1.1以前生○印', isCircle: true },
  { id: 'spouseIncome', name: '配偶者所得見積額（数字のみ）', section: 'spouse', x: 53.0, y: 23.8, fontSize: 10, example: '0', description: 'Ａ欄所得見積額' },
  { id: 'spouseNonResidentCircle', name: '非居住者配偶者（○印）', section: 'spouse', x: 60.5, y: 22.0, fontSize: 8, example: '○', description: '非居住者である親族○印', isCircle: true },
  { id: 'spouseLiving', name: '生計を一にする事実', section: 'spouse', x: 58.5, y: 23.8, fontSize: 9, example: '同居', description: 'Ａ欄生計一事実' },
  { id: 'spouseAddress', name: '配偶者住所', section: 'spouse', x: 64.0, y: 23.8, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ａ欄住所' },

  // ④ Ｂ. 控除対象扶養親族（1人目〜4人目 フル完備）
  // 1人目
  { id: 'dep0Kana', name: '扶養1 フリガナ', section: 'dependent', x: 16.5, y: 26.0, fontSize: 7, example: 'テスト タロウ', description: 'Ｂ欄1人目カナ' },
  { id: 'dep0Name', name: '扶養1 氏名', section: 'dependent', x: 16.5, y: 27.5, fontSize: 11, example: 'テスト 太郎', description: 'Ｂ欄1人目氏名' },
  { id: 'dep0MyNumber', name: '扶養1 マイナンバー', section: 'dependent', x: 26.5, y: 27.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄1人目12桁マス目' },
  { id: 'dep0Rel', name: '扶養1 続柄', section: 'dependent', x: 34.5, y: 27.5, fontSize: 10, example: '長男', description: 'Ｂ欄1人目続柄' },
  { id: 'dep0EraShowa', name: '扶養1元号 昭（○印）', section: 'dependent', x: 38.6, y: 27.0, fontSize: 7, example: '○', description: 'Ｂ欄1人目「昭」○印', isCircle: true },
  { id: 'dep0EraHeisei', name: '扶養1元号 平（○印）', section: 'dependent', x: 39.4, y: 27.0, fontSize: 7, example: '○', description: 'Ｂ欄1人目「平」○印', isCircle: true },
  { id: 'dep0EraReiwa', name: '扶養1元号 令（○印）', section: 'dependent', x: 39.4, y: 27.9, fontSize: 7, example: '○', description: 'Ｂ欄1人目「令」○印', isCircle: true },
  { id: 'dep0BirthY', name: '扶養1 生年', section: 'dependent', x: 40.5, y: 27.5, fontSize: 10, example: '27', description: 'Ｂ欄1人目生年' },
  { id: 'dep0BirthM', name: '扶養1 生月', section: 'dependent', x: 43.2, y: 27.5, fontSize: 10, example: '5', description: 'Ｂ欄1人目生月' },
  { id: 'dep0BirthD', name: '扶養1 生日', section: 'dependent', x: 45.8, y: 27.5, fontSize: 10, example: '1', description: 'Ｂ欄1人目生日' },
  { id: 'dep0CheckElderlyLiving', name: '扶養1 同居老親等（✓）', section: 'dependent', x: 44.5, y: 26.8, fontSize: 8, example: '✓', description: 'Ｂ欄1人目 同居老親等ボックス', isCheck: true },
  { id: 'dep0CheckElderlyOther', name: '扶養1 その他老人（✓）', section: 'dependent', x: 44.5, y: 28.2, fontSize: 8, example: '✓', description: 'Ｂ欄1人目 その他老人ボックス', isCheck: true },
  { id: 'dep0CheckSpecific', name: '扶養1 特定扶養（✓）', section: 'dependent', x: 44.5, y: 29.5, fontSize: 8, example: '✓', description: 'Ｂ欄1人目 特定扶養親族ボックス', isCheck: true },
  { id: 'dep0Income', name: '扶養1 所得見積額', section: 'dependent', x: 53.0, y: 27.5, fontSize: 10, example: '0', description: 'Ｂ欄1人目所得' },
  { id: 'dep0CheckNonResAge', name: '扶養1 非居住 16~30/70上（✓）', section: 'dependent', x: 55.6, y: 26.3, fontSize: 8, example: '✓', description: '非居住者 16歳以上30歳未満又は70歳以上', isCheck: true },
  { id: 'dep0CheckNonResStudy', name: '扶養1 非居住 留学（✓）', section: 'dependent', x: 55.6, y: 27.3, fontSize: 8, example: '✓', description: '非居住者 留学', isCheck: true },
  { id: 'dep0CheckNonResDisability', name: '扶養1 非居住 障害者（✓）', section: 'dependent', x: 55.6, y: 28.3, fontSize: 8, example: '✓', description: '非居住者 障害者', isCheck: true },
  { id: 'dep0CheckNonResPay', name: '扶養1 非居住 38万円（✓）', section: 'dependent', x: 55.6, y: 29.3, fontSize: 8, example: '✓', description: '非居住者 38万円以上の支払', isCheck: true },
  { id: 'dep0Living', name: '扶養1 同居別居', section: 'dependent', x: 58.5, y: 27.5, fontSize: 9, example: '同居', description: 'Ｂ欄1人目生計一' },
  { id: 'dep0Address', name: '扶養1 住所', section: 'dependent', x: 64.0, y: 27.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄1人目住所' },

  // 2人目
  { id: 'dep1Kana', name: '扶養2 フリガナ', section: 'dependent', x: 16.5, y: 31.0, fontSize: 7, example: 'テスト ハナエ', description: 'Ｂ欄2人目カナ' },
  { id: 'dep1Name', name: '扶養2 氏名', section: 'dependent', x: 16.5, y: 32.5, fontSize: 11, example: 'テスト 花江', description: 'Ｂ欄2人目氏名' },
  { id: 'dep1MyNumber', name: '扶養2 マイナンバー', section: 'dependent', x: 26.5, y: 32.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄2人目12桁マス目' },
  { id: 'dep1Rel', name: '扶養2 続柄', section: 'dependent', x: 34.5, y: 32.5, fontSize: 10, example: '長女', description: 'Ｂ欄2人目続柄' },
  { id: 'dep1EraShowa', name: '扶養2元号 昭（○印）', section: 'dependent', x: 38.6, y: 32.0, fontSize: 7, example: '○', description: 'Ｂ欄2人目「昭」○印', isCircle: true },
  { id: 'dep1EraHeisei', name: '扶養2元号 平（○印）', section: 'dependent', x: 39.4, y: 32.0, fontSize: 7, example: '○', description: 'Ｂ欄2人目「平」○印', isCircle: true },
  { id: 'dep1EraReiwa', name: '扶養2元号 令（○印）', section: 'dependent', x: 39.4, y: 32.9, fontSize: 7, example: '○', description: 'Ｂ欄2人目「令」○印', isCircle: true },
  { id: 'dep1BirthY', name: '扶養2 生年', section: 'dependent', x: 40.5, y: 32.5, fontSize: 10, example: '29', description: 'Ｂ欄2人目生年' },
  { id: 'dep1BirthM', name: '扶養2 生月', section: 'dependent', x: 43.2, y: 32.5, fontSize: 10, example: '8', description: 'Ｂ欄2人目生月' },
  { id: 'dep1BirthD', name: '扶養2 生日', section: 'dependent', x: 45.8, y: 32.5, fontSize: 10, example: '10', description: 'Ｂ欄2人目生日' },
  { id: 'dep1CheckElderlyLiving', name: '扶養2 同居老親等（✓）', section: 'dependent', x: 44.5, y: 31.8, fontSize: 8, example: '✓', description: 'Ｂ欄2人目 同居老親等ボックス', isCheck: true },
  { id: 'dep1CheckElderlyOther', name: '扶養2 その他老人（✓）', section: 'dependent', x: 44.5, y: 33.2, fontSize: 8, example: '✓', description: 'Ｂ欄2人目 その他老人ボックス', isCheck: true },
  { id: 'dep1CheckSpecific', name: '扶養2 特定扶養（✓）', section: 'dependent', x: 44.5, y: 34.5, fontSize: 8, example: '✓', description: 'Ｂ欄2人目 特定扶養親族ボックス', isCheck: true },
  { id: 'dep1Income', name: '扶養2 所得見積額', section: 'dependent', x: 53.0, y: 32.5, fontSize: 10, example: '0', description: 'Ｂ欄2人目所得' },
  { id: 'dep1CheckNonResAge', name: '扶養2 非居住 16~30/70上（✓）', section: 'dependent', x: 55.6, y: 31.3, fontSize: 8, example: '✓', description: '非居住者 16歳以上30歳未満又は70歳以上', isCheck: true },
  { id: 'dep1CheckNonResStudy', name: '扶養2 非居住 留学（✓）', section: 'dependent', x: 55.6, y: 32.3, fontSize: 8, example: '✓', description: '非居住者 留学', isCheck: true },
  { id: 'dep1CheckNonResDisability', name: '扶養2 非居住 障害者（✓）', section: 'dependent', x: 55.6, y: 33.3, fontSize: 8, example: '✓', description: '非居住者 障害者', isCheck: true },
  { id: 'dep1CheckNonResPay', name: '扶養2 非居住 38万円（✓）', section: 'dependent', x: 55.6, y: 34.3, fontSize: 8, example: '✓', description: '非居住者 38万円以上の支払', isCheck: true },
  { id: 'dep1Living', name: '扶養2 同居別居', section: 'dependent', x: 58.5, y: 32.5, fontSize: 9, example: '同居', description: 'Ｂ欄2人目生計一' },
  { id: 'dep1Address', name: '扶養2 住所', section: 'dependent', x: 64.0, y: 32.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄2人目住所' },

  // 3人目
  { id: 'dep2Kana', name: '扶養3 フリガナ', section: 'dependent', x: 16.5, y: 36.0, fontSize: 7, example: 'テスト サブロウ', description: 'Ｂ欄3人目カナ' },
  { id: 'dep2Name', name: '扶養3 氏名', section: 'dependent', x: 16.5, y: 37.5, fontSize: 11, example: 'テスト 三郎', description: 'Ｂ欄3人目氏名' },
  { id: 'dep2MyNumber', name: '扶養3 マイナンバー', section: 'dependent', x: 26.5, y: 37.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄3人目12桁マス目' },
  { id: 'dep2Rel', name: '扶養3 続柄', section: 'dependent', x: 34.5, y: 37.5, fontSize: 10, example: '三男', description: 'Ｂ欄3人目続柄' },
  { id: 'dep2EraShowa', name: '扶養3元号 昭（○印）', section: 'dependent', x: 38.6, y: 37.0, fontSize: 7, example: '○', description: 'Ｂ欄3人目「昭」○印', isCircle: true },
  { id: 'dep2EraHeisei', name: '扶養3元号 平（○印）', section: 'dependent', x: 39.4, y: 37.0, fontSize: 7, example: '○', description: 'Ｂ欄3人目「平」○印', isCircle: true },
  { id: 'dep2EraReiwa', name: '扶養3元号 令（○印）', section: 'dependent', x: 39.4, y: 37.9, fontSize: 7, example: '○', description: 'Ｂ欄3人目「令」○印', isCircle: true },
  { id: 'dep2BirthY', name: '扶養3 生年', section: 'dependent', x: 40.5, y: 37.5, fontSize: 10, example: '31', description: 'Ｂ欄3人目生年' },
  { id: 'dep2BirthM', name: '扶養3 生月', section: 'dependent', x: 43.2, y: 37.5, fontSize: 10, example: '11', description: 'Ｂ欄3人目生月' },
  { id: 'dep2BirthD', name: '扶養3 生日', section: 'dependent', x: 45.8, y: 37.5, fontSize: 10, example: '3', description: 'Ｂ欄3人目生日' },
  { id: 'dep2CheckElderlyLiving', name: '扶養3 同居老親等（✓）', section: 'dependent', x: 44.5, y: 36.8, fontSize: 8, example: '✓', description: 'Ｂ欄3人目 同居老親等ボックス', isCheck: true },
  { id: 'dep2CheckElderlyOther', name: '扶養3 その他老人（✓）', section: 'dependent', x: 44.5, y: 38.2, fontSize: 8, example: '✓', description: 'Ｂ欄3人目 その他老人ボックス', isCheck: true },
  { id: 'dep2CheckSpecific', name: '扶養3 特定扶養（✓）', section: 'dependent', x: 44.5, y: 39.5, fontSize: 8, example: '✓', description: 'Ｂ欄3人目 特定扶養親族ボックス', isCheck: true },
  { id: 'dep2Income', name: '扶養3 所得見積額', section: 'dependent', x: 53.0, y: 37.5, fontSize: 10, example: '0', description: 'Ｂ欄3人目所得' },
  { id: 'dep2CheckNonResAge', name: '扶養3 非居住 16~30/70上（✓）', section: 'dependent', x: 55.6, y: 36.3, fontSize: 8, example: '✓', description: '非居住者 16歳以上30歳未満又は70歳以上', isCheck: true },
  { id: 'dep2CheckNonResStudy', name: '扶養3 非居住 留学（✓）', section: 'dependent', x: 55.6, y: 37.3, fontSize: 8, example: '✓', description: '非居住者 留学', isCheck: true },
  { id: 'dep2CheckNonResDisability', name: '扶養3 非居住 障害者（✓）', section: 'dependent', x: 55.6, y: 38.3, fontSize: 8, example: '✓', description: '非居住者 障害者', isCheck: true },
  { id: 'dep2CheckNonResPay', name: '扶養3 非居住 38万円（✓）', section: 'dependent', x: 55.6, y: 39.3, fontSize: 8, example: '✓', description: '非居住者 38万円以上の支払', isCheck: true },
  { id: 'dep2Living', name: '扶養3 同居別居', section: 'dependent', x: 58.5, y: 37.5, fontSize: 9, example: '同居', description: 'Ｂ欄3人目生計一' },
  { id: 'dep2Address', name: '扶養3 住所', section: 'dependent', x: 64.0, y: 37.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄3人目住所' },

  // 4人目
  { id: 'dep3Kana', name: '扶養4 フリガナ', section: 'dependent', x: 16.5, y: 41.0, fontSize: 7, example: 'テスト シロウ', description: 'Ｂ欄4人目カナ' },
  { id: 'dep3Name', name: '扶養4 氏名', section: 'dependent', x: 16.5, y: 42.5, fontSize: 11, example: 'テスト 四郎', description: 'Ｂ欄4人目氏名' },
  { id: 'dep3MyNumber', name: '扶養4 マイナンバー', section: 'dependent', x: 26.5, y: 42.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄4人目12桁マス目' },
  { id: 'dep3Rel', name: '扶養4 続柄', section: 'dependent', x: 34.5, y: 42.5, fontSize: 10, example: '四男', description: 'Ｂ欄4人目続柄' },
  { id: 'dep3EraShowa', name: '扶養4元号 昭（○印）', section: 'dependent', x: 38.6, y: 42.0, fontSize: 7, example: '○', description: 'Ｂ欄4人目「昭」○印', isCircle: true },
  { id: 'dep3EraHeisei', name: '扶養4元号 平（○印）', section: 'dependent', x: 39.4, y: 42.0, fontSize: 7, example: '○', description: 'Ｂ欄4人目「平」○印', isCircle: true },
  { id: 'dep3EraReiwa', name: '扶養4元号 令（○印）', section: 'dependent', x: 39.4, y: 42.9, fontSize: 7, example: '○', description: 'Ｂ欄4人目「令」○印', isCircle: true },
  { id: 'dep3BirthY', name: '扶養4 生年', section: 'dependent', x: 40.5, y: 42.5, fontSize: 10, example: '2', description: 'Ｂ欄4人目生年' },
  { id: 'dep3BirthM', name: '扶養4 生月', section: 'dependent', x: 43.2, y: 42.5, fontSize: 10, example: '2', description: 'Ｂ欄4人目生月' },
  { id: 'dep3BirthD', name: '扶養4 生日', section: 'dependent', x: 45.8, y: 42.5, fontSize: 10, example: '20', description: 'Ｂ欄4人目生日' },
  { id: 'dep3CheckElderlyLiving', name: '扶養4 同居老親等（✓）', section: 'dependent', x: 44.5, y: 41.8, fontSize: 8, example: '✓', description: 'Ｂ欄4人目 同居老親等ボックス', isCheck: true },
  { id: 'dep3CheckElderlyOther', name: '扶養4 その他老人（✓）', section: 'dependent', x: 44.5, y: 43.2, fontSize: 8, example: '✓', description: 'Ｂ欄4人目 その他老人ボックス', isCheck: true },
  { id: 'dep3CheckSpecific', name: '扶養4 特定扶養（✓）', section: 'dependent', x: 44.5, y: 44.5, fontSize: 8, example: '✓', description: 'Ｂ欄4人目 特定扶養親族ボックス', isCheck: true },
  { id: 'dep3Income', name: '扶養4 所得見積額', section: 'dependent', x: 53.0, y: 42.5, fontSize: 10, example: '0', description: 'Ｂ欄4人目所得' },
  { id: 'dep3CheckNonResAge', name: '扶養4 非居住 16~30/70上（✓）', section: 'dependent', x: 55.6, y: 41.3, fontSize: 8, example: '✓', description: '非居住者 16歳以上30歳未満又は70歳以上', isCheck: true },
  { id: 'dep3CheckNonResStudy', name: '扶養4 非居住 留学（✓）', section: 'dependent', x: 55.6, y: 42.3, fontSize: 8, example: '✓', description: '非居住者 留学', isCheck: true },
  { id: 'dep3CheckNonResDisability', name: '扶養4 非居住 障害者（✓）', section: 'dependent', x: 55.6, y: 43.3, fontSize: 8, example: '✓', description: '非居住者 障害者', isCheck: true },
  { id: 'dep3CheckNonResPay', name: '扶養4 非居住 38万円（✓）', section: 'dependent', x: 55.6, y: 44.3, fontSize: 8, example: '✓', description: '非居住者 38万円以上の支払', isCheck: true },
  { id: 'dep3Living', name: '扶養4 同居別居', section: 'dependent', x: 58.5, y: 42.5, fontSize: 9, example: '同居', description: 'Ｂ欄4人目生計一' },
  { id: 'dep3Address', name: '扶養4 住所', section: 'dependent', x: 64.0, y: 42.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄4人目住所' },

  // ⑤ Ｃ. 障害者等
  { id: 'specialDisabled', name: '障害者チェック（✓）', section: 'special', x: 12.5, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄障害者ボックス', isCheck: true },
  { id: 'specialDisGeneralSelf', name: '一般障害者 本人（✓）', section: 'special', x: 19.8, y: 47.6, fontSize: 8, example: '✓', description: '一般障害者 本人欄', isCheck: true },
  { id: 'specialDisGeneralSpouse', name: '一般障害者 配偶者（✓）', section: 'special', x: 23.5, y: 47.6, fontSize: 8, example: '✓', description: '一般障害者 同一生計配偶者欄', isCheck: true },
  { id: 'specialDisGeneralDepCount', name: '一般障害者 扶養人数', section: 'special', x: 29.0, y: 47.6, fontSize: 8, example: '1', description: '一般障害者 扶養親族人数' },
  { id: 'specialDisSpecialSelf', name: '特別障害者 本人（✓）', section: 'special', x: 19.8, y: 49.3, fontSize: 8, example: '✓', description: '特別障害者 本人欄', isCheck: true },
  { id: 'specialDisSpecialSpouse', name: '特別障害者 配偶者（✓）', section: 'special', x: 23.5, y: 49.3, fontSize: 8, example: '✓', description: '特別障害者 同一生計配偶者欄', isCheck: true },
  { id: 'specialDisSpecialDepCount', name: '特別障害者 扶養人数', section: 'special', x: 29.0, y: 49.3, fontSize: 8, example: '1', description: '特別障害者 扶養親族人数' },
  { id: 'specialDisLivingSpecialSpouse', name: '同居特別障害者 配偶者（✓）', section: 'special', x: 23.5, y: 51.0, fontSize: 8, example: '✓', description: '同居特別障害者 同一生計配偶者欄', isCheck: true },
  { id: 'specialDisLivingSpecialDepCount', name: '同居特別障害者 扶養人数', section: 'special', x: 29.0, y: 51.0, fontSize: 8, example: '1', description: '同居特別障害者 扶養親族人数' },
  
  { id: 'specialWidow', name: '寡婦チェック（✓）', section: 'special', x: 32.2, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄寡婦ボックス', isCheck: true },
  { id: 'specialSingle', name: 'ひとり親チェック（✓）', section: 'special', x: 35.8, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄ひとり親ボックス', isCheck: true },
  { id: 'specialStudent', name: '勤労学生チェック（✓）', section: 'special', x: 40.0, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄勤労学生ボックス', isCheck: true },
  { id: 'specialDetails', name: '障害者・学生の内容', section: 'special', x: 46.5, y: 46.5, fontSize: 9, example: '障害者手帳第1種', description: 'Ｃ欄内容記載枠' },

  // ⑥ 住民税（16歳未満 1人目〜2人目）
  // 1人目
  { id: 'u16_0Kana', name: '住民税1 フリガナ', section: 'resident', x: 16.5, y: 55.5, fontSize: 7, example: 'テスト ジロウ', description: '住民税欄1人目カナ' },
  { id: 'u16_0Name', name: '住民税1 氏名', section: 'resident', x: 16.5, y: 57.0, fontSize: 11, example: 'テスト 次郎', description: '住民税欄1人目氏名' },
  { id: 'u16_0MyNumber', name: '住民税1 マイナンバー', section: 'resident', x: 27.5, y: 57.0, fontSize: 9, pitch: 0.98, example: '************', description: '住民税欄1人目12桁マス目' },
  { id: 'u16_0Rel', name: '住民税1 続柄', section: 'resident', x: 38.5, y: 57.0, fontSize: 10, example: '二男', description: '住民税欄1人目続柄' },
  { id: 'u16_0EraShowa', name: '住民税1元号 昭（○印）', section: 'resident', x: 41.2, y: 56.5, fontSize: 7, example: '○', description: '住民税1人目「昭」○印', isCircle: true },
  { id: 'u16_0EraHeisei', name: '住民税1元号 平（○印）', section: 'resident', x: 41.2, y: 57.5, fontSize: 7, example: '○', description: '住民税1人目「平」○印', isCircle: true },
  { id: 'u16_0EraReiwa', name: '住民税1元号 令（○印）', section: 'resident', x: 41.2, y: 58.5, fontSize: 7, example: '○', description: '住民税1人目「令」○印', isCircle: true },
  { id: 'u16_0BirthY', name: '住民税1 生年', section: 'resident', x: 42.5, y: 57.0, fontSize: 10, example: '30', description: '住民税欄1人目生年' },
  { id: 'u16_0BirthM', name: '住民税1 生月', section: 'resident', x: 44.8, y: 57.0, fontSize: 10, example: '8', description: '住民税欄1人目生月' },
  { id: 'u16_0BirthD', name: '住民税1 生日', section: 'resident', x: 47.2, y: 57.0, fontSize: 10, example: '20', description: '住民税欄1人目生日' },
  { id: 'u16_0Address', name: '住民税1 住所', section: 'resident', x: 53.0, y: 57.0, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: '住民税欄1人目住所' },
  { id: 'u16_0CheckForeign', name: '住民税1 控除対象外国外（✓）', section: 'resident', x: 72.8, y: 57.0, fontSize: 8, example: '✓', description: '住民税1人目 控除対象外国外親族チェック', isCheck: true },
  { id: 'u16_0Income', name: '住民税1 所得見積額', section: 'resident', x: 74.0, y: 57.0, fontSize: 10, example: '0', description: '住民税欄1人目所得' },

  // 2人目
  { id: 'u16_1Kana', name: '住民税2 フリガナ', section: 'resident', x: 16.5, y: 59.5, fontSize: 7, example: 'テスト サチコ', description: '住民税欄2人目カナ' },
  { id: 'u16_1Name', name: '住民税2 氏名', section: 'resident', x: 16.5, y: 61.0, fontSize: 11, example: 'テスト 幸子', description: '住民税欄2人目氏名' },
  { id: 'u16_1MyNumber', name: '住民税2 マイナンバー', section: 'resident', x: 27.5, y: 61.0, fontSize: 9, pitch: 0.98, example: '************', description: '住民税欄2人目12桁マス目' },
  { id: 'u16_1Rel', name: '住民税2 続柄', section: 'resident', x: 38.5, y: 61.0, fontSize: 10, example: '二女', description: '住民税欄2人目続柄' },
  { id: 'u16_1EraShowa', name: '住民税2元号 昭（○印）', section: 'resident', x: 41.2, y: 60.5, fontSize: 7, example: '○', description: '住民税2人目「昭」○印', isCircle: true },
  { id: 'u16_1EraHeisei', name: '住民税2元号 平（○印）', section: 'resident', x: 41.2, y: 61.5, fontSize: 7, example: '○', description: '住民税2人目「平」○印', isCircle: true },
  { id: 'u16_1EraReiwa', name: '住民税2元号 令（○印）', section: 'resident', x: 41.2, y: 62.5, fontSize: 7, example: '○', description: '住民税2人目「令」○印', isCircle: true },
  { id: 'u16_1BirthY', name: '住民税2 生年', section: 'resident', x: 42.5, y: 61.0, fontSize: 10, example: '3', description: '住民税欄2人目生年' },
  { id: 'u16_1BirthM', name: '住民税2 生月', section: 'resident', x: 44.8, y: 61.0, fontSize: 10, example: '12', description: '住民税欄2人目生月' },
  { id: 'u16_1BirthD', name: '住民税2 生日', section: 'resident', x: 47.2, y: 61.0, fontSize: 10, example: '5', description: '住民税欄2人目生日' },
  { id: 'u16_1Address', name: '住民税2 住所', section: 'resident', x: 53.0, y: 61.0, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: '住民税欄2人目住所' },
  { id: 'u16_1CheckForeign', name: '住民税2 控除対象外国外（✓）', section: 'resident', x: 72.8, y: 61.0, fontSize: 8, example: '✓', description: '住民税2人目 控除対象外国外親族チェック', isCheck: true },
  { id: 'u16_1Income', name: '住民税2 所得見積額', section: 'resident', x: 74.0, y: 61.0, fontSize: 10, example: '0', description: '住民税欄2人目所得' },

  // ⑦ 退職手当等を有する配偶者・扶養親族（最下段新設欄）
  { id: 'retSpouseCheck', name: '退職手当 配偶者（✓）', section: 'retirement', x: 58.5, y: 66.5, fontSize: 8, example: '✓', description: '最下段 配偶者チェックボックス', isCheck: true },
  { id: 'retDepCheck', name: '退職手当 扶養親族（✓）', section: 'retirement', x: 58.5, y: 68.0, fontSize: 8, example: '✓', description: '最下段 扶養親族チェックボックス', isCheck: true }
];

export const TAX_DOC_DEFAULT_MAP = new Map<string, TaxDocFieldConfig>(
  DEFAULT_TAX_FIELDS.map(f => [f.id, f])
);
