-- ============================================================================
-- 複数店舗対応・店舗間応援機能用 データベースマイグレーション
-- (Supabase SQL Editor で実行してください。実行しなくてもアプリ側で自動フォールバックが動作します)
-- ============================================================================

-- 1. shift_settings テーブルに店舗応援機能フラグを追加
ALTER TABLE public.shift_settings 
ADD COLUMN IF NOT EXISTS enable_store_help BOOLEAN DEFAULT false;

-- 2. advanced_shifts テーブルに勤務先店舗名（応援先店舗名）カラムを追加
ALTER TABLE public.advanced_shifts 
ADD COLUMN IF NOT EXISTS store_name VARCHAR(100) DEFAULT NULL;

-- 3. users テーブルに所属店舗名カラムを追加（総務・人事等の本部はNULL）
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS store_name VARCHAR(100) DEFAULT NULL;

-- 4. store_masters テーブルの作成（店舗・拠点マスタSSOT）
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

-- 5. インデックス作成（高速な店舗別検索用）
CREATE INDEX IF NOT EXISTS idx_advanced_shifts_store ON public.advanced_shifts (tenant_id, store_name, target_date);
CREATE INDEX IF NOT EXISTS idx_store_masters_tenant ON public.store_masters (tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_users_store ON public.users (tenant_id, store_name);

-- 6. RLS（行レベルセキュリティ）の有効化とテナント分離ポリシー
ALTER TABLE public.store_masters ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'store_masters' AND policyname = 'tenant_isolation_store_masters'
    ) THEN
        CREATE POLICY tenant_isolation_store_masters ON public.store_masters
            FOR ALL
            USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
            WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    END IF;
END $$;

-- 7. スキーマリロード通知
NOTIFY pgrst, 'reload schema';
