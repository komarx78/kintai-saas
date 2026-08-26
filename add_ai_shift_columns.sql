CREATE TABLE IF NOT EXISTS public.shift_employee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    hire_date DATE,
    max_hours_per_week INTEGER DEFAULT 40,
    priority_score INTEGER DEFAULT 3, -- 1(低) 〜 5(高)
    default_role VARCHAR(100),
    base_wage INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shift_employee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_shift_employee_settings_select" ON public.shift_employee_settings
    FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_shift_employee_settings_insert" ON public.shift_employee_settings
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_shift_employee_settings_update" ON public.shift_employee_settings
    FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_shift_employee_settings_delete" ON public.shift_employee_settings
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- 既存の shift_settings テーブルに AI自動生成モード を追加
ALTER TABLE public.shift_settings ADD COLUMN IF NOT EXISTS auto_generation_mode VARCHAR(50) DEFAULT 'equal';

-- 既存の advanced_shift_requests から preferred_role を削除（使わないため）
-- (今回は残しておいても良いですが、UIからは消します)