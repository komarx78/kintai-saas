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
  employmentRate: number;  // 雇用保険料率 (本人負担 デフォルト 0.005 または 0.006)
  childRearingRate: number;// 子ども・子育て拠出金 (会社負担 0.36%)
}

/**
 * 厚生労働省公式 雇用保険料率（令和8年度最新・令和7年度対比）
 */
export type EmploymentInsuranceBusinessType = 'general' | 'agriculture' | 'construction' | 'custom';

export interface EmploymentInsuranceSetting {
  businessType: EmploymentInsuranceBusinessType;
  name: string;
  workerRate: number;    // 労働者負担率 (例: 0.005)
  employerRate: number;  // 事業主負担率 (例: 0.0085)
  totalRate: number;     // 合計料率 (例: 0.0135)
  description: string;
}

// 令和8年度（2026年4月〜2027年3月）公式料率
export const EMPLOYMENT_INSURANCE_RATES_R8: Record<EmploymentInsuranceBusinessType, EmploymentInsuranceSetting> = {
  general: {
    businessType: 'general',
    name: '一般の事業',
    workerRate: 0.005, // 5/1,000
    employerRate: 0.0085, // 8.5/1,000
    totalRate: 0.0135, // 13.5/1,000
    description: '一般企業・IT・サービス・小売・製造等（労働者: 5/1,000 / 事業主: 8.5/1,000）'
  },
  agriculture: {
    businessType: 'agriculture',
    name: '農林水産・清酒製造の事業',
    workerRate: 0.006, // 6/1,000
    employerRate: 0.0095, // 9.5/1,000
    totalRate: 0.0155, // 15.5/1,000
    description: '農業・林業・水産業・清酒製造等（労働者: 6/1,000 / 事業主: 9.5/1,000）'
  },
  construction: {
    businessType: 'construction',
    name: '建設の事業',
    workerRate: 0.006, // 6/1,000
    employerRate: 0.0105, // 10.5/1,000
    totalRate: 0.0165, // 16.5/1,000
    description: '土木・建築・建設工事業等（労働者: 6/1,000 / 事業主: 10.5/1,000）'
  },
  custom: {
    businessType: 'custom',
    name: 'カスタム設定（任意料率入力）',
    workerRate: 0.005,
    employerRate: 0.0085,
    totalRate: 0.0135,
    description: '任意の料率をパーセントまたは千分率で手動設定'
  }
};

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
  monthlySalary: number; // 雇用保険料算出用の当月実総支給額
  standardRemunerationBase?: number | null; // 健康保険・厚生年金の未設定時判定用・固定的賃金（指定があれば優先、なければmonthlySalary）
  healthStandardRemuneration?: number | null;
  pensionStandardRemuneration?: number | null;
  prefectureCode?: string;
  birthDate?: string | Date | null;
  targetDate?: string | Date;
  isHealthEnabled: boolean;
  isPensionEnabled: boolean;
  isEmploymentEnabled: boolean;
  employmentRate?: number; // 会社設定の雇用保険料率（指定があれば優先、なければデフォルト）
  isNursingManualOverride?: boolean | null; // 手動で介護保険を強制ON/OFFする場合
}) {
  const {
    monthlySalary,
    standardRemunerationBase,
    healthStandardRemuneration,
    pensionStandardRemuneration,
    prefectureCode,
    birthDate,
    targetDate,
    isHealthEnabled,
    isPensionEnabled,
    isEmploymentEnabled,
    employmentRate,
    isNursingManualOverride,
  } = params;

  const pref = getPrefectureRate(prefectureCode);

  // 🛡️ 標準報酬月額の判定基礎額（固定的賃金がある場合は残業等の変動支給に惑わされず固定判定）
  const fallbackRemuneration = (standardRemunerationBase !== undefined && standardRemunerationBase !== null && standardRemunerationBase > 0)
    ? standardRemunerationBase
    : monthlySalary;

  // 標準報酬月額の引当（指定があればそれを使用、なければ固定的報酬月額から判定）
  const healthBase = (healthStandardRemuneration && healthStandardRemuneration > 0)
    ? healthStandardRemuneration
    : lookupStandardMonthlyRemuneration(fallbackRemuneration, 'health');

  const pensionBase = (pensionStandardRemuneration && pensionStandardRemuneration > 0)
    ? pensionStandardRemuneration
    : lookupStandardMonthlyRemuneration(fallbackRemuneration, 'pension');

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

  // 雇用保険料（本人負担 ＝ 実際の総支給額 × 雇用保険料率、50銭以下切り捨て・50銭超切り上げ）
  const activeEmpRate = employmentRate !== undefined ? employmentRate : pref.employmentRate;
  const employmentInsurance = isEmploymentEnabled
    ? roundHalf(monthlySalary * activeEmpRate)
    : 0;

  return {
    healthBase,
    pensionBase,
    isNursing,
    prefectureName: pref.name,
    healthRate: pref.healthRate,
    nursingRate: pref.nursingRate,
    pensionRate: pref.pensionRate,
    employmentRate: activeEmpRate,
    healthInsurance,
    nursingInsurance,
    pensionInsurance,
    employmentInsurance,
    totalSocialInsurance: healthInsurance + nursingInsurance + pensionInsurance + employmentInsurance,
  };
}

/**
 * 🛡️ 退職月における社会保険料（健康保険・厚生年金）の控除月数判定
 * （健康保険法第156条・厚生年金保険法第19条 厳格準拠）
 */
export interface RetirementSocialInsuranceResult {
  retirementDate: string;
  lossDate: string;
  lossMonth: string;
  isEndOfMonth: boolean;
  isSameMonthGainLoss: boolean;
  deductionMonthsCount: number;
  explanation: string;
}

export function determineRetirementSocialInsuranceMonths(
  joinDateStr?: string | null,
  retirementDateStr?: string | null,
  isLastPayrollInRetirementMonth: boolean = true
): RetirementSocialInsuranceResult | null {
  if (!retirementDateStr) return null;
  const retDate = new Date(retirementDateStr);
  if (isNaN(retDate.getTime())) return null;

  // 資格喪失日 = 退職日の翌日
  const lossDate = new Date(retDate);
  lossDate.setDate(lossDate.getDate() + 1);

  const lossYear = lossDate.getFullYear();
  const lossMonthNum = lossDate.getMonth() + 1;
  const lossMonth = `${lossYear}-${String(lossMonthNum).padStart(2, '0')}`;

  const lastDayOfMonth = new Date(retDate.getFullYear(), retDate.getMonth() + 1, 0).getDate();
  const isEndOfMonth = retDate.getDate() === lastDayOfMonth;

  let isSameMonthGainLoss = false;
  if (joinDateStr) {
    const jDate = new Date(joinDateStr);
    if (!isNaN(jDate.getTime())) {
      isSameMonthGainLoss = jDate.getFullYear() === retDate.getFullYear() && jDate.getMonth() === retDate.getMonth();
    }
  }

  let deductionMonthsCount = 1;
  let explanation = '';

  if (isSameMonthGainLoss) {
    deductionMonthsCount = 1;
    explanation = '同月得喪（同月内の入社・退職）のため、健康保険法第156条により当月分（1ヶ月分）の保険料を徴収します。';
  } else if (isEndOfMonth) {
    if (isLastPayrollInRetirementMonth) {
      deductionMonthsCount = 2;
      explanation = '月末退職のため資格喪失日は翌月1日となります。退職月分の保険料納入義務が生じるため、当月給与において「前月分」と「当月分」の【2ヶ月分】を一括控除します（健保法第156条・厚年法第19条）。';
    } else {
      deductionMonthsCount = 1;
      explanation = '月末退職のため資格喪失日は翌月1日となります。翌月支給の最終給与にて退職月分を控除するため、当月は1ヶ月分を控除します。';
    }
  } else {
    deductionMonthsCount = 1;
    explanation = '月途中（月末の前日以前）の退職のため、資格喪失月は当月となり、当月分の社会保険料は法律上免除されます。当月給与では前月分（1ヶ月分）のみを徴収し、退職月分の徴収は行いません。';
  }

  return {
    retirementDate: retirementDateStr,
    lossDate: lossDate.toISOString().split('T')[0],
    lossMonth,
    isEndOfMonth,
    isSameMonthGainLoss,
    deductionMonthsCount,
    explanation
  };
}

/**
 * 🛡️ 算定基礎届（定時決定）における対象月抽出と新標準報酬月額の決定
 * （健康保険法第41条・厚生年金保険法第21条 厳格準拠）
 */
export interface SanteiMonthRecord {
  month: 4 | 5 | 6;
  baseDays: number;
  totalWage: number;
  isShortTime?: boolean;
}

export interface SanteiResult {
  validMonths: number[];
  excludedMonths: number[];
  averageWage: number;
  newHealthRemuneration: number;
  newPensionRemuneration: number;
  notes: string;
}

export function calculateSanteiKisoRemuneration(
  records: SanteiMonthRecord[],
  isShortTimeWorker: boolean = false
): SanteiResult {
  const thresholdDays = isShortTimeWorker ? 11 : 17;
  const validMonths: number[] = [];
  const excludedMonths: number[] = [];
  let totalWageSum = 0;

  records.forEach(r => {
    if (r.baseDays >= thresholdDays) {
      validMonths.push(r.month);
      totalWageSum += r.totalWage;
    } else {
      excludedMonths.push(r.month);
    }
  });

  let averageWage = 0;
  let notes = '';

  if (validMonths.length > 0) {
    averageWage = Math.round(totalWageSum / validMonths.length);
    notes = `${validMonths.join('月・')}月の${validMonths.length}ヶ月平均（基準日数${thresholdDays}日以上）で算定。`;
    if (excludedMonths.length > 0) {
      notes += `（${excludedMonths.join('月・')}月は支払基礎日数不足のため除外）`;
    }
  } else {
    const validPart = records.filter(r => r.baseDays >= 11);
    if (validPart.length > 0) {
      const sum = validPart.reduce((acc, c) => acc + c.totalWage, 0);
      averageWage = Math.round(sum / validPart.length);
      validMonths.push(...validPart.map(r => r.month));
      notes = `短時間労働者特例（11日以上）を適用し、${validMonths.join('月・')}月の平均で算定。`;
    } else {
      const sum = records.reduce((acc, c) => acc + c.totalWage, 0);
      averageWage = records.length > 0 ? Math.round(sum / records.length) : 0;
      notes = '全月の支払基礎日数が基準未満のため、全実績の平均で算定（年金事務所確認要）。';
    }
  }

  const newHealthRemuneration = lookupStandardMonthlyRemuneration(averageWage, 'health');
  const newPensionRemuneration = lookupStandardMonthlyRemuneration(averageWage, 'pension');

  return {
    validMonths,
    excludedMonths,
    averageWage,
    newHealthRemuneration,
    newPensionRemuneration,
    notes
  };
}

/**
 * 🛡️ 随時改定（月額変更届）該当判定
 * （健康保険法第43条・厚生年金保険法第23条 厳格準拠）
 */
export interface MonthlyRevisionCheckParams {
  currentHealthStandard: number;
  currentPensionStandard: number;
  consecutiveMonths: {
    baseDays: number;
    totalWage: number;
  }[];
  fixedWageChangeType: 'increase' | 'decrease';
  isShortTimeWorker?: boolean;
}

export interface MonthlyRevisionResult {
  isEligible: boolean; // 健康保険または厚生年金のいずれかが随時改定該当
  isHealthEligible: boolean; // 健康保険が随時改定該当
  isPensionEligible: boolean; // 厚生年金が随時改定該当
  averageWage: number;
  newHealthStandard: number;
  newPensionStandard: number;
  healthGradeDiff: number;
  pensionGradeDiff: number;
  reason: string;
}

export function checkMonthlyRevisionEligibility(params: MonthlyRevisionCheckParams): MonthlyRevisionResult {
  const { currentHealthStandard, currentPensionStandard, consecutiveMonths, fixedWageChangeType, isShortTimeWorker } = params;
  const thresholdDays = isShortTimeWorker ? 11 : 17;

  if (consecutiveMonths.length < 3) {
    return {
      isEligible: false,
      isHealthEligible: false,
      isPensionEligible: false,
      averageWage: 0,
      newHealthStandard: currentHealthStandard,
      newPensionStandard: currentPensionStandard,
      healthGradeDiff: 0,
      pensionGradeDiff: 0,
      reason: '3ヶ月分の実績データが不足しています。'
    };
  }

  const allDaysValid = consecutiveMonths.every(m => m.baseDays >= thresholdDays);
  if (!allDaysValid) {
    return {
      isEligible: false,
      isHealthEligible: false,
      isPensionEligible: false,
      averageWage: 0,
      newHealthStandard: currentHealthStandard,
      newPensionStandard: currentPensionStandard,
      healthGradeDiff: 0,
      pensionGradeDiff: 0,
      reason: `変動後3ヶ月の中に支払基礎日数不足（${thresholdDays}日未満）の月があるため、随時改定の対象外です。`
    };
  }

  const sum = consecutiveMonths.reduce((acc, m) => acc + m.totalWage, 0);
  const averageWage = Math.round(sum / 3);

  const newHealthStandard = lookupStandardMonthlyRemuneration(averageWage, 'health');
  const newPensionStandard = lookupStandardMonthlyRemuneration(averageWage, 'pension');

  const curHealthRowIndex = HEALTH_REMUNERATION_TABLE.findIndex(r => r.standard === currentHealthStandard);
  const newHealthRowIndex = HEALTH_REMUNERATION_TABLE.findIndex(r => r.standard === newHealthStandard);
  const curHealthGrade = curHealthRowIndex !== -1 ? HEALTH_REMUNERATION_TABLE[curHealthRowIndex].grade : 1;
  const newHealthGrade = newHealthRowIndex !== -1 ? HEALTH_REMUNERATION_TABLE[newHealthRowIndex].grade : 1;
  const healthGradeDiff = Math.abs(newHealthGrade - curHealthGrade);

  // 厚生年金等級（1〜32等級: 健保4等級=厚年1等級、健保35等級=厚年32等級）
  const curPensionGrade = Math.max(1, Math.min(32, curHealthGrade - 3));
  const newPensionGrade = Math.max(1, Math.min(32, newHealthGrade - 3));
  const pensionGradeDiff = Math.abs(newPensionGrade - curPensionGrade);

  const isHealthGradeEligible = healthGradeDiff >= 2;
  const isPensionGradeEligible = pensionGradeDiff >= 2;

  let isHealthDirectionMatching = true;
  if (fixedWageChangeType === 'increase' && newHealthStandard < currentHealthStandard) {
    isHealthDirectionMatching = false;
  } else if (fixedWageChangeType === 'decrease' && newHealthStandard > currentHealthStandard) {
    isHealthDirectionMatching = false;
  }

  let isPensionDirectionMatching = true;
  if (fixedWageChangeType === 'increase' && newPensionStandard < currentPensionStandard) {
    isPensionDirectionMatching = false;
  } else if (fixedWageChangeType === 'decrease' && newPensionStandard > currentPensionStandard) {
    isPensionDirectionMatching = false;
  }

  const isHealthEligible = isHealthGradeEligible && isHealthDirectionMatching;
  const isPensionEligible = isPensionGradeEligible && isPensionDirectionMatching;
  const isEligible = isHealthEligible || isPensionEligible;

  let reason = '';
  if (isHealthEligible && isPensionEligible) {
    reason = `固定的賃金の${fixedWageChangeType === 'increase' ? '昇給' : '降給'}に伴い、健康保険（${healthGradeDiff}等級差）および厚生年金（${pensionGradeDiff}等級差）ともに随時改定の届出が必要です。`;
  } else if (isHealthEligible && !isPensionEligible) {
    reason = `健康保険のみ${healthGradeDiff}等級変動し随時改定の対象です（厚生年金は${pensionGradeDiff}等級差のため対象外）。`;
  } else if (!isHealthEligible && isPensionEligible) {
    reason = `厚生年金のみ${pensionGradeDiff}等級変動し随時改定の対象です（健康保険は${healthGradeDiff}等級差のため対象外）。`;
  } else if (!isHealthDirectionMatching) {
    reason = `固定的賃金は${fixedWageChangeType === 'increase' ? '昇給' : '降給'}していますが、残業等の減少により総支給額が逆方向に変動しているため、随時改定の対象外です（昭和33年保発第66号）。`;
  } else {
    reason = `変動後の標準報酬月額の差が健康保険${healthGradeDiff}等級・厚生年金${pensionGradeDiff}等級であり、法定要件である「2等級以上の差」に達していないため、随時改定の対象外です。`;
  }

  return {
    isEligible,
    isHealthEligible,
    isPensionEligible,
    averageWage,
    newHealthStandard,
    newPensionStandard,
    healthGradeDiff,
    pensionGradeDiff,
    reason
  };
}
