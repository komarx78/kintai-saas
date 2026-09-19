-- ============================================================================
-- 🛡️ 従業員ログインアカウント（auth.users）自動発行・更新 RPC関数
-- 【目的】
-- 管理者が従業員台帳から、対象スタッフのログイン用メールアドレスと初期パスワードを
-- Supabase Auth (auth.users) に一撃で安全に配備・更新できるようにする。
-- スタッフ側は確認メール認証待ちや招待コードの手入力不要で即時ログイン可能。
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_or_update_staff_auth_account(
  p_target_user_id UUID,
  p_email TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_tenant_id UUID;
  v_target_tenant_id UUID;
  v_target_name TEXT;
  v_encrypted_pw TEXT;
  v_existing_auth_id UUID;
  v_clean_email TEXT;
BEGIN
  -- 1. 呼び出し元ユーザーの検証
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION '認証されていません。ログインしてください。';
  END IF;

  SELECT role, tenant_id INTO v_caller_role, v_caller_tenant_id
  FROM public.users
  WHERE id = v_caller_id;

  IF v_caller_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION '管理者権限がありません。';
  END IF;

  -- 2. 対象従業員の検証
  SELECT tenant_id, name INTO v_target_tenant_id, v_target_name
  FROM public.users
  WHERE id = p_target_user_id;

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION '対象の従業員が見つかりません。';
  END IF;

  -- マルチテナント安全防御（他社従業員のアカウント発行を物理遮断）
  IF v_caller_role != 'superadmin' AND v_caller_tenant_id != v_target_tenant_id THEN
    RAISE EXCEPTION '他社の従業員アカウントは操作できません。';
  END IF;

  -- 3. メールアドレスとパスワードの正規化・暗号化
  v_clean_email := lower(trim(p_email));
  IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION '有効なメールアドレスを入力してください。';
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'パスワードは6文字以上で指定してください。';
  END IF;

  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- 4. auth.users に同一IDまたは同一メールのアカウントが存在するか確認
  SELECT id INTO v_existing_auth_id
  FROM auth.users
  WHERE id = p_target_user_id OR email = v_clean_email
  LIMIT 1;

  IF v_existing_auth_id IS NOT NULL THEN
    -- 既存の auth.users を更新（パスワード再設定 & メール確認済みに更新）
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email = v_clean_email,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email']),
      raw_user_meta_data = jsonb_build_object('name', v_target_name)
    WHERE id = v_existing_auth_id;
  ELSE
    -- 新規に auth.users へ登録（IDを public.users と一致させる）
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      p_target_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_clean_email,
      v_encrypted_pw,
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('name', v_target_name),
      now(),
      now()
    );
  END IF;

  -- 5. public.users の email も同期更新
  UPDATE public.users
  SET 
    email = v_clean_email,
    updated_at = now()
  WHERE id = p_target_user_id;

  -- 6. employee_onboarding_profiles も存在すれば同期
  BEGIN
    UPDATE public.employee_onboarding_profiles
    SET 
      email = v_clean_email,
      updated_at = now()
    WHERE user_id = p_target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- テーブルやカラムがない場合はスキップ
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'name', v_target_name,
    'email', v_clean_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_update_staff_auth_account(UUID, TEXT, TEXT) TO authenticated, service_role;
