-- ============================================================================
-- 🏛️ SaaS料金体系・1ヶ月無料トライアル・Square決済連携 マイグレーション
-- ============================================================================

-- 1. tenants テーブルへのカラム追加（存在しない場合のみ）
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(50) DEFAULT 'monthly';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month');
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_customer_id VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_subscription_id VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS square_checkout_url TEXT;

-- 2. トライアル期間のデフォルトを確実に「1ヶ月（30〜31日）」に設定
ALTER TABLE tenants ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '1 month');

-- 3. 既存のテナントで trial_ends_at が14日等で短く設定されている、またはNULLのものを「登録日＋1ヶ月」へ延長更新
UPDATE tenants 
SET trial_ends_at = created_at + INTERVAL '1 month'
WHERE plan_type = 'trial' 
  AND (trial_ends_at IS NULL OR trial_ends_at < created_at + INTERVAL '25 days');

-- 4. plan_type のチェック制約またはコメント
COMMENT ON COLUMN tenants.plan_type IS 'SaaSプラン: trial (1ヶ月無料), shift_only (シフト単体300円), kintai_only (勤怠単体300円), full_advance (フルセット500円), paid (レガシー有料)';
COMMENT ON COLUMN tenants.square_checkout_url IS 'Square定期決済リンクURL';
