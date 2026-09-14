-- ============================================================================
-- SaaS 料金マスタ・複数課金モデル切替 統合マイグレーション
-- (Supabase SQL Editor で実行してください)
-- ============================================================================

-- 1. system_settings テーブルへの料金モデル＆標準単価カラム追加
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS billing_model VARCHAR(50) DEFAULT 'per_user', -- 'per_user' | 'base_plus_user' | 'tier_included' | 'flat_rate'
    ADD COLUMN IF NOT EXISTS unit_price_per_user INT DEFAULT 300, -- 規定単価: 1人あたり月額300円
    ADD COLUMN IF NOT EXISTS unit_price_per_user_annual INT DEFAULT 3600, -- 年額単価: 3,600円
    ADD COLUMN IF NOT EXISTS base_fee INT DEFAULT 0, -- 基本料金 (月額)
    ADD COLUMN IF NOT EXISTS base_fee_annual INT DEFAULT 0, -- 基本料金 (年額)
    ADD COLUMN IF NOT EXISTS included_users INT DEFAULT 0, -- 基本枠に含まれる人数
    ADD COLUMN IF NOT EXISTS flat_monthly_price INT DEFAULT 15000, -- 月額固定料金
    ADD COLUMN IF NOT EXISTS flat_annual_price INT DEFAULT 150000; -- 年額固定料金

-- 既存レコードの単価を300円に更新（未設定または旧単価の場合）
UPDATE public.system_settings 
SET 
    billing_model = COALESCE(billing_model, 'per_user'),
    unit_price_per_user = 300,
    unit_price_per_user_annual = 3600
WHERE unit_price_per_user IS NULL OR unit_price_per_user = 200 OR unit_price_per_user = 500;

-- 2. tenants テーブルへの企業個別カスタム課金モデルカラム追加
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS custom_billing_model VARCHAR(50),
    ADD COLUMN IF NOT EXISTS custom_unit_price_per_user INT,
    ADD COLUMN IF NOT EXISTS custom_unit_price_per_user_annual INT,
    ADD COLUMN IF NOT EXISTS custom_base_fee INT,
    ADD COLUMN IF NOT EXISTS custom_base_fee_annual INT,
    ADD COLUMN IF NOT EXISTS custom_included_users INT,
    ADD COLUMN IF NOT EXISTS custom_flat_monthly_price INT,
    ADD COLUMN IF NOT EXISTS custom_flat_annual_price INT;

NOTIFY pgrst, 'reload schema';
