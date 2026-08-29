-- ============================================================================
-- 入退社手続き・労務書類管理システム用 統合データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. employee_onboarding_profiles (入退社・労務詳細マスタ)
CREATE TABLE IF NOT EXISTS public.employee_onboarding_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- 入退社ステータス
    status VARCHAR(30) DEFAULT 'active', -- 'onboarding' (入社手続中), 'active' (在職中), 'offboarding' (退職手続中), 'retired' (退職済)
    join_date DATE NOT NULL, -- 入社年月日
    retirement_date DATE DEFAULT NULL, -- 退職年月日
    retirement_reason TEXT DEFAULT '', -- 退職事由
    
    -- 雇用契約・労働条件通知書項目
    contract_type VARCHAR(30) DEFAULT 'indefinite', -- 'indefinite' (無期雇用), 'fixed_term' (有期雇用)
    contract_start_date DATE DEFAULT NULL,
    contract_end_date DATE DEFAULT NULL,
    contract_renew_type VARCHAR(50) DEFAULT 'automatic', -- 'automatic' (自動更新), 'conditional' (更新する場合あり), 'none' (更新なし)
    trial_period_months INTEGER DEFAULT 3, -- 試用期間月数 (0: なし)
    work_location TEXT DEFAULT '本社 または 会社が指定する就業場所', -- 就業場所
    job_description TEXT DEFAULT '業務全般 および 会社の指示する業務', -- 従事すべき業務
    
    -- 労働時間・休日
    start_time VARCHAR(10) DEFAULT '09:00', -- 始業時刻
    end_time VARCHAR(10) DEFAULT '18:00', -- 終業時刻
    break_time_minutes INTEGER DEFAULT 60, -- 休憩時間 (分)
    overtime_work VARCHAR(50) DEFAULT 'あり', -- 時間外労働の有無 ('あり', 'なし')
    holidays_text TEXT DEFAULT '完全週休2日制（土日・祝日）、年末年始休暇、年次有給休暇', -- 休日
    paid_leave_grant_days INTEGER DEFAULT 10, -- 6ヶ月後有休付与日数
    
    -- 賃金・給与
    salary_type VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'hourly', 'daily'
    base_salary INTEGER DEFAULT 250000, -- 基本給または時給
    hourly_wage INTEGER DEFAULT 1100,
    position_allowance INTEGER DEFAULT 0,
    qualification_allowance INTEGER DEFAULT 0,
    housing_allowance INTEGER DEFAULT 0,
    family_allowance INTEGER DEFAULT 0,
    commuting_allowance INTEGER DEFAULT 15000,
    fixed_overtime_hours NUMERIC DEFAULT 0,
    fixed_overtime_allowance INTEGER DEFAULT 0,
    bonus_policy VARCHAR(50) DEFAULT 'あり（業績に応じて支給）', -- 賞与
    raise_policy VARCHAR(50) DEFAULT 'あり（年1回査定）', -- 昇給
    retirement_allowance VARCHAR(50) DEFAULT 'なし', -- 退職金制度
    
    -- 社会保険・雇用保険
    health_insurance_joined BOOLEAN DEFAULT true,
    pension_insurance_joined BOOLEAN DEFAULT true,
    employment_insurance_joined BOOLEAN DEFAULT true,
    workers_comp_joined BOOLEAN DEFAULT true,
    
    -- 書類回収チェックリスト (JSONB)
    documents_checklist JSONB DEFAULT '{
      "id_copy": false,
      "my_number": false,
      "pension_handbook": false,
      "employment_insurance_card": false,
      "withholding_tax_slip": false,
      "bank_account_copy": false,
      "labor_contract_signed": false
    }'::jsonb,
    
    -- 労務手続きToDo進捗 (JSONB)
    procedure_todo JSONB DEFAULT '{
      "nenkin_office_submitted": false,
      "hellowork_submitted": false,
      "resident_tax_switched": false
    }'::jsonb,
    
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.employee_onboarding_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_onboarding_all" ON public.employee_onboarding_profiles;
CREATE POLICY "tenant_onboarding_all" ON public.employee_onboarding_profiles FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

NOTIFY pgrst, 'reload schema';
