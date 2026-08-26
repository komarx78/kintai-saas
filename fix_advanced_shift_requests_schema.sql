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
ALTER TABLE public.advanced_shift_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'submitted';

ALTER TABLE public.advanced_shift_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_advanced_shift_requests_select" ON public.advanced_shift_requests;
CREATE POLICY "tenant_advanced_shift_requests_select" ON public.advanced_shift_requests FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_advanced_shift_requests_insert" ON public.advanced_shift_requests;
CREATE POLICY "tenant_advanced_shift_requests_insert" ON public.advanced_shift_requests FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_advanced_shift_requests_update" ON public.advanced_shift_requests;
CREATE POLICY "tenant_advanced_shift_requests_update" ON public.advanced_shift_requests FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_advanced_shift_requests_delete" ON public.advanced_shift_requests;
CREATE POLICY "tenant_advanced_shift_requests_delete" ON public.advanced_shift_requests FOR DELETE USING (tenant_id = get_user_tenant_id());

NOTIFY pgrst, 'reload schema';