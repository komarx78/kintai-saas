-- ============================================================================
-- 🏛️ 日本年金機構 被保険者報酬月額変更届（コード2221様式）印字座標カラム配備
-- ============================================================================

-- 1. 全社・SuperAdmin共通設定テーブル（system_settings）へのカラム存在保証
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS monthly_revision_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 2. テナント個別設定テーブル（tenants）へのカラム存在保証
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS monthly_revision_doc_coordinates JSONB DEFAULT '[]'::jsonb;
