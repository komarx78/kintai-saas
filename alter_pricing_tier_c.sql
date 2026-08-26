-- ============================================================================
-- 料金体系変更 (案C) 用のマイグレーション
-- system_settings および tenants テーブルの料金構成を1名〜5名用に変更
-- ============================================================================

-- 1. system_settings の旧カラム削除
ALTER TABLE system_settings 
  DROP COLUMN IF EXISTS base_price,
  DROP COLUMN IF EXISTS base_user_limit,
  DROP COLUMN IF EXISTS base_price_annual;

-- 2. system_settings への新カラム追加
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS price_1_user INT NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS price_2_users INT NOT NULL DEFAULT 4000,
  ADD COLUMN IF NOT EXISTS price_3_users INT NOT NULL DEFAULT 6000,
  ADD COLUMN IF NOT EXISTS price_4_users INT NOT NULL DEFAULT 8000,
  ADD COLUMN IF NOT EXISTS price_5_users INT NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS price_1_user_annual INT NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS price_2_users_annual INT NOT NULL DEFAULT 40000,
  ADD COLUMN IF NOT EXISTS price_3_users_annual INT NOT NULL DEFAULT 60000,
  ADD COLUMN IF NOT EXISTS price_4_users_annual INT NOT NULL DEFAULT 80000,
  ADD COLUMN IF NOT EXISTS price_5_users_annual INT NOT NULL DEFAULT 100000;

-- 3. tenants の旧カラム削除
ALTER TABLE tenants 
  DROP COLUMN IF EXISTS custom_user_limit,
  DROP COLUMN IF EXISTS custom_base_price,
  DROP COLUMN IF EXISTS custom_base_price_annual;

-- 4. tenants への新カラム追加
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS custom_price_1_user INT,
  ADD COLUMN IF NOT EXISTS custom_price_2_users INT,
  ADD COLUMN IF NOT EXISTS custom_price_3_users INT,
  ADD COLUMN IF NOT EXISTS custom_price_4_users INT,
  ADD COLUMN IF NOT EXISTS custom_price_5_users INT,
  ADD COLUMN IF NOT EXISTS custom_price_1_user_annual INT,
  ADD COLUMN IF NOT EXISTS custom_price_2_users_annual INT,
  ADD COLUMN IF NOT EXISTS custom_price_3_users_annual INT,
  ADD COLUMN IF NOT EXISTS custom_price_4_users_annual INT,
  ADD COLUMN IF NOT EXISTS custom_price_5_users_annual INT;

-- 5. tenants の trial_ends_at にデフォルト値を設定
ALTER TABLE tenants 
  ALTER COLUMN trial_ends_at SET DEFAULT NOW() + INTERVAL '1 month';
