-- ============================================================================
-- クラウド給与計算システム用 統合データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. payroll_settings (会社給与基本設定)
CREATE TABLE IF NOT EXISTS public.payroll_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    closing_day VARCHAR(20) DEFAULT 'end_of_month', -- 'end_of_month', '20', '25' 等
    payment_month VARCHAR(20) DEFAULT 'current', -- 'current' (当月), 'next' (翌月)
    payment_day VARCHAR(20) DEFAULT '25', -- '25', '10', 'end_of_month'
    employment_insurance_rate NUMERIC DEFAULT 0.006, -- 雇用保険料率（一般事業 6/1000）
    health_insurance_rate NUMERIC DEFAULT 0.05, -- 健康保険料率（折半後 約5%）
    nursing_insurance_rate NUMERIC DEFAULT 0.009, -- 介護保険料率（折半後 約0.9%）
    pension_insurance_rate NUMERIC DEFAULT 0.0915, -- 厚生年金保険料率（折半後 9.15%）
    rounding_method VARCHAR(20) DEFAULT 'floor', -- 'floor' (切捨), 'round' (四捨五入)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_payroll_settings_all" ON public.payroll_settings;
CREATE POLICY "tenant_payroll_settings_all" ON public.payroll_settings FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 2. employee_payroll_profiles (従業員給与マスタ設定)
CREATE TABLE IF NOT EXISTS public.employee_payroll_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    salary_type VARCHAR(20) DEFAULT 'monthly', -- 'monthly' (月給), 'hourly' (時給), 'daily' (日給)
    base_salary INTEGER DEFAULT 250000, -- 基本給または時給単価
    hourly_wage INTEGER DEFAULT 1100, -- 時給制の場合の時給単価
    position_allowance INTEGER DEFAULT 0, -- 役職手当
    qualification_allowance INTEGER DEFAULT 0, -- 資格・職能手当
    housing_allowance INTEGER DEFAULT 0, -- 住宅手当
    family_allowance INTEGER DEFAULT 0, -- 家族・扶養手当
    commuting_allowance INTEGER DEFAULT 15000, -- 通勤手当
    commuting_taxable BOOLEAN DEFAULT false, -- 通勤手当が課税対象か（通常非課税）
    fixed_overtime_hours NUMERIC DEFAULT 0, -- 固定残業時間（みなし残業時間）
    fixed_overtime_allowance INTEGER DEFAULT 0, -- 固定残業代手当
    dependents_count INTEGER DEFAULT 0, -- 扶養親族等の数（所得税の甲欄計算用）
    health_insurance_enabled BOOLEAN DEFAULT true, -- 健康保険加入
    health_standard_monthly_remuneration INTEGER DEFAULT NULL, -- 健康保険 標準報酬月額
    nursing_insurance_enabled BOOLEAN DEFAULT false, -- 介護保険（40歳以上）
    pension_insurance_enabled BOOLEAN DEFAULT true, -- 厚生年金加入
    pension_standard_monthly_remuneration INTEGER DEFAULT NULL, -- 厚生年金 標準報酬月額
    employment_insurance_enabled BOOLEAN DEFAULT true, -- 雇用保険加入
    resident_tax_monthly INTEGER DEFAULT 0, -- 毎月の住民税特別徴収額
    tax_bracket VARCHAR(10) DEFAULT 'kou', -- 'kou' (甲欄), 'otsu' (乙欄), 'hei' (丙欄)
    bank_name VARCHAR(100) DEFAULT '',
    branch_name VARCHAR(100) DEFAULT '',
    account_type VARCHAR(20) DEFAULT 'ordinary', -- 'ordinary' (普通), 'current' (当座)
    account_number VARCHAR(20) DEFAULT '',
    account_holder VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.employee_payroll_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_emp_payroll_all" ON public.employee_payroll_profiles;
CREATE POLICY "tenant_emp_payroll_all" ON public.employee_payroll_profiles FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 3. payslips (給与明細テーブルの拡張)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    year_month VARCHAR(10) NOT NULL, -- '2026-08'
    payment_date DATE NOT NULL,
    salary_type VARCHAR(20) DEFAULT 'monthly',
    
    -- 勤怠実績
    work_days NUMERIC DEFAULT 0,
    actual_hours NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    midnight_hours NUMERIC DEFAULT 0,
    holiday_hours NUMERIC DEFAULT 0,
    paid_leave_days NUMERIC DEFAULT 0,
    absence_days NUMERIC DEFAULT 0,
    late_early_hours NUMERIC DEFAULT 0,

    -- 支給項目
    base_salary INTEGER DEFAULT 0,
    hourly_wage INTEGER DEFAULT 0,
    overtime_allowance INTEGER DEFAULT 0,
    midnight_allowance INTEGER DEFAULT 0,
    holiday_allowance INTEGER DEFAULT 0,
    position_allowance INTEGER DEFAULT 0,
    qualification_allowance INTEGER DEFAULT 0,
    housing_allowance INTEGER DEFAULT 0,
    family_allowance INTEGER DEFAULT 0,
    commuting_allowance INTEGER DEFAULT 0,
    special_allowance INTEGER DEFAULT 0,
    absence_deduction INTEGER DEFAULT 0, -- 欠勤控除
    late_early_deduction INTEGER DEFAULT 0, -- 遅刻早退控除
    total_earnings INTEGER DEFAULT 0, -- 総支給額

    -- 控除項目
    health_insurance INTEGER DEFAULT 0,
    nursing_insurance INTEGER DEFAULT 0,
    pension_insurance INTEGER DEFAULT 0,
    employment_insurance INTEGER DEFAULT 0,
    income_tax INTEGER DEFAULT 0,
    resident_tax INTEGER DEFAULT 0,
    other_deductions INTEGER DEFAULT 0,
    total_deductions INTEGER DEFAULT 0, -- 総控除額

    -- 差引支給額（手取り）
    net_salary INTEGER DEFAULT 0,

    note TEXT DEFAULT '今月も勤務お疲れ様でした。',
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, year_month)
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_payslips_all" ON public.payslips;
CREATE POLICY "tenant_payslips_all" ON public.payslips FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

NOTIFY pgrst, 'reload schema';
