-- 役割（ロール）マスタテーブル
CREATE TABLE IF NOT EXISTS public.shift_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#4F46E5', -- カレンダーでの表示色（Tailwindのクラス名やHex）
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE public.shift_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_shift_roles_select" ON public.shift_roles
    FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_shift_roles_insert" ON public.shift_roles
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_shift_roles_update" ON public.shift_roles
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_shift_roles_delete" ON public.shift_roles
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- 人件費予算などのシフト管理設定テーブル
CREATE TABLE IF NOT EXISTS public.shift_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    monthly_labor_budget INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shift_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_shift_settings_select" ON public.shift_settings
    FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_shift_settings_insert" ON public.shift_settings
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_shift_settings_update" ON public.shift_settings
    FOR UPDATE USING (tenant_id = get_user_tenant_id());