-- ============================================================================
-- SaaS全端末完全同期化 マイグレーションSQL
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- tenants テーブルに全社共有用JSONBカラムを追加
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS revision_contracts_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS portal_announcements_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS labor_contract_template_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS qualification_masters_data JSONB DEFAULT '[]'::jsonb;

-- スキーマキャッシュの即時リロード
NOTIFY pgrst, 'reload schema';
