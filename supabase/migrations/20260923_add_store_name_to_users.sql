-- ==============================================================================
-- 🏛️ usersテーブル 所属店舗カラム（store_name）追加 ＆ スキーマキャッシュ更新
-- 完全冪等性保証（何度Runしてもエラーゼロ・IF NOT EXISTS）
-- ==============================================================================

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'store_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN store_name text;
    END IF;
END $block$;

CREATE INDEX IF NOT EXISTS idx_users_tenant_store ON public.users(tenant_id, store_name);

NOTIFY pgrst, 'reload schema';
