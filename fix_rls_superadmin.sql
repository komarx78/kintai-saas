-- ============================================================================
-- スーパー管理者用 RLS（行単位セキュリティ）無限ループ修正パッチ
-- tenantsテーブル等を更新する際に発生する Infinite Recursion エラーを解消します。
-- ============================================================================

-- 1. スーパー管理者かどうかを判定する安全な関数（無限ループ回避）
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

-- 2. 既存の壊れた（再帰エラーを起こす）スーパー管理者用ポリシーを削除
DROP POLICY IF EXISTS "Superadmins can view all users" ON users;
DROP POLICY IF EXISTS "Superadmins can manage all users" ON users;
DROP POLICY IF EXISTS "Superadmins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Superadmins can manage all tenants" ON tenants;
DROP POLICY IF EXISTS "Superadmins can manage system settings" ON system_settings;

-- 3. 安全な関数を使った新しい強力なポリシーを作成
CREATE POLICY "Superadmins can view all users" ON users FOR SELECT USING (is_superadmin());
CREATE POLICY "Superadmins can manage all users" ON users FOR ALL USING (is_superadmin());

CREATE POLICY "Superadmins can view all tenants" ON tenants FOR SELECT USING (is_superadmin());
CREATE POLICY "Superadmins can manage all tenants" ON tenants FOR ALL USING (is_superadmin());

CREATE POLICY "Superadmins can manage system settings" ON system_settings FOR ALL USING (is_superadmin());
