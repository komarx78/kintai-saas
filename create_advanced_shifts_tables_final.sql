-- ============================================================================
-- 高度シフト管理機能用 統合データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. テナントID取得関数 (存在しない場合のみ作成)
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. shift_roles (役割マスタ)
CREATE TABLE IF NOT EXISTS public.shift_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#4F46E5',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE public.shift_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_shift_roles_all" ON public.shift_roles;
CREATE POLICY "tenant_shift_roles_all" ON public.shift_roles FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 3. shift_settings (シフト設定・人件費予算)
CREATE TABLE IF NOT EXISTS public.shift_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    monthly_labor_budget INTEGER DEFAULT 0,
    shift_period VARCHAR(20) DEFAULT '1week',
    shift_start_day VARCHAR(20) DEFAULT 'monday',
    submission_deadline_rule TEXT DEFAULT '',
    is_submission_locked BOOLEAN DEFAULT false,
    auto_lock_day INTEGER DEFAULT NULL,
    auto_lock_days VARCHAR(50) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shift_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_shift_settings_all" ON public.shift_settings;
CREATE POLICY "tenant_shift_settings_all" ON public.shift_settings FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 4. shift_employee_settings (従業員の時給・希望上限)
CREATE TABLE IF NOT EXISTS public.shift_employee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    hourly_wage INTEGER DEFAULT 1100,
    max_weekly_hours INTEGER DEFAULT 40,
    roles JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.shift_employee_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_shift_emp_settings_all" ON public.shift_employee_settings;
CREATE POLICY "tenant_shift_emp_settings_all" ON public.shift_employee_settings FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 5. advanced_shift_requirements (必要枠設定)
CREATE TABLE IF NOT EXISTS public.advanced_shift_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    target_date DATE,
    day_of_week INTEGER,
    role VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    required_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advanced_shift_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_req_all" ON public.advanced_shift_requirements;
CREATE POLICY "tenant_req_all" ON public.advanced_shift_requirements FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 6. advanced_shift_requests (高度シフト希望提出)
CREATE TABLE IF NOT EXISTS public.advanced_shift_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    available_start_time TIME,
    available_end_time TIME,
    preferred_role VARCHAR(100),
    status VARCHAR(50) DEFAULT 'submitted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advanced_shift_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_reqs_all" ON public.advanced_shift_requests;
CREATE POLICY "tenant_reqs_all" ON public.advanced_shift_requests FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 7. advanced_shifts (高度シフト確定データ)
CREATE TABLE IF NOT EXISTS public.advanced_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    role VARCHAR(100),
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advanced_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_shifts_all" ON public.advanced_shifts;
CREATE POLICY "tenant_shifts_all" ON public.advanced_shifts FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

NOTIFY pgrst, 'reload schema';