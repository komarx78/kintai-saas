-- ============================================================================
-- 🏛️ 全サブシステム実DB永続化・端末間完全同期・存在保証マイグレーション
-- (Supabase SQL Editor で実行してください)
-- ============================================================================

-- 1. 公的帳票印字座標マスタ（system_settings）全6種のカラム存在保証
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS health_pension_acquisition_doc_coordinates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS health_pension_loss_doc_coordinates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS employment_acquisition_doc_coordinates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS employment_loss_doc_coordinates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS spouse_doc_coordinates JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS bonus_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 2. 店舗別シフト必要枠（advanced_shift_requirements）への store_name カラム配備
CREATE TABLE IF NOT EXISTS public.advanced_shift_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL,
    required_count INTEGER DEFAULT 1,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    target_date DATE DEFAULT NULL,
    store_name TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advanced_shift_requirements
    ADD COLUMN IF NOT EXISTS store_name TEXT DEFAULT NULL;

-- 3. 勤怠月次締めテーブル（attendance_monthly_closings）
CREATE TABLE IF NOT EXISTS public.attendance_monthly_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    status VARCHAR(20) DEFAULT 'closed',
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    summary JSONB DEFAULT '{}'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, year_month)
);

ALTER TABLE public.attendance_monthly_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_attendance_closings_all" ON public.attendance_monthly_closings;
CREATE POLICY "tenant_attendance_closings_all" ON public.attendance_monthly_closings FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 4. 資格手当マスタテーブル（company_qualification_masters）
CREATE TABLE IF NOT EXISTS public.company_qualification_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(150) NOT NULL,
    default_allowance INTEGER DEFAULT 0,
    category VARCHAR(50) DEFAULT '国家資格',
    description TEXT DEFAULT '',
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.company_qualification_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_qualifications_all" ON public.company_qualification_masters;
CREATE POLICY "tenant_qualifications_all" ON public.company_qualification_masters FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 5. テナント基本テーブル（tenants）への設定カラム存在保証
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS labor_contract_template_data JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS position_settings JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS shakai_hoken_settings JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS shakai_hoken_office_number TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS employment_insurance_office_number TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS labor_insurance_number TEXT DEFAULT '';

-- 6. 社員マスタ・給与プロファイルの存在保証
ALTER TABLE public.employee_onboarding_profiles
    ADD COLUMN IF NOT EXISTS health_standard_monthly_remuneration INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pension_standard_monthly_remuneration INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS resident_tax_monthly INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resident_tax_details JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS qualification_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS qualification_certificate_url TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS qualification_certificate_filename TEXT DEFAULT '';

ALTER TABLE public.employee_payroll_profiles
    ADD COLUMN IF NOT EXISTS health_standard_monthly_remuneration INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pension_standard_monthly_remuneration INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS resident_tax_monthly INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resident_tax_details JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS qualification_allowance INTEGER DEFAULT 0;

-- 7. Data API アクセス権限の確実な解放 (Supabase 2026年仕様)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO service_role;
GRANT SELECT ON public.system_settings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advanced_shift_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advanced_shift_requirements TO service_role;
GRANT SELECT ON public.advanced_shift_requirements TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_monthly_closings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_monthly_closings TO service_role;
GRANT SELECT ON public.attendance_monthly_closings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_qualification_masters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_qualification_masters TO service_role;
GRANT SELECT ON public.company_qualification_masters TO anon;

NOTIFY pgrst, 'reload schema';
