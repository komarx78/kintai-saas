-- ============================================================================
-- 🧪 シフトAI自動生成 検証用ダミー希望データ投入SQL
-- （Supabase SQL Editor で実行すると、今週分のスタッフ希望シフトが一発で投入されます）
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_user_ids UUID[];
    v_target_date DATE;
    i INT;
    v_uid UUID;
BEGIN
    -- 1. 対象テナントの特定（株式会社KAP または 最も従業員の多いテナント）
    SELECT id INTO v_tenant_id 
    FROM public.tenants 
    WHERE name LIKE '%KAP%' 
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id 
        FROM public.users 
        WHERE tenant_id IS NOT NULL 
        GROUP BY tenant_id 
        ORDER BY COUNT(*) DESC 
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'テナントが見つかりませんでした。';
    END IF;

    -- 2. テスト用スタッフが不足している場合に備えてダミーユーザーを確保
    INSERT INTO public.users (tenant_id, name, email, role)
    VALUES 
        (v_tenant_id, '田中 太郎（ホール）', 'tanaka_kap@example.com', 'user'),
        (v_tenant_id, '佐藤 花子（ホール）', 'sato_kap@example.com', 'user'),
        (v_tenant_id, '鈴木 一郎（ホール）', 'suzuki_kap@example.com', 'user'),
        (v_tenant_id, '高橋 健太（キッチン）', 'takahashi_kap@example.com', 'user'),
        (v_tenant_id, '渡辺 美咲（キッチン）', 'watanabe_kap@example.com', 'user'),
        (v_tenant_id, '伊藤 翔太（キッチン）', 'ito_kap@example.com', 'user'),
        (v_tenant_id, '山本 さくら（両刀）', 'yamamoto_kap@example.com', 'user'),
        (v_tenant_id, '中村 裕樹（ホール）', 'nakamura_kap@example.com', 'user')
    ON CONFLICT (email) DO NOTHING;

    -- 3. テナント内のスタッフID一覧を取得（最大8名）
    SELECT ARRAY_AGG(id) INTO v_user_ids
    FROM (
        SELECT id FROM public.users 
        WHERE tenant_id = v_tenant_id 
        ORDER BY role DESC, created_at ASC 
        LIMIT 8
    ) sub;

    -- 4. 各スタッフの役割・時給設定（shift_employee_settings）を配備
    -- 1人目〜3人目: ホール、4人目〜6人目: キッチン、7人目: 両刀、8人目: ホール
    IF ARRAY_LENGTH(v_user_ids, 1) >= 1 THEN
        INSERT INTO public.shift_employee_settings (tenant_id, user_id, hourly_wage, default_role, roles)
        VALUES 
            (v_tenant_id, v_user_ids[1], 1100, 'ホール', '["ホール"]'::jsonb),
            (v_tenant_id, v_user_ids[2], 1150, 'ホール', '["ホール"]'::jsonb),
            (v_tenant_id, v_user_ids[3], 1200, 'ホール', '["ホール"]'::jsonb)
        ON CONFLICT (tenant_id, user_id) DO UPDATE 
        SET default_role = EXCLUDED.default_role, roles = EXCLUDED.roles;
    END IF;

    IF ARRAY_LENGTH(v_user_ids, 1) >= 6 THEN
        INSERT INTO public.shift_employee_settings (tenant_id, user_id, hourly_wage, default_role, roles)
        VALUES 
            (v_tenant_id, v_user_ids[4], 1200, 'キッチン', '["キッチン"]'::jsonb),
            (v_tenant_id, v_user_ids[5], 1250, 'キッチン', '["キッチン"]'::jsonb),
            (v_tenant_id, v_user_ids[6], 1150, 'キッチン', '["キッチン"]'::jsonb)
        ON CONFLICT (tenant_id, user_id) DO UPDATE 
        SET default_role = EXCLUDED.default_role, roles = EXCLUDED.roles;
    END IF;

    IF ARRAY_LENGTH(v_user_ids, 1) >= 7 THEN
        INSERT INTO public.shift_employee_settings (tenant_id, user_id, hourly_wage, default_role, roles)
        VALUES 
            (v_tenant_id, v_user_ids[7], 1300, 'ホール', '["ホール", "キッチン"]'::jsonb)
        ON CONFLICT (tenant_id, user_id) DO UPDATE 
        SET default_role = EXCLUDED.default_role, roles = EXCLUDED.roles;
    END IF;

    -- 5. 今週（2026-09-21 〜 2026-09-27）の既存希望＆下書きシフトを一旦リセット
    DELETE FROM public.advanced_shift_requests 
    WHERE tenant_id = v_tenant_id 
      AND target_date >= '2026-09-21' AND target_date <= '2026-09-27';

    DELETE FROM public.advanced_shifts 
    WHERE tenant_id = v_tenant_id 
      AND status = 'draft'
      AND target_date >= '2026-09-21' AND target_date <= '2026-09-27';

    -- 6. 各曜日ごとにリアルなシフト希望データを投入！
    -- スタッフ1 (ホール・朝昼): 08:00〜14:00
    -- スタッフ2 (ホール・昼夜): 11:00〜18:00
    -- スタッフ3 (ホール・夜間): 17:00〜21:00
    -- スタッフ4 (キッチン・朝昼): 09:00〜15:00
    -- スタッフ5 (キッチン・昼夜): 12:00〜19:00
    -- スタッフ6 (キッチン・夜間): 17:00〜21:00
    -- スタッフ7 (ホール/キッチン・フル): 10:00〜19:00
    FOR i IN 0..6 LOOP
        v_target_date := '2026-09-21'::DATE + i;

        -- 月〜金の希望（週末も含め均等に投入）
        IF ARRAY_LENGTH(v_user_ids, 1) >= 1 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[1], v_target_date, '08:00', '14:00', 'ホール');
        END IF;

        IF ARRAY_LENGTH(v_user_ids, 1) >= 2 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[2], v_target_date, '10:00', '17:00', 'ホール');
        END IF;

        IF ARRAY_LENGTH(v_user_ids, 1) >= 3 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[3], v_target_date, '17:00', '21:00', 'ホール');
        END IF;

        IF ARRAY_LENGTH(v_user_ids, 1) >= 4 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[4], v_target_date, '09:00', '15:00', 'キッチン');
        END IF;

        IF ARRAY_LENGTH(v_user_ids, 1) >= 5 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[5], v_target_date, '12:00', '18:00', 'キッチン');
        END IF;

        IF ARRAY_LENGTH(v_user_ids, 1) >= 6 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[6], v_target_date, '17:00', '21:00', 'キッチン');
        END IF;

        IF ARRAY_LENGTH(v_user_ids, 1) >= 7 THEN
            INSERT INTO public.advanced_shift_requests (tenant_id, user_id, target_date, available_start_time, available_end_time, preferred_role)
            VALUES (v_tenant_id, v_user_ids[7], v_target_date, '10:00', '19:00', 'ホール');
        END IF;
    END LOOP;

    RAISE NOTICE '✅ 今週（2026-09-21〜2026-09-27）のダミー希望シフト（7名×7日分）の投入が完了しました！';
END $$;
