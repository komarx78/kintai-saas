-- ==============================================================================
-- 🏛️ 【孔明・司馬懿 謹製】全端末・他PC完全同期 ＆ SaaS実DB永続化 一撃無痛統合SQL
-- 【軍律第16条・第18条完全遵守：何度実行してもエラーにならない完全冪等性・GRANT文全配備】
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. テナントID取得ヘルパー関数（RPC）の配備
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. システム設定テーブル（公的帳票・印字座標マスタSSOT）の完全整備
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 全公的帳票の印字座標カラムを完全追加（存在しない場合のみ追加）
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS health_pension_acq_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS health_pension_loss_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS employment_acq_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS employment_loss_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS bonus_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS tax_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS spouse_doc_coordinates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

-- Data API権限の完全解放
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO service_role;

-- RLSポリシーの安全配備
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_read_system_settings" ON public.system_settings;
CREATE POLICY "allow_all_read_system_settings" ON public.system_settings
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "allow_auth_write_system_settings" ON public.system_settings;
CREATE POLICY "allow_auth_write_system_settings" ON public.system_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- レコードが1件も存在しない場合は初期行を作成
INSERT INTO public.system_settings (id, updated_at)
SELECT gen_random_uuid(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);

-- ------------------------------------------------------------------------------
-- 3. 店舗マスタ（store_masters）テーブルの作成と権限解放
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) DEFAULT NULL,
    department_name VARCHAR(100) DEFAULT NULL,
    manager_user_id UUID DEFAULT NULL,
    manager_user_name VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Data API権限の解放
GRANT SELECT ON public.store_masters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_masters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_masters TO service_role;

-- インデックス配備
CREATE INDEX IF NOT EXISTS idx_store_masters_tenant ON public.store_masters (tenant_id, display_order);

-- RLSポリシー配備
ALTER TABLE public.store_masters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_store_masters" ON public.store_masters;
CREATE POLICY "tenant_isolation_store_masters" ON public.store_masters
    FOR ALL TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
        OR (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'superadmin'
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
        OR (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'superadmin'
    );

-- ------------------------------------------------------------------------------
-- 4. ユーザーテーブル（users）への所属店舗カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS store_name VARCHAR(100) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_users_store ON public.users (tenant_id, store_name);

-- ------------------------------------------------------------------------------
-- 5. シフト設定テーブル（shift_settings）への店舗応援カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.shift_settings ADD COLUMN IF NOT EXISTS enable_store_help BOOLEAN DEFAULT false;

-- ------------------------------------------------------------------------------
-- 6. シフト実績・ドラフトテーブル（advanced_shifts）への勤務先店舗カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS store_name VARCHAR(100) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_advanced_shifts_store ON public.advanced_shifts (tenant_id, store_name, target_date);

-- ------------------------------------------------------------------------------
-- 7. シフト必要人数枠（advanced_shift_requirements）への店舗カラム追加
-- ------------------------------------------------------------------------------
ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS store_name VARCHAR(100) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_advanced_shift_reqs_store ON public.advanced_shift_requirements (tenant_id, store_name, day_of_week);

-- Data API権限の確実な解放
GRANT SELECT ON public.advanced_shift_requirements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advanced_shift_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advanced_shift_requirements TO service_role;

-- ------------------------------------------------------------------------------
-- 8. PostgREST スキーマキャッシュの即時リロード通知
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
