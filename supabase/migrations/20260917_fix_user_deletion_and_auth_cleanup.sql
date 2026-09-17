-- ============================================================================
-- 🛡️ ユーザー完全抹消・auth.users連動クリーンアップ & 自己修復SQL
-- 【目的】
-- 1. 管理者が従業員台帳から従業員を削除した際、Supabase Auth (auth.users) に
--    認証アカウントがゴースト残存して再登録不能（422）になる現象を永久防止。
-- 2. public.users レコードが削除された後も auth.users が残存している場合に、
--    ログイン画面で 406 (Cannot coerce the result to a single JSON object) が
--    発生する問題を解消する自己修復RPC関数を配備。
-- 3. 現在ゴースト化している test1@kap-cocotte.com 等のアカウントを救済クリーンアップ。
-- ※ Supabase SQL Editor に貼り付けて「Run」を実行してください（完全冪等性保証）
-- ============================================================================

-- 1. public.users 削除時に auth.users も連動して自動削除するトリガー関数
CREATE OR REPLACE FUNCTION public.handle_user_deleted_clean_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- auth.users の同一IDレコードを完全抹消（存在する場合）
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_user_deleted_clean_auth ON public.users;
CREATE TRIGGER on_user_deleted_clean_auth
  AFTER DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_deleted_clean_auth();

-- 2. 管理者が従業員・ユーザーを関連データごと auth.users も含めて完全抹消するRPC関数
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 関連データのクリーンアップ
  DELETE FROM public.employee_document_submissions WHERE user_id = target_user_id;
  DELETE FROM public.employee_payroll_profiles WHERE user_id = target_user_id;
  DELETE FROM public.employee_onboarding_profiles WHERE user_id = target_user_id;
  DELETE FROM public.shift_employee_settings WHERE user_id = target_user_id;
  DELETE FROM public.attendance_records WHERE user_id = target_user_id;
  DELETE FROM public.leave_requests WHERE user_id = target_user_id;
  DELETE FROM public.leave_applications WHERE user_id = target_user_id;
  DELETE FROM public.salary_revision_history WHERE user_id = target_user_id;
  
  -- public.users の削除（上のトリガーでもauth.usersが削除されますが二重防御）
  DELETE FROM public.users WHERE id = target_user_id;
  
  -- auth.users の直接削除
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_completely(UUID) TO anon, authenticated, service_role;

-- 3. auth.users に存在するが public.users にレコードがない場合の自動復旧（自己修復）RPC関数
CREATE OR REPLACE FUNCTION public.self_heal_user()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  curr_user_id UUID := auth.uid();
  curr_email TEXT;
  curr_name TEXT;
  user_tenant_id UUID;
  user_role VARCHAR(50) := 'admin';
  existing_user RECORD;
BEGIN
  IF curr_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- 既に public.users に存在するか確認
  SELECT * INTO existing_user FROM public.users WHERE id = curr_user_id;
  IF existing_user.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'role', existing_user.role, 'tenant_id', existing_user.tenant_id);
  END IF;

  -- auth.users から情報を取得
  SELECT email, raw_user_meta_data->>'name' INTO curr_email, curr_name
  FROM auth.users WHERE id = curr_user_id;

  IF curr_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Auth user not found');
  END IF;

  IF curr_name IS NULL OR curr_name = '' THEN
    curr_name := split_part(curr_email, '@', 1);
  END IF;

  -- 新規テナント作成
  INSERT INTO public.tenants (name)
  VALUES (curr_name || ' 企業')
  RETURNING id INTO user_tenant_id;

  -- public.users レコードを自己修復作成
  INSERT INTO public.users (id, tenant_id, email, name, role)
  VALUES (curr_user_id, user_tenant_id, curr_email, curr_name, user_role);

  RETURN jsonb_build_object('success', true, 'role', user_role, 'tenant_id', user_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.self_heal_user() TO anon, authenticated, service_role;

-- 4. 過去に削除されて auth.users に残存（ゴースト化）しているアカウントの救済クリーンアップ
-- （test1@kap-cocotte.com 等、public.users にレコードが存在しない孤立認証アカウントを抹消）
DELETE FROM auth.users 
WHERE email = 'test1@kap-cocotte.com'
   OR (id NOT IN (SELECT id FROM public.users) AND email ILIKE '%test%');

-- 5. PostgREST スキーマキャッシュの即時再読み込み
NOTIFY pgrst, 'reload schema';
