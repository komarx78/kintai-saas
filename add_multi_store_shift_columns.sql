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

-- 3. インデックス作成（高速な店舗別検索用）
CREATE INDEX IF NOT EXISTS idx_advanced_shifts_store ON public.advanced_shifts (tenant_id, store_name, target_date);

-- 4. スキーマリロード通知
NOTIFY pgrst, 'reload schema';
