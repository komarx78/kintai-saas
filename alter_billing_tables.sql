-- system_settings へのカラム追加
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS base_price_annual INT NOT NULL DEFAULT 20000;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS additional_user_price_annual INT NOT NULL DEFAULT 5000;

-- tenants へのプラン管理カラム追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(50) DEFAULT 'monthly';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_user_limit INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_base_price INT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_base_price_annual INT;

-- 既存のテナントの trial_ends_at を初期化（例: 作成日から1ヶ月後）
UPDATE tenants SET trial_ends_at = created_at + INTERVAL '1 month' WHERE trial_ends_at IS NULL;

-- スーパー管理者用の RLS ポリシー追加
CREATE POLICY "Superadmins can view all users" ON users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users admin WHERE admin.id = auth.uid() AND admin.role = 'superadmin')
);

CREATE POLICY "Superadmins can manage all users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users admin WHERE admin.id = auth.uid() AND admin.role = 'superadmin')
);

CREATE POLICY "Superadmins can view all tenants" ON tenants FOR SELECT USING (
  EXISTS (SELECT 1 FROM users admin WHERE admin.id = auth.uid() AND admin.role = 'superadmin')
);

CREATE POLICY "Superadmins can manage all tenants" ON tenants FOR ALL USING (
  EXISTS (SELECT 1 FROM users admin WHERE admin.id = auth.uid() AND admin.role = 'superadmin')
);

CREATE POLICY "Superadmins can manage system settings" ON system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users admin WHERE admin.id = auth.uid() AND admin.role = 'superadmin')
);
