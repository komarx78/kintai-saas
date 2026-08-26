-- 無限再帰エラー（Infinite Recursion）を修正するためのSQL

-- 1. 権限チェック用の安全な関数を作成（SECURITY DEFINER により無限ループを回避）
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
$$;

-- 2. 既存の無限ループするポリシーをすべて削除
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;
DROP POLICY IF EXISTS "Users can view tenant attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can view tenant leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON leave_requests;
DROP POLICY IF EXISTS "Approvers can update status" ON leave_requests;

-- 3. 新しい安全な関数を使ってポリシーを再作成

-- tenants
CREATE POLICY "Users can view own tenant" ON tenants FOR SELECT USING (
  id = get_user_tenant_id()
);

-- users
CREATE POLICY "Users can view users in same tenant" ON users FOR SELECT USING (
  tenant_id = get_user_tenant_id()
);
CREATE POLICY "Admins can manage users" ON users FOR ALL USING (
  is_admin() AND tenant_id = get_user_tenant_id()
);

-- attendance_records
CREATE POLICY "Users can view tenant attendance" ON attendance_records FOR SELECT USING (
  tenant_id = get_user_tenant_id()
);
CREATE POLICY "Users can insert own attendance" ON attendance_records FOR INSERT WITH CHECK (
  user_id = auth.uid() AND tenant_id = get_user_tenant_id()
);

-- leave_requests
CREATE POLICY "Users can view tenant leave requests" ON leave_requests FOR SELECT USING (
  tenant_id = get_user_tenant_id()
);
CREATE POLICY "Users can insert own requests" ON leave_requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND tenant_id = get_user_tenant_id()
);
CREATE POLICY "Approvers can update status" ON leave_requests FOR UPDATE USING (
  approver_id = auth.uid() OR is_admin()
);
