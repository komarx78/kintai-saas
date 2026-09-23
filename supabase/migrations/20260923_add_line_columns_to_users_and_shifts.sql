-- ==============================================================================
-- 🏛️ users & shifts テーブル LINE連携・通知ログ基盤カラム・テーブル追加
-- 完全冪等性保証（何度Runしてもエラーゼロ・IF NOT EXISTS / DOブロック対応）
-- ==============================================================================

-- 1. users テーブルへの LINE 連携用カラム追加
DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'line_user_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_user_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'line_display_name'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_display_name text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'line_picture_url'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_picture_url text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'line_linked_at'
    ) THEN
        ALTER TABLE public.users ADD COLUMN line_linked_at timestamptz;
    END IF;
END $block$;

-- 2. users テーブルの line_user_id 検索インデックス
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON public.users(line_user_id);

-- 3. shifts テーブルへの LINE 送信済み追跡カラム追加
DO $block$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'shifts'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'shifts' 
              AND column_name = 'line_notified_at'
        ) THEN
            ALTER TABLE public.shifts ADD COLUMN line_notified_at timestamptz;
        END IF;
    END IF;
END $block$;

-- 4. LINE送信ログ管理テーブルの作成（監査・履歴保持用）
CREATE TABLE IF NOT EXISTS public.line_notification_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    recipient_user_id uuid,
    notification_type text NOT NULL DEFAULT 'confirmed_shift',
    period_label text,
    shift_count integer DEFAULT 0,
    total_hours numeric(5,2) DEFAULT 0,
    message_body text,
    status text NOT NULL DEFAULT 'sent',
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. ログテーブルのインデックス設定
CREATE INDEX IF NOT EXISTS idx_line_logs_tenant_created 
    ON public.line_notification_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_logs_recipient 
    ON public.line_notification_logs(recipient_user_id);

-- 6. RLS (Row Level Security) 設定
ALTER TABLE public.line_notification_logs ENABLE ROW LEVEL SECURITY;

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'line_notification_logs' 
          AND policyname = 'Users can view their tenant line logs'
    ) THEN
        CREATE POLICY "Users can view their tenant line logs"
            ON public.line_notification_logs
            FOR SELECT
            USING (
                tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
                OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'line_notification_logs' 
          AND policyname = 'Users can insert their tenant line logs'
    ) THEN
        CREATE POLICY "Users can insert their tenant line logs"
            ON public.line_notification_logs
            FOR INSERT
            WITH CHECK (
                tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
                OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
            );
    END IF;
END $block$;

-- 7. PostgREST スキーマキャッシュの即時リロード通知
NOTIFY pgrst, 'reload schema';
