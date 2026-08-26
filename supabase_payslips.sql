-- ==============================================================================
-- Web給与明細（payslips）テーブル作成SQL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL, -- 例: '2026-08'
    payment_date DATE NOT NULL,      -- 例: '2026-08-25'
    
    -- 勤怠実績
    work_days NUMERIC DEFAULT 0,
    actual_hours NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    paid_leave_days NUMERIC DEFAULT 0,
    absence_days NUMERIC DEFAULT 0,

    -- 支給項目（Earnings）
    base_salary NUMERIC DEFAULT 0,           -- 基本給
    overtime_allowance NUMERIC DEFAULT 0,    -- 残業手当
    position_allowance NUMERIC DEFAULT 0,    -- 役職手当
    commuting_allowance NUMERIC DEFAULT 0,   -- 通勤手当（非課税）
    housing_allowance NUMERIC DEFAULT 0,     -- 住宅手当
    special_allowance NUMERIC DEFAULT 0,     -- 特別手当・精勤手当
    total_earnings NUMERIC DEFAULT 0,        -- 総支給額

    -- 控除項目（Deductions）
    health_insurance NUMERIC DEFAULT 0,      -- 健康保険料
    nursing_insurance NUMERIC DEFAULT 0,     -- 介護保険料
    pension_insurance NUMERIC DEFAULT 0,     -- 厚生年金保険料
    employment_insurance NUMERIC DEFAULT 0,  -- 雇用保険料
    income_tax NUMERIC DEFAULT 0,            -- 所得税
    resident_tax NUMERIC DEFAULT 0,          -- 住民税
    other_deductions NUMERIC DEFAULT 0,      -- その他控除
    total_deductions NUMERIC DEFAULT 0,      -- 控除合計額

    -- 差引手取り額（Net Pay）
    net_salary NUMERIC DEFAULT 0,            -- 差引支給額

    note TEXT,                               -- 備考・連絡事項
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' (下書き) | 'published' (公開済)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT unique_user_payslip_month UNIQUE (tenant_id, user_id, year_month)
);

-- RLS（Row Level Security）有効化
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- 従業員は「自分宛て」かつ「公開済（published）」の給与明細のみ閲覧可能
CREATE POLICY "Allow users to view own published payslips"
ON public.payslips
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    AND status = 'published'
);

-- 管理者は自社テナント内の全明細に対して全操作（登録・編集・削除・閲覧）可能
CREATE POLICY "Allow admins full access to tenant payslips"
ON public.payslips
FOR ALL
TO authenticated
USING (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    OR tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
    OR tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);
