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
