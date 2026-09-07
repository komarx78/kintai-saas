-- ============================================================================
-- 🚀 昇給履歴・労働条件通知書・給与プロファイル 全PC完全同期マイグレーション
-- (Supabase SQL Editor に貼り付けて「Run」を実行してください)
-- ============================================================================

-- 1. tenants テーブルへのカラム追加（労働条件通知書・全社設定）
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS revision_contracts_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS company_seal_url TEXT,
ADD COLUMN IF NOT EXISTS labor_contract_template JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS portal_announcements_data JSONB DEFAULT '[]'::jsonb;

-- 2. 昇給・給与改定履歴テーブル (salary_revision_history) の作成
CREATE TABLE IF NOT EXISTS public.salary_revision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    revision_date DATE NOT NULL,
    applied_year_month VARCHAR(7) NOT NULL,
    revision_type VARCHAR(50) NOT NULL DEFAULT 'regular',
    previous_base_salary NUMERIC NOT NULL DEFAULT 0,
    new_base_salary NUMERIC NOT NULL DEFAULT 0,
    diff_base_salary NUMERIC NOT NULL DEFAULT 0,
    previous_total_allowance NUMERIC NOT NULL DEFAULT 0,
    new_total_allowance NUMERIC NOT NULL DEFAULT 0,
    previous_total_salary NUMERIC NOT NULL DEFAULT 0,
    new_total_salary NUMERIC NOT NULL DEFAULT 0,
    diff_total_salary NUMERIC NOT NULL DEFAULT 0,
    revision_rate NUMERIC DEFAULT 0,
    allowance_details JSONB DEFAULT '{}'::jsonb,
    reason_note TEXT,
    approved_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_salary_revision_tenant ON public.salary_revision_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_salary_revision_user ON public.salary_revision_history(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_revision_date ON public.salary_revision_history(revision_date DESC);

-- 3. 従業員給与プロファイルテーブル (employee_payroll_profiles) の作成（未存在時）
CREATE TABLE IF NOT EXISTS public.employee_payroll_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    salary_type VARCHAR(20) DEFAULT 'monthly',
    base_salary INTEGER DEFAULT 250000,
    hourly_wage INTEGER DEFAULT 1150,
    position_allowance INTEGER DEFAULT 0,
    qualification_allowance INTEGER DEFAULT 0,
    housing_allowance INTEGER DEFAULT 0,
    family_allowance INTEGER DEFAULT 0,
    commuting_allowance INTEGER DEFAULT 15000,
    commuting_taxable BOOLEAN DEFAULT false,
    fixed_overtime_hours NUMERIC DEFAULT 0,
    fixed_overtime_allowance INTEGER DEFAULT 0,
    dependents_count INTEGER DEFAULT 0,
    health_insurance_enabled BOOLEAN DEFAULT true,
    health_standard_monthly_remuneration INTEGER DEFAULT NULL,
    nursing_insurance_enabled BOOLEAN DEFAULT NULL,
    pension_insurance_enabled BOOLEAN DEFAULT true,
    pension_standard_monthly_remuneration INTEGER DEFAULT NULL,
    employment_insurance_enabled BOOLEAN DEFAULT true,
    resident_tax_monthly INTEGER DEFAULT 0,
    tax_bracket VARCHAR(10) DEFAULT 'kou',
    bank_name VARCHAR(100) DEFAULT '',
    branch_name VARCHAR(100) DEFAULT '',
    account_type VARCHAR(20) DEFAULT 'ordinary',
    account_number VARCHAR(20) DEFAULT '',
    account_holder VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- 4. RLS（Row Level Security）ポリシーの整備

-- tenants テーブルの更新・参照権限
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
CREATE POLICY "Users can view own tenant" ON public.tenants
    FOR SELECT USING (
        id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
    );

DROP POLICY IF EXISTS "Admins can update own tenant" ON public.tenants;
CREATE POLICY "Admins can update own tenant" ON public.tenants
    FOR UPDATE USING (
        id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin'))
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- salary_revision_history テーブルの権限（同一テナント内で完全同期）
ALTER TABLE public.salary_revision_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for salary_revision_history" ON public.salary_revision_history;
CREATE POLICY "Tenant isolation for salary_revision_history" ON public.salary_revision_history
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- employee_payroll_profiles テーブルの権限
ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_emp_payroll_all" ON public.employee_payroll_profiles;
CREATE POLICY "tenant_emp_payroll_all" ON public.employee_payroll_profiles
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
    );

-- 5. スキーマキャッシュの即時リロード通知
NOTIFY pgrst, 'reload schema';
