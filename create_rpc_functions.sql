-- 必須のRPC関数（フロントエンドから呼び出し可能にするための設定）

-- 1. 自身のテナントIDを取得する関数
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$;

-- 2. 管理者権限を持っているか確認する関数
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- users テーブルのRLSポリシーを完全に修正（再帰防止）
DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

CREATE POLICY "Users can view users in same tenant" ON users FOR SELECT USING (
  tenant_id = get_user_tenant_id()
);

CREATE POLICY "Admins can manage users" ON users FOR ALL USING (
  tenant_id = get_user_tenant_id() AND is_admin()
);
