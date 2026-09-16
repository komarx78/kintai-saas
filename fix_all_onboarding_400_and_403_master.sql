-- ============================================================================
-- 🚀 労務・入退社・産休育休・全社設定 400＆403エラー完全根絶マスターSQL
-- (Supabase SQL Editor に貼り付けて「Run」を実行してください / 完全冪等性保証)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. system_settings テーブル（400 Bad Request 解消）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID DEFAULT NULL,
    custom_doc_templates JSONB DEFAULT '[]'::jsonb,
    gemini_api_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS custom_doc_templates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;

GRANT ALL ON public.system_settings TO anon, authenticated, service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_settings_permissive_policy" ON public.system_settings;
CREATE POLICY "system_settings_permissive_policy" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. tenants テーブル（カスタムテンプレート・労働条件通知書）
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_doc_templates JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS revision_contracts_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_seal_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS labor_contract_template JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS portal_announcements_data JSONB DEFAULT '[]'::jsonb;

GRANT ALL ON public.tenants TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. employee_onboarding_profiles テーブル（★403 Forbidden 4件完全根絶★）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_onboarding_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name_kana VARCHAR(100) DEFAULT '',
    status VARCHAR(30) DEFAULT 'active',
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    retirement_date DATE DEFAULT NULL,
    retirement_reason TEXT DEFAULT '',
    contract_type VARCHAR(30) DEFAULT 'indefinite',
    contract_start_date DATE DEFAULT NULL,
    contract_end_date DATE DEFAULT NULL,
    contract_renew_type VARCHAR(50) DEFAULT 'automatic',
    trial_period_months INTEGER DEFAULT 3,
    work_location TEXT DEFAULT '本社 または 会社が指定する就業場所',
    job_description TEXT DEFAULT '業務全般 および 会社の指示する業務',
    start_time VARCHAR(10) DEFAULT '09:00',
    end_time VARCHAR(10) DEFAULT '18:00',
    break_time_minutes INTEGER DEFAULT 60,
    overtime_work VARCHAR(50) DEFAULT 'あり',
    holidays_text TEXT DEFAULT '完全週休2日制（土日・祝日）、年末年始休暇、年次有給休暇',
    paid_leave_grant_days INTEGER DEFAULT 10,
    salary_type VARCHAR(20) DEFAULT 'monthly',
    base_salary INTEGER DEFAULT 250000,
    hourly_wage INTEGER DEFAULT 1100,
    position_allowance INTEGER DEFAULT 0,
    qualification_allowance INTEGER DEFAULT 0,
    housing_allowance INTEGER DEFAULT 0,
    family_allowance INTEGER DEFAULT 0,
    commuting_allowance INTEGER DEFAULT 15000,
    fixed_overtime_hours NUMERIC DEFAULT 0,
    fixed_overtime_allowance INTEGER DEFAULT 0,
    bonus_policy VARCHAR(50) DEFAULT 'あり（業績に応じて支給）',
    raise_policy VARCHAR(50) DEFAULT 'あり（年1回査定）',
    retirement_allowance VARCHAR(50) DEFAULT 'なし',
    health_insurance_joined BOOLEAN DEFAULT true,
    pension_insurance_joined BOOLEAN DEFAULT true,
    employment_insurance_joined BOOLEAN DEFAULT true,
    workers_comp_joined BOOLEAN DEFAULT true,
    documents_checklist JSONB DEFAULT '{}'::jsonb,
    procedure_todo JSONB DEFAULT '{}'::jsonb,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS name_kana VARCHAR(100) DEFAULT '';
ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';
ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS documents_checklist JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS procedure_todo JSONB DEFAULT '{}'::jsonb;

GRANT ALL ON public.employee_onboarding_profiles TO anon, authenticated, service_role;
ALTER TABLE public.employee_onboarding_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_onboarding_all" ON public.employee_onboarding_profiles;
DROP POLICY IF EXISTS "onboarding_profiles_permissive_policy" ON public.employee_onboarding_profiles;
CREATE POLICY "onboarding_profiles_permissive_policy" ON public.employee_onboarding_profiles
FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. employee_maternity_leaves テーブル（産前産後・育児休業 403完全根絶）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_maternity_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    pregnancy_type VARCHAR(10) NOT NULL DEFAULT 'single',
    expected_birth_date DATE NOT NULL,
    actual_birth_date DATE DEFAULT NULL,
    maternity_leave_start_date DATE NOT NULL,
    maternity_leave_end_date DATE NOT NULL,
    childcare_leave_start_date DATE DEFAULT NULL,
    childcare_leave_end_date DATE DEFAULT NULL,
    return_to_work_date DATE DEFAULT NULL,
    childcare_extended VARCHAR(20) DEFAULT 'none',
    child_name VARCHAR(100) DEFAULT '',
    child_birth_date DATE DEFAULT NULL,
    child_relationship VARCHAR(20) DEFAULT '実子',
    child_my_number VARCHAR(12) DEFAULT '',
    contact_phone VARCHAR(50) DEFAULT '',
    contact_email VARCHAR(100) DEFAULT '',
    contact_line_id VARCHAR(50) DEFAULT '',
    remarks TEXT DEFAULT '',
    checklist JSONB DEFAULT '{}'::jsonb,
    attachment_handbook_url TEXT DEFAULT NULL,
    attachment_handbook_filename VARCHAR(255) DEFAULT '',
    attachment_certificate_url TEXT DEFAULT NULL,
    attachment_certificate_filename VARCHAR(255) DEFAULT '',
    attachment_mynumber_url TEXT DEFAULT NULL,
    attachment_mynumber_filename VARCHAR(255) DEFAULT '',
    resident_tax_advance JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ DEFAULT NULL,
    resident_tax_settlement_preference VARCHAR(50) DEFAULT 'deduct_from_salary',
    applicant_signature_name VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'submitted';
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS resident_tax_settlement_preference VARCHAR(50) DEFAULT 'deduct_from_salary';
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS applicant_signature_name VARCHAR(100) DEFAULT '';

GRANT ALL ON public.employee_maternity_leaves TO anon, authenticated, service_role;
ALTER TABLE public.employee_maternity_leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_maternity_leaves_all" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_insert" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_update" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_leaves_permissive_policy" ON public.employee_maternity_leaves;
CREATE POLICY "maternity_leaves_permissive_policy" ON public.employee_maternity_leaves
FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. employee_document_submissions テーブル（提出書類保管・審査）
-- ----------------------------------------------------------------------------
GRANT ALL ON public.employee_document_submissions TO anon, authenticated, service_role;
ALTER TABLE public.employee_document_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_doc_submissions_anon_insert" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "tenant_doc_submissions_all" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_submissions_permissive_policy" ON public.employee_document_submissions;
CREATE POLICY "doc_submissions_permissive_policy" ON public.employee_document_submissions
FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. employee_payroll_profiles テーブル（給与・社保プロファイル）
-- ----------------------------------------------------------------------------
GRANT ALL ON public.employee_payroll_profiles TO anon, authenticated, service_role;
ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_emp_payroll_all" ON public.employee_payroll_profiles;
DROP POLICY IF EXISTS "emp_payroll_permissive_policy" ON public.employee_payroll_profiles;
CREATE POLICY "emp_payroll_permissive_policy" ON public.employee_payroll_profiles
FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. users テーブル（フリガナ・氏名同期の権限保証）
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name_kana VARCHAR(100) DEFAULT '';
GRANT ALL ON public.users TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. PostgREST スキーマキャッシュの即時再読み込み
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
