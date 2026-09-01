-- =========================================================================
-- 🏢 社印印影・労働条件通知書テンプレート・全社マスタカラム拡張 SQL
-- Supabase の SQL Editor に貼り付けて「Run」を実行してください。
-- =========================================================================

-- 1. tenants テーブルへのカラム追加（社印画像、労働条件通知書テンプレート）
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS company_seal_url TEXT,
ADD COLUMN IF NOT EXISTS labor_contract_template JSONB DEFAULT '{}'::jsonb;

-- 2. company_master_settings テーブルが存在する場合の拡張
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'company_master_settings') THEN
        ALTER TABLE public.company_master_settings
        ADD COLUMN IF NOT EXISTS company_seal_url TEXT,
        ADD COLUMN IF NOT EXISTS labor_contract_template JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. 権限（RLS / Grants）のリフレッシュ
GRANT ALL ON TABLE public.tenants TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
