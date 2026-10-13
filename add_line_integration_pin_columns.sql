-- ==============================================================================
-- 👑 LINE Messaging API ワンタイムPINコード連携・完全同期マイグレーションSQL
-- users テーブルへの LINE 連携・PIN カラム追加 ＆ 自動照合RPC関数配備
-- 完全冪等性保証（何度Runしてもエラーゼロ・安全実行対応）
-- ==============================================================================

-- 1. users テーブルへの LINE 連携用カラム追加
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'line_user_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_user_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'line_display_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_display_name text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'line_picture_url'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_picture_url text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_line_linked'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_line_linked boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'line_linked_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_linked_at timestamptz;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'line_link_pin'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_link_pin text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'line_link_pin_expires_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_link_pin_expires_at timestamptz;
    END IF;
END $$;

-- 2. 検索高速化インデックス配備
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON public.users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_line_link_pin ON public.users(line_link_pin);

-- 3. ワンタイムPINコード発行 RPC 関数（スタッフ画面・管理者画面から呼び出し）
CREATE OR REPLACE FUNCTION public.generate_user_line_pin(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin text;
    v_expires_at timestamptz;
    v_user_name text;
BEGIN
    -- 4桁のランダムな数字（1000〜9999）を生成
    v_pin := lpad(floor(random() * 9000 + 1000)::text, 4, '0');
    -- 有効期限は発行から48時間
    v_expires_at := now() + interval '48 hours';

    UPDATE public.users
    SET 
        line_link_pin = v_pin,
        line_link_pin_expires_at = v_expires_at
    WHERE id = p_user_id
    RETURNING name INTO v_user_name;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'ユーザーが見つかりません');
    END IF;

    RETURN json_build_object(
        'success', true,
        'pin', v_pin,
        'expires_at', v_expires_at,
        'user_name', v_user_name
    );
END;
$$;

-- 4. LINE Webhook 用 自動照合・連携完了 RPC 関数（スタッフがLINEトークにPINを送った時に実行）
CREATE OR REPLACE FUNCTION public.link_user_by_line_pin(
    p_pin text,
    p_line_user_id text,
    p_line_display_name text DEFAULT NULL,
    p_line_picture_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_user record;
BEGIN
    -- 有効期限内でPINが一致する未連携（または再連携）ユーザーを検索
    SELECT id, tenant_id, name, email
    INTO v_target_user
    FROM public.users
    WHERE line_link_pin = trim(p_pin)
      AND (line_link_pin_expires_at IS NULL OR line_link_pin_expires_at > now())
    LIMIT 1;

    IF v_target_user.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'PINコードが見つからないか、有効期限が切れています。社内システムの画面で最新のコードをご確認ください。'
        );
    END IF;

    -- LINE情報を更新して連携完了
    UPDATE public.users
    SET 
        line_user_id = p_line_user_id,
        line_display_name = COALESCE(p_line_display_name, line_display_name),
        line_picture_url = COALESCE(p_line_picture_url, line_picture_url),
        is_line_linked = true,
        line_linked_at = now(),
        line_link_pin = NULL, -- 使用済みPINの破棄
        line_link_pin_expires_at = NULL
    WHERE id = v_target_user.id;

    RETURN json_build_object(
        'success', true,
        'user_id', v_target_user.id,
        'user_name', v_target_user.name,
        'tenant_id', v_target_user.tenant_id
    );
END;
$$;

-- 5. LINE連携解除 RPC 関数
CREATE OR REPLACE FUNCTION public.unlink_user_line(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET 
        line_user_id = NULL,
        line_display_name = NULL,
        line_picture_url = NULL,
        is_line_linked = false,
        line_linked_at = NULL,
        line_link_pin = NULL,
        line_link_pin_expires_at = NULL
    WHERE id = p_user_id;

    RETURN json_build_object('success', true);
END;
$$;
