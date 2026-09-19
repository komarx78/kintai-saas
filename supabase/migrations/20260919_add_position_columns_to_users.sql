-- ==============================================================================
-- 🏛️ 孔明軍団 司馬懿DB防壁: usersテーブル 役職カラム追加 ＆ スキーマキャッシュ更新
-- 完全冪等性保証（何度Runしてもエラーゼロ・IF NOT EXISTS）
-- ==============================================================================

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'position_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN position_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'position_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN position_name text;
    END IF;
END $block$;

CREATE INDEX IF NOT EXISTS idx_users_tenant_position ON public.users(tenant_id, position_id);

NOTIFY pgrst, 'reload schema';
