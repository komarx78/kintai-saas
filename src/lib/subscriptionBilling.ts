/**
 * SaaS サブスクリプション料金計算エンジン (Subscription Billing Engine)
 * 
 * 複数の課金モデル（1人単価制、基本料+従量、基本枠+超過、固定月額）に完全対応し、
 * DBのマスタ設定（system_settings または tenants）から取得した設定値に基づいて動的計算します。
 */

export type BillingModelType = 'per_user' | 'base_plus_user' | 'tier_included' | 'flat_rate';

export interface BillingMasterConfig {
  billing_model?: BillingModelType | string;
  unit_price_per_user?: number; // 1人あたり月額単価 (デフォルト: 300円)
  unit_price_per_user_annual?: number; // 1人あたり年額単価 (デフォルト: 3600円)
  base_fee?: number; // 基本料金 (月額)
  base_fee_annual?: number; // 基本料金 (年額)
  included_users?: number; // 基本枠に含まれる人数 (例: 5名)
  flat_monthly_price?: number; // 月額固定プラン料金
  flat_annual_price?: number; // 年額固定プラン料金
  billing_cycle?: 'monthly' | 'annual' | string;
}

export interface CalculatedSubscriptionResult {
  totalFee: number;
  breakdownText: string;
  modelName: string;
  unitPrice: number;
  activeUsers: number;
}

export const BILLING_MODELS: { id: BillingModelType; name: string; description: string }[] = [
  { id: 'per_user', name: 'シンプル1人単価制（標準）', description: '在籍人数 × 単価（例: 300円/月）' },
  { id: 'base_plus_user', name: '基本料金 ＋ 1人単価制', description: '基本料金 ＋（在籍人数 × 単価）' },
  { id: 'tier_included', name: '基本枠 ＋ 超過従量制', description: '基本枠料金（◯名まで）＋ 超過人数 × 単価' },
  { id: 'flat_rate', name: '全社定額制（月額固定）', description: '人数に関わらず固定月額料金' }
];

export const DEFAULT_BILLING_CONFIG: BillingMasterConfig = {
  billing_model: 'per_user',
  unit_price_per_user: 300, // 規定単価: 300円
  unit_price_per_user_annual: 3600, // 年額: 3,600円
  base_fee: 0,
  base_fee_annual: 0,
  included_users: 0,
  flat_monthly_price: 15000,
  flat_annual_price: 150000,
  billing_cycle: 'monthly'
};

/**
 * 在籍人数とマスタ設定に基づき、正確な利用料金および計算内訳を算出
 */
export function calculateSubscriptionFee(
  activeUserCount: number,
  config?: BillingMasterConfig | null
): CalculatedSubscriptionResult {
  const count = Math.max(0, activeUserCount);
  const cfg = { ...DEFAULT_BILLING_CONFIG, ...(config || {}) };
  const isAnnual = cfg.billing_cycle === 'annual';
  const model = (cfg.billing_model as BillingModelType) || 'per_user';

  // 1人あたり単価（未設定時は300円/3600円を保証）
  const unitPrice = isAnnual 
    ? (cfg.unit_price_per_user_annual ?? (cfg.unit_price_per_user ? cfg.unit_price_per_user * 12 : 3600))
    : (cfg.unit_price_per_user ?? 300);

  let totalFee = 0;
  let breakdownText = '';
  let modelName = 'シンプル1人単価制';

  switch (model) {
    case 'per_user': {
      modelName = 'シンプル1人単価制';
      totalFee = count * unitPrice;
      breakdownText = isAnnual 
        ? `${count}名 × ¥${unitPrice.toLocaleString()}/年`
        : `${count}名 × ¥${unitPrice.toLocaleString()}/月`;
      break;
    }

    case 'base_plus_user': {
      modelName = '基本料金 ＋ 1人単価制';
      const base = isAnnual ? (cfg.base_fee_annual ?? (cfg.base_fee ? cfg.base_fee * 12 : 0)) : (cfg.base_fee ?? 0);
      const userPart = count * unitPrice;
      totalFee = base + userPart;
      breakdownText = `基本料 ¥${base.toLocaleString()} ＋ (${count}名 × ¥${unitPrice.toLocaleString()})`;
      break;
    }

    case 'tier_included': {
      modelName = '基本枠 ＋ 超過従量制';
      const included = cfg.included_users ?? 5;
      const base = isAnnual ? (cfg.base_fee_annual ?? (cfg.base_fee ? cfg.base_fee * 12 : 15000)) : (cfg.base_fee ?? 1500);
      const extraUsers = Math.max(0, count - included);
      const extraPart = extraUsers * unitPrice;
      totalFee = base + extraPart;
      breakdownText = count <= included
        ? `基本枠 ${included}名分（¥${base.toLocaleString()}）`
        : `基本枠 ¥${base.toLocaleString()}（${included}名）＋ 超過${extraUsers}名 × ¥${unitPrice.toLocaleString()}`;
      break;
    }

    case 'flat_rate': {
      modelName = '全社定額制';
      totalFee = isAnnual 
        ? (cfg.flat_annual_price ?? 150000)
        : (cfg.flat_monthly_price ?? 15000);
      breakdownText = isAnnual 
        ? `定額プラン（年額 ¥${totalFee.toLocaleString()}）`
        : `定額プラン（月額 ¥${totalFee.toLocaleString()}）`;
      break;
    }

    default: {
      totalFee = count * unitPrice;
      breakdownText = `${count}名 × ¥${unitPrice.toLocaleString()}/月`;
      break;
    }
  }

  return {
    totalFee,
    breakdownText,
    modelName,
    unitPrice,
    activeUsers: count
  };
}

/**
 * 🌟 3大 SaaS プラン定義（シフト単体・勤怠単体・フルセット）
 */
export type SaasPlanType = 'trial' | 'shift_only' | 'kintai_only' | 'full_advance';

export interface SaasPlanMeta {
  id: SaasPlanType;
  name: string;
  badge: string;
  badgeColor: string;
  unitPriceMonthly: number; // 1人あたり月額単価
  unitPriceAnnual: number;  // 1人あたり年額単価（割引適用）
  originalPriceMonthly?: number; // 割引前定価（例: 600円）
  discountText?: string;    // 割引アピール文（例: "セットで100円お得！"）
  description: string;
  recommendedFor: string;
  features: string[];
  isPopular?: boolean;
}

export const SAAS_PLANS: Record<SaasPlanType, SaasPlanMeta> = {
  trial: {
    id: 'trial',
    name: '1ヶ月無料トライアル',
    badge: '🎁 30日間全機能無料',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    unitPriceMonthly: 0,
    unitPriceAnnual: 0,
    description: '登録から1ヶ月間（30日）、すべての機能を完全無料でお試しいただけます。クレジットカード登録不要。',
    recommendedFor: '新規導入をご検討中のすべての企業・店舗様',
    features: [
      'LINEシフト収集・AI自動配置・カレンダー管理',
      'LINE確定シフト個別通知・リマインド配信',
      'Web/GPS打刻・勤怠集計・有給自動管理',
      '入社手続き・雇用契約書・法定労務帳簿の自動作成',
      '30日間の全機能フルアクセス'
    ]
  },
  shift_only: {
    id: 'shift_only',
    name: 'シフト＆LINE単体プラン',
    badge: '📱 シフト特化',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    unitPriceMonthly: 300,
    unitPriceAnnual: 3000,
    description: '他社の勤怠ソフトをお使いで、「LINEシフト募集・AI自動割り当て・確定LINE通知」だけを安く使いたい店舗に最適。',
    recommendedFor: '飲食店・カフェ・美容室・小売店・シフト制店舗',
    features: [
      'LINEからのシフト希望収集・自動リマインド',
      'AIによるシフト自動配置（過不足ゲージ連動）',
      'シフトカレンダー（日次・週次・月次）',
      '確定シフトのLINE個別一括送信',
      'ヘルプ要請・シフト交代調整'
    ]
  },
  kintai_only: {
    id: 'kintai_only',
    name: '勤怠＆労務単体プラン',
    badge: '💼 勤怠・労務特化',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    unitPriceMonthly: 300,
    unitPriceAnnual: 3000,
    description: 'シフト作成が不要な固定勤務企業向け。打刻管理・有給休暇・入社労務手続きをスマートに完結。',
    recommendedFor: 'オフィスワーク・IT企業・製造業・士業・固定勤務企業',
    features: [
      'Web打刻・スマホGPS打刻・打刻不正防止',
      '有給休暇の法定自動付与・残日数・取得義務管理',
      '36協定・残業超過アラート・勤怠CSV出力',
      '入社手続き・雇用契約書・誓約書の自動発行',
      '労働者名簿・出勤簿・賃金台帳の法定帳簿生成'
    ]
  },
  full_advance: {
    id: 'full_advance',
    name: 'フルセット（アドバンス）プラン',
    badge: '👑 一番人気・100円お得！',
    badgeColor: 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white border-amber-400',
    unitPriceMonthly: 500,
    unitPriceAnnual: 5000,
    originalPriceMonthly: 600,
    discountText: '通常600円 ➔ セット割で100円おトク！',
    description: 'シフトと勤怠・労務が完全連動！シフト確定が出勤予定に直結し、打刻漏れ防止から給与計算まで一気通貫。',
    recommendedFor: '正社員とアルバイトが混在する飲食店・クリニック・介護福祉施設・サービス業',
    features: [
      '✨ シフト＆LINE機能の「すべて」が利用可能',
      '✨ 勤怠＆労務管理の「すべて」が利用可能',
      '🔗 シフト確定 ➔ 勤怠予定の完全シームレス連動',
      '⚡ 予定外打刻・遅刻欠勤の自動検知アラート',
      '🎁 単体契約より【1名あたり月額100円】もお得！'
    ],
    isPopular: true
  }
};

/**
 * 選択プランと在籍人数から、月額・年額およびお得額を計算
 */
export function calculateSaasPlanPrice(
  planId: SaasPlanType,
  userCount: number,
  isAnnual: boolean = false
): {
  unitPrice: number;
  totalPrice: number;
  savedMonthlyAmount: number;
  originalTotalPrice: number;
} {
  const meta = SAAS_PLANS[planId] || SAAS_PLANS.full_advance;
  const count = Math.max(0, userCount);
  const unitPrice = isAnnual ? meta.unitPriceAnnual : meta.unitPriceMonthly;
  const totalPrice = count * unitPrice;

  // フルセットプランの場合のお得額（単体2つ＝600円との差額: 100円/名）
  let savedMonthlyAmount = 0;
  let originalTotalPrice = totalPrice;
  if (planId === 'full_advance') {
    const originalUnit = isAnnual ? 6000 : 600;
    originalTotalPrice = count * originalUnit;
    savedMonthlyAmount = isAnnual ? count * 1000 : count * 100;
  }

  return {
    unitPrice,
    totalPrice,
    savedMonthlyAmount,
    originalTotalPrice
  };
}

