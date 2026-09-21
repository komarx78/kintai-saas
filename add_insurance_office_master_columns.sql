-- ============================================================================
-- 社会保険・労働保険 事業所マスタ（記号・番号・労働保険番号）一元化マイグレーション
-- (Supabase SQL Editor で一度だけ実行してください。何度実行しても安全です)
-- ============================================================================

-- 1. tenants テーブルに社会保険・雇用保険・労働保険の事業所情報カラムを配備
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS shakai_hoken_settings JSONB DEFAULT '{
  "office_symbol": "",
  "office_number": ""
}'::jsonb,
ADD COLUMN IF NOT EXISTS shakai_hoken_office_number VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS employment_insurance_office_number VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS labor_insurance_number VARCHAR(50) DEFAULT '';

-- 2. company_master_settings テーブルにも同様のカラムを配備（SSOT二重防壁）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_master_settings') THEN
        ALTER TABLE public.company_master_settings
        ADD COLUMN IF NOT EXISTS shakai_hoken_office_symbol VARCHAR(50) DEFAULT '',
        ADD COLUMN IF NOT EXISTS shakai_hoken_office_number VARCHAR(50) DEFAULT '',
        ADD COLUMN IF NOT EXISTS employment_insurance_office_number VARCHAR(50) DEFAULT '',
        ADD COLUMN IF NOT EXISTS labor_insurance_number VARCHAR(50) DEFAULT '';
    END IF;
END $$;

-- 3. スキーマキャッシュの即時リロード
NOTIFY pgrst, 'reload schema';
