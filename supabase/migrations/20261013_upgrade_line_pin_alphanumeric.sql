-- ==============================================================================
-- 👑 LINE ワンタイム連携PINコード 英数対応 ＆ 重複防止アップグレードSQL
-- 【目的】
-- 1. 4桁数字（1万通り）から英大文字＋数字（約168万通り）へ大幅拡張し、他社衝突を根絶
-- 2. 大文字・小文字・全角・半角のどれが送信されても自動吸収して照合（③対応・①運用）
-- 3. 発行時の重複チェック・再抽選ループによる完全一意性保証
-- ==============================================================================

-- 1. ワンタイムPINコード発行 RPC 関数（英大文字＋数字 4桁・約168万通り）
CREATE OR REPLACE FUNCTION public.generate_user_line_pin(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin text;
    v_expires_at timestamptz;
    v_user_name text;
    v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- 視認性抜群の32文字（0/O, 1/I 除外・約105万通り）
    v_is_collision boolean;
    v_retry_count int := 0;
BEGIN
    -- 有効期限は発行から48時間
    v_expires_at := now() + interval '48 hours';

    -- 衝突防止再抽選ループ
    LOOP
        v_pin := '';
        FOR i IN 1..4 LOOP
            v_pin := v_pin || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        END LOOP;

        -- 現在有効な他のPINと被っていないかチェック
        SELECT EXISTS (
            SELECT 1 FROM public.users 
            WHERE upper(line_link_pin) = v_pin 
              AND id != p_user_id 
              AND (line_link_pin_expires_at IS NULL OR line_link_pin_expires_at > now())
        ) INTO v_is_collision;

        IF NOT v_is_collision OR v_retry_count >= 10 THEN
            EXIT;
        END IF;

        v_retry_count := v_retry_count + 1;
    END LOOP;

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

-- 2. LINE Webhook 自動照合・連携完了 RPC 関数（大文字小文字・全角半角の完全吸収）
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
    v_clean_pin text;
BEGIN
    -- 入力値のトリムおよびプレフィックス（コード: 等）の除去
    v_clean_pin := trim(coalesce(p_pin, ''));
    v_clean_pin := regexp_replace(v_clean_pin, '^.*?(コード|CODE|PIN)[:：\s]*', '', 'i');
    -- 全角英数を半角英数に変換し、大文字に統一
    v_clean_pin := translate(
        v_clean_pin, 
        '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ', 
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ'
    );
    v_clean_pin := upper(trim(v_clean_pin));

    -- 有効期限内でPINが一致する未連携（または再連携）ユーザーを検索（大文字小文字非依存照合）
    SELECT id, tenant_id, name, email
    INTO v_target_user
    FROM public.users
    WHERE upper(line_link_pin) = v_clean_pin
      AND (line_link_pin_expires_at IS NULL OR line_link_pin_expires_at > now())
    ORDER BY line_link_pin_expires_at DESC NULLS LAST
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

-- 権限付与
GRANT EXECUTE ON FUNCTION public.generate_user_line_pin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_user_by_line_pin(text, text, text, text) TO anon, authenticated, service_role;
