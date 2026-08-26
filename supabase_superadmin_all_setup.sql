-- ============================================================================
-- 特権管理者・販売元（SuperAdmin）機能 完全セットアップSQL
-- ============================================================================

-- 1. system_settings テーブルの作成（存在しない場合）
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_1_user INT NOT NULL DEFAULT 2000,
    price_1_user_annual INT NOT NULL DEFAULT 20000,
    price_2_users INT NOT NULL DEFAULT 4000,
    price_2_users_annual INT NOT NULL DEFAULT 40000,
    price_3_users INT NOT NULL DEFAULT 6000,
    price_3_users_annual INT NOT NULL DEFAULT 60000,
    price_4_users INT NOT NULL DEFAULT 8000,
    price_4_users_annual INT NOT NULL DEFAULT 80000,
    price_5_users INT NOT NULL DEFAULT 10000,
    price_5_users_annual INT NOT NULL DEFAULT 100000,
    additional_user_price INT NOT NULL DEFAULT 500,
    additional_user_price_annual INT NOT NULL DEFAULT 5000,
    default_trial_days INT NOT NULL DEFAULT 30,
    gemini_api_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 既存の system_settings テーブルがある場合に不足カラムを追加
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_trial_days INT NOT NULL DEFAULT 30;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS gemini_api_key VARCHAR(255);

-- 2. tenants テーブルへのプラン・トライアル・価格管理カラム追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(50) DEFAULT 'monthly';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_1_user INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_1_user_annual INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_2_users INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_2_users_annual INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_3_users INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_3_users_annual INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_4_users INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_4_users_annual INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_5_users INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_price_5_users_annual INT;

-- 3. スーパー管理者判定関数（無限ループを防止する SECURITY DEFINER）
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- 4. RLSポリシーの設定
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザーは system_settings の読み取りが可能
DROP POLICY IF EXISTS "Allow read system_settings for authenticated users" ON system_settings;
CREATE POLICY "Allow read system_settings for authenticated users"
    ON system_settings FOR SELECT
    TO authenticated
    USING (true);

-- superadmin は system_settings の全操作が可能
DROP POLICY IF EXISTS "Superadmins can manage system settings" ON system_settings;
CREATE POLICY "Superadmins can manage system settings"
    ON system_settings FOR ALL
    TO authenticated
    USING (is_superadmin());

-- superadmin は全 tenants の閲覧・更新が可能
DROP POLICY IF EXISTS "Superadmins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Superadmins can manage all tenants" ON tenants;
CREATE POLICY "Superadmins can view all tenants" ON tenants FOR SELECT USING (is_superadmin());
CREATE POLICY "Superadmins can manage all tenants" ON tenants FOR ALL USING (is_superadmin());

-- superadmin は全 users の閲覧が可能
DROP POLICY IF EXISTS "Superadmins can view all users" ON users;
CREATE POLICY "Superadmins can view all users" ON users FOR SELECT USING (is_superadmin());
