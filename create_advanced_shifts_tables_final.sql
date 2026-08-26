-- 1. advanced_shift_requirements
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

ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS day_of_week INTEGER;
ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS role VARCHAR(100);
ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.advanced_shift_requirements ADD COLUMN IF NOT EXISTS required_count INTEGER DEFAULT 1;

ALTER TABLE public.advanced_shift_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_req_all" ON public.advanced_shift_requirements;
CREATE POLICY "tenant_req_all" ON public.advanced_shift_requirements FOR ALL USING (tenant_id = get_user_tenant_id());


-- 2. advanced_shift_requests
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

ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS available_start_time TIME;
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS available_end_time TIME;
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS preferred_role VARCHAR(100);
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'submitted';

ALTER TABLE public.advanced_shift_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_reqs_all" ON public.advanced_shift_requests;
CREATE POLICY "tenant_reqs_all" ON public.advanced_shift_requests FOR ALL USING (tenant_id = get_user_tenant_id());


-- 3. advanced_shifts
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

ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS role VARCHAR(100);
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.advanced_shifts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'confirmed';

ALTER TABLE public.advanced_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_shifts_all" ON public.advanced_shifts;
CREATE POLICY "tenant_shifts_all" ON public.advanced_shifts FOR ALL USING (tenant_id = get_user_tenant_id());

NOTIFY pgrst, 'reload schema';