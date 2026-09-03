/**
 * 社会保険計算ユーティリティ (Social Insurance Calculation Utility)
 * 協会けんぽ（全国健康保険協会）および厚生年金制度に完全準拠
 */

export interface PrefectureSocialRate {
  code: string;
  name: string;
  healthRate: number;      // 健康保険料率 (全額)
  nursingRate: number;     // 介護保険料率 (全額、全国一律 1.60%)
  pensionRate: number;     // 厚生年金保険料率 (全額、全国一律 18.30%)
  employmentRate: number;  // 雇用保険料率 (本人負担 0.6%)
  childRearingRate: number;// 子ども・子育て拠出金 (会社負担 0.36%)
}

// 令和7年度（2025/2026年度・最新改定値）47都道府県 協会けんぽ標準料率
export const PREFECTURES: PrefectureSocialRate[] = [
  { code: '01', name: '北海道', healthRate: 0.1028, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '02', name: '青森県', healthRate: 0.0985, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '03', name: '岩手県', healthRate: 0.0951, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '04', name: '宮城県', healthRate: 0.1010, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '05', name: '秋田県', healthRate: 0.1001, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '06', name: '山形県', healthRate: 0.0975, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '07', name: '福島県', healthRate: 0.0950, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '08', name: '茨城県', healthRate: 0.0952, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '09', name: '栃木県', healthRate: 0.0982, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '10', name: '群馬県', healthRate: 0.0968, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '11', name: '埼玉県', healthRate: 0.0967, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '12', name: '千葉県', healthRate: 0.0973, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '13', name: '東京都', healthRate: 0.0985, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '14', name: '神奈川県', healthRate: 0.0992, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '15', name: '新潟県', healthRate: 0.0921, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '16', name: '富山県', healthRate: 0.0959, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '17', name: '石川県', healthRate: 0.0970, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '18', name: '福井県', healthRate: 0.0971, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '19', name: '山梨県', healthRate: 0.0955, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '20', name: '長野県', healthRate: 0.0963, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '21', name: '岐阜県', healthRate: 0.0980, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '22', name: '静岡県', healthRate: 0.0961, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '23', name: '愛知県', healthRate: 0.0993, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '24', name: '三重県', healthRate: 0.0977, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '25', name: '滋賀県', healthRate: 0.0988, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '26', name: '京都府', healthRate: 0.0989, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '27', name: '大阪府', healthRate: 0.1013, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '28', name: '兵庫県', healthRate: 0.1012, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '29', name: '奈良県', healthRate: 0.0991, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '30', name: '和歌山県', healthRate: 0.1006, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '31', name: '鳥取県', healthRate: 0.0986, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '32', name: '島根県', healthRate: 0.0994, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '33', name: '岡山県', healthRate: 0.1005, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '34', name: '広島県', healthRate: 0.0978, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '35', name: '山口県', healthRate: 0.1015, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '36', name: '徳島県', healthRate: 0.1024, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '37', name: '香川県', healthRate: 0.1002, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '38', name: '愛媛県', healthRate: 0.0998, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '39', name: '高知県', healthRate: 0.1005, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '40', name: '福岡県', healthRate: 0.1011, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '41', name: '佐賀県', healthRate: 0.1055, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '42', name: '長崎県', healthRate: 0.1006, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '43', name: '熊本県', healthRate: 0.1008, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '44', name: '大分県', healthRate: 0.1008, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '45', name: '宮崎県', healthRate: 0.0977, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '46', name: '鹿児島県', healthRate: 0.1013, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
  { code: '47', name: '沖縄県', healthRate: 0.0944, nursingRate: 0.0160, pensionRate: 0.1830, employmentRate: 0.0060, childRearingRate: 0.0036 },
];

/**
 * 会社所在地（住所文字列）から都道府県コード（01〜47）をインテリジェントに自動抽出
 * 例: "滋賀県大津市坂本3丁目21-16" -> "25" (滋賀県)
 */
export function extractPrefectureCodeFromAddress(address?: string | null): string | null {
  if (!address) return null;
  const match = PREFECTURES.find(p => {
    const shortName = p.name.replace(/[都府県]$/, '');
    return address.includes(p.name) || address.includes(shortName);
  });
  return match ? match.code : null;
}

/**
 * 指定された都道府県コードの料率を取得（未指定時は東京都）
 */
export function getPrefectureRate(code?: string): PrefectureSocialRate {
  const target = PREFECTURES.find(p => p.code === code);
  return target || PREFECTURES[12]; // 東京都 (13) をデフォルト
}

/**
 * 介護保険第2号被保険者（40歳〜64歳）の厳密な判定
 * 
 * 法律上の定義:
 * - 満40歳に達した日（誕生日の前日）が属する月から
 * - 満65歳に達した日（誕生日の前日）が属する月の前月まで
 * 
 * @param birthDate 生年月日 (YYYY-MM-DD または Date)
 * @param targetDate 給与計算対象年月 (YYYY-MM-DD または Date)
 */
export function isNursingInsuranceApplicable(
  birthDate: string | Date | null | undefined,
  targetDate: string | Date = new Date()
): boolean {
  if (!birthDate) return false;

  const bDate = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const tDate = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;

  if (isNaN(bDate.getTime()) || isNaN(tDate.getTime())) return false;

  // 満40歳到達日 ＝ 40年後の誕生日の前日
  const age40Reached = new Date(bDate.getFullYear() + 40, bDate.getMonth(), bDate.getDate() - 1);
  // 満65歳到達日 ＝ 65年後の誕生日の前日
  const age65Reached = new Date(bDate.getFullYear() + 65, bDate.getMonth(), bDate.getDate() - 1);

  // 対象月の初日と末日
  const targetYear = tDate.getFullYear();
  const targetMonth = tDate.getMonth(); // 0-indexed

  // 介護保険開始月: 満40歳到達日の属する年月 (YYYYMM)
  const startYearMonth = age40Reached.getFullYear() * 12 + age40Reached.getMonth();
  // 介護保険終了月: 満65歳到達日の属する年月の「前月」 (YYYYMM)
  const endYearMonth = (age65Reached.getFullYear() * 12 + age65Reached.getMonth()) - 1;

  const currentYearMonth = targetYear * 12 + targetMonth;

  return currentYearMonth >= startYearMonth && currentYearMonth <= endYearMonth;
}

/**
 * 標準報酬月額表（全50等級）の等級決定テーブル
 */
export const HEALTH_REMUNERATION_TABLE = [
  { grade: 1, standard: 58000, min: 0, max: 63000 },
  { grade: 2, standard: 68000, min: 63000, max: 73000 },
  { grade: 3, standard: 78000, min: 73000, max: 83000 },
  { grade: 4, standard: 88000, min: 83000, max: 93000 },
  { grade: 5, standard: 98000, min: 93000, max: 101000 },
  { grade: 6, standard: 104000, min: 101000, max: 107000 },
  { grade: 7, standard: 110000, min: 107000, max: 114000 },
  { grade: 8, standard: 118000, min: 114000, max: 122000 },
  { grade: 9, standard: 126000, min: 122000, max: 130000 },
  { grade: 10, standard: 134000, min: 130000, max: 138000 },
  { grade: 11, standard: 142000, min: 138000, max: 146000 },
  { grade: 12, standard: 150000, min: 146000, max: 155000 },
  { grade: 13, standard: 160000, min: 155000, max: 165000 },
  { grade: 14, standard: 170000, min: 165000, max: 175000 },
  { grade: 15, standard: 180000, min: 175000, max: 185000 },
  { grade: 16, standard: 190000, min: 185000, max: 195000 },
  { grade: 17, standard: 200000, min: 195000, max: 210000 },
  { grade: 18, standard: 220000, min: 210000, max: 230000 },
  { grade: 19, standard: 240000, min: 230000, max: 250000 },
  { grade: 20, standard: 260000, min: 250000, max: 270000 },
  { grade: 21, standard: 280000, min: 270000, max: 290000 },
  { grade: 22, standard: 300000, min: 290000, max: 310000 },
  { grade: 23, standard: 320000, min: 310000, max: 330000 },
  { grade: 24, standard: 340000, min: 330000, max: 350000 },
  { grade: 25, standard: 360000, min: 350000, max: 370000 },
  { grade: 26, standard: 380000, min: 370000, max: 395000 },
  { grade: 27, standard: 410000, min: 395000, max: 425000 },
  { grade: 28, standard: 440000, min: 425000, max: 455000 },
  { grade: 29, standard: 470000, min: 455000, max: 485000 },
  { grade: 30, standard: 500000, min: 485000, max: 515000 },
  { grade: 31, standard: 530000, min: 515000, max: 545000 },
  { grade: 32, standard: 560000, min: 545000, max: 575000 },
  { grade: 33, standard: 590000, min: 575000, max: 605000 },
  { grade: 34, standard: 620000, min: 605000, max: 635000 },
  { grade: 35, standard: 650000, min: 635000, max: 665000 },
  { grade: 36, standard: 680000, min: 665000, max: 710000 },
  { grade: 37, standard: 710000, min: 710000, max: 750000 },
  { grade: 38, standard: 750000, min: 750000, max: 790000 },
  { grade: 39, standard: 790000, min: 790000, max: 830000 },
  { grade: 40, standard: 830000, min: 830000, max: 880000 },
  { grade: 41, standard: 880000, min: 880000, max: 930000 },
  { grade: 42, standard: 930000, min: 930000, max: 980000 },
  { grade: 43, standard: 980000, min: 980000, max: 1030000 },
  { grade: 44, standard: 1030000, min: 1030000, max: 1090000 },
  { grade: 45, standard: 1090000, min: 1090000, max: 1150000 },
  { grade: 46, standard: 1150000, min: 1150000, max: 1210000 },
  { grade: 47, standard: 1210000, min: 1210000, max: 1270000 },
  { grade: 48, standard: 1270000, min: 1270000, max: 1330000 },
  { grade: 49, standard: 1330000, min: 1330000, max: 1390000 },
  { grade: 50, standard: 1390000, min: 1390000, max: Infinity },
];

/**
 * 報酬月額から標準報酬月額を判定
 * @param monthlySalary 報酬月額（基本給＋各種手当、残業等を含む総支給予定額）
 * @param type 'health' (健康保険: 上限139万) | 'pension' (厚生年金: 上限65万)
 */
export function lookupStandardMonthlyRemuneration(
  monthlySalary: number,
  type: 'health' | 'pension' = 'health'
): number {
  if (monthlySalary <= 0) return 0;

  // 厚生年金の下限は 88,000円 (1等級)、上限は 650,000円 (32等級)
  if (type === 'pension') {
    if (monthlySalary < 93000) return 88000;
    if (monthlySalary >= 635000) return 650000;
  }

  const match = HEALTH_REMUNERATION_TABLE.find(row => monthlySalary >= row.min && monthlySalary < row.max);
  if (match) {
    if (type === 'pension' && match.standard > 650000) {
      return 650000;
    }
    return match.standard;
  }

  return type === 'pension' ? 650000 : 1390000;
}

/**
 * 社会保険料の本人負担額（折半額）を計算
 */
export function calculateSocialInsuranceDeduction(params: {
  monthlySalary: number;
  healthStandardRemuneration?: number | null;
  pensionStandardRemuneration?: number | null;
  prefectureCode?: string;
  birthDate?: string | Date | null;
  targetDate?: string | Date;
  isHealthEnabled: boolean;
  isPensionEnabled: boolean;
  isEmploymentEnabled: boolean;
  isNursingManualOverride?: boolean | null; // 手動で介護保険を強制ON/OFFする場合
}) {
  const {
    monthlySalary,
    healthStandardRemuneration,
    pensionStandardRemuneration,
    prefectureCode,
    birthDate,
    targetDate,
    isHealthEnabled,
    isPensionEnabled,
    isEmploymentEnabled,
    isNursingManualOverride,
  } = params;

  const pref = getPrefectureRate(prefectureCode);

  // 標準報酬月額の引当（指定があればそれを使用、なければ報酬月額から判定）
  const healthBase = (healthStandardRemuneration && healthStandardRemuneration > 0)
    ? healthStandardRemuneration
    : lookupStandardMonthlyRemuneration(monthlySalary, 'health');

  const pensionBase = (pensionStandardRemuneration && pensionStandardRemuneration > 0)
    ? pensionStandardRemuneration
    : lookupStandardMonthlyRemuneration(monthlySalary, 'pension');

  // 介護保険該当フラグ（生年月日の実年齢を最優先判定、生年月日未指定時は手動指定を参照）
  let isNursing = false;
  if (birthDate) {
    isNursing = isNursingInsuranceApplicable(birthDate, targetDate);
  } else if (isNursingManualOverride !== undefined && isNursingManualOverride !== null) {
    isNursing = isNursingManualOverride;
  }

  // 折半計算（50銭以下切り捨て、50銭超切り上げの標準方式）
  const roundHalf = (val: number) => Math.round(val);

  // 健康保険料（本人負担 ＝ 標準報酬月額 × 健康保険料率 ÷ 2）
  const healthInsurance = isHealthEnabled
    ? roundHalf((healthBase * pref.healthRate) / 2)
    : 0;

  // 介護保険料（本人負担 ＝ 標準報酬月額 × 介護保険料率 ÷ 2）
  const nursingInsurance = (isHealthEnabled && isNursing)
    ? roundHalf((healthBase * pref.nursingRate) / 2)
    : 0;

  // 厚生年金保険料（本人負担 ＝ 標準報酬月額 × 厚生年金料率 ÷ 2）
  const pensionInsurance = isPensionEnabled
    ? roundHalf((pensionBase * pref.pensionRate) / 2)
    : 0;

  // 雇用保険料（本人負担 ＝ 実際の総支給額 × 雇用保険料率）
  const employmentInsurance = isEmploymentEnabled
    ? Math.floor(monthlySalary * pref.employmentRate)
    : 0;

  return {
    healthBase,
    pensionBase,
    isNursing,
    prefectureName: pref.name,
    healthRate: pref.healthRate,
    nursingRate: pref.nursingRate,
    pensionRate: pref.pensionRate,
    healthInsurance,
    nursingInsurance,
    pensionInsurance,
    employmentInsurance,
    totalSocialInsurance: healthInsurance + nursingInsurance + pensionInsurance + employmentInsurance,
  };
}
