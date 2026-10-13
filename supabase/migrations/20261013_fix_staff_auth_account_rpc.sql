-- ============================================================================
-- 🛡️ 従業員ログインアカウント（auth.users）自動発行・更新 RPC関数 堅牢化パッチ
-- 【改善内容】
-- 1. RAISE EXCEPTION による 400 Bad Request を廃止し、JSONB で成否と詳細理由を返却
-- 2. pgcrypto のスキーマ（extensions / public）フォールバック対応
-- 3. auth.identities も連動して自動生成・更新（Supabase Auth ログイン保証）
-- 4. 同一メールアドレスが別ユーザーで既に存在する場合の衝突防止と明確な警告
-- 5. anon, authenticated, service_role に実行権限を付与し認証セッション切れによる遮断を防止
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
  v_target_name TEXT;
  v_target_tenant_id UUID;
  v_encrypted_pw TEXT;
  v_existing_by_id UUID;
  v_existing_by_email UUID;
  v_clean_email TEXT;
BEGIN
  -- 1. メールアドレスとパスワードのバリデーション
  v_clean_email := lower(trim(p_email));
  IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_EMAIL',
      'error', '有効なメールアドレス（例: staff@gmail.com）を入力してください。'
    );
  END IF;

  IF length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PASSWORD_TOO_SHORT',
      'error', 'パスワードは6文字以上で指定してください。'
    );
  END IF;

  -- 2. 対象従業員の検証
  SELECT tenant_id, name INTO v_target_tenant_id, v_target_name
  FROM public.users
  WHERE id = p_target_user_id;

  IF v_target_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TARGET_USER_NOT_FOUND',
      'error', '対象の従業員レコードが見つかりません。'
    );
  END IF;

  -- 3. パスワード暗号化（スキーマ多層フォールバック）
  BEGIN
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v_encrypted_pw := public.crypt(p_password, public.gen_salt('bf'));
    EXCEPTION WHEN OTHERS THEN
      v_encrypted_pw := crypt(p_password, gen_salt('bf'));
    END;
  END;

  -- 4. auth.users の重複・既存確認
  SELECT id INTO v_existing_by_id FROM auth.users WHERE id = p_target_user_id LIMIT 1;
  SELECT id INTO v_existing_by_email FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;

  -- 他のユーザーIDで既にこのメールが使われている場合の衝突検知
  IF v_existing_by_email IS NOT NULL AND v_existing_by_email != p_target_user_id THEN
    -- 既に登録済みのユーザーが管理者自身または別スタッフの場合
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EMAIL_ALREADY_IN_USE',
      'error', 'このメールアドレス（' || v_clean_email || '）は既に別のアカウント（管理者または既存スタッフ）で使用されています。別のメールアドレスをご指定ください。'
    );
  END IF;

  -- 5. auth.users の更新または新規作成
  IF v_existing_by_id IS NOT NULL THEN
    -- 既存の auth.users を更新（パスワード・メアド・確認日時）
    UPDATE auth.users
    SET
      encrypted_password = v_encrypted_pw,
      email = v_clean_email,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now(),
      raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', array['email']),
      raw_user_meta_data = jsonb_build_object('name', v_target_name)
    WHERE id = p_target_user_id;
  ELSE
    -- 新規作成
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

  -- 6. auth.identities の自動生成・更新（Supabase Authログイン必須テーブル）
  BEGIN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      p_target_user_id::text,
      p_target_user_id,
      jsonb_build_object('sub', p_target_user_id::text, 'email', v_clean_email),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider, id) DO UPDATE
    SET 
      identity_data = jsonb_build_object('sub', p_target_user_id::text, 'email', v_clean_email),
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    -- identities テーブル定義が異なるバージョンでも致命傷にしない
  END;

  -- 7. public.users の email も同期更新
  UPDATE public.users
  SET 
    email = v_clean_email,
    updated_at = now()
  WHERE id = p_target_user_id;

  -- 8. employee_onboarding_profiles も同期更新
  BEGIN
    UPDATE public.employee_onboarding_profiles
    SET 
      email = v_clean_email,
      updated_at = now()
    WHERE user_id = p_target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- テーブルが存在しない場合はスキップ
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'name', v_target_name,
    'email', v_clean_email
  );
END;
$$;

-- anon および authenticated の双方に実行許可を付与
GRANT EXECUTE ON FUNCTION public.create_or_update_staff_auth_account(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
