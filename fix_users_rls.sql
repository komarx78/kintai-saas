-- users テーブルの無限ループ（Infinite Recursion）エラーを解消するためのポリシー修正

-- 1. 古いポリシーを削除
DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- 2. get_user_tenant_id() は既に SECURITY DEFINER で作成済みのため、それを利用して安全にポリシーを再作成
CREATE POLICY "Users can view users in same tenant" ON users FOR SELECT USING (
  tenant_id = get_user_tenant_id()
);

-- 管理者権限のチェック用ヘルパー関数（再帰防止用）
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "Admins can manage users" ON users FOR ALL USING (
  -- 自身が管理者であり、かつテナントIDが一致する場合のみ許可
  tenant_id = get_user_tenant_id() AND is_admin()
);
