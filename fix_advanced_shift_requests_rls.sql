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