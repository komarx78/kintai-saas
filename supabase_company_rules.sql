-- ==============================================================================
-- 就業規則・社内規定（company_rules）テーブル作成SQL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.company_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL DEFAULT '就業規則',
    content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_tenant_title UNIQUE (tenant_id, title)
);

-- RLS（Row Level Security）有効化
ALTER TABLE public.company_rules ENABLE ROW LEVEL SECURITY;

-- テナント内ユーザーに対するSELECTポリシー（全社閲覧可能）
CREATE POLICY "Allow select for tenant users"
ON public.company_rules
FOR SELECT
TO authenticated
USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    OR tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

-- 管理者に対するALLポリシー（挿入・更新・削除）
CREATE POLICY "Allow all for tenant admins"
ON public.company_rules
FOR ALL
TO authenticated
USING (
    (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
     OR tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
)
WITH CHECK (
    (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
     OR tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
);
