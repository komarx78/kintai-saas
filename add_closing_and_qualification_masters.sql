-- ============================================================================
-- 勤怠月次締め・全社資格手当マスタ・従業員標準報酬月額/住民税/資格証憑 統合マイグレーション
-- (Supabase SQL Editor で実行してください)
-- ============================================================================

-- 1. 勤怠月次締めテーブル (attendance_monthly_closings)
CREATE TABLE IF NOT EXISTS public.attendance_monthly_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    year_month VARCHAR(7) NOT NULL, -- '2026-08', '2026-09'
    status VARCHAR(20) DEFAULT 'closed', -- 'closed' (締め確定), 'open' (未締め/解除)
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    summary JSONB DEFAULT '{}'::jsonb, -- 確定時の全社集計サマリー（総勤務日数、総時間等）
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, year_month)
);

ALTER TABLE public.attendance_monthly_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_attendance_closings_all" ON public.attendance_monthly_closings;
CREATE POLICY "tenant_attendance_closings_all" ON public.attendance_monthly_closings FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 2. 全社資格手当マスタテーブル (company_qualification_masters)
CREATE TABLE IF NOT EXISTS public.company_qualification_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(150) NOT NULL, -- 資格名（例: 第一種衛生管理者, 宅地建物取引士, 日商簿記2級）
    default_allowance INTEGER DEFAULT 0, -- 標準手当月額 (円)
    category VARCHAR(50) DEFAULT '国家資格', -- 資格区分（国家資格、公的資格、民間資格、社内認定等）
    description TEXT DEFAULT '', -- 説明・備考・手当支給要件
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.company_qualification_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_qualifications_all" ON public.company_qualification_masters;
CREATE POLICY "tenant_qualifications_all" ON public.company_qualification_masters FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 3. 大元従業員マスタ (employee_onboarding_profiles) へのカラム追加
ALTER TABLE public.employee_onboarding_profiles
    ADD COLUMN IF NOT EXISTS health_standard_monthly_remuneration INTEGER DEFAULT NULL, -- 健康保険 標準報酬月額
    ADD COLUMN IF NOT EXISTS pension_standard_monthly_remuneration INTEGER DEFAULT NULL, -- 厚生年金 標準報酬月額
    ADD COLUMN IF NOT EXISTS resident_tax_monthly INTEGER DEFAULT 0, -- 住民税 特別徴収月額
    ADD COLUMN IF NOT EXISTS qualification_name TEXT DEFAULT '', -- 取得資格名
    ADD COLUMN IF NOT EXISTS qualification_certificate_url TEXT DEFAULT '', -- 合格証・証明書（写メ圧縮/PDF Base64またはURL）
    ADD COLUMN IF NOT EXISTS qualification_certificate_filename TEXT DEFAULT ''; -- 合格証ファイル名

-- 4. 給与マスタ (employee_payroll_profiles) のカラム補強（存在保証）
ALTER TABLE public.employee_payroll_profiles
    ADD COLUMN IF NOT EXISTS health_standard_monthly_remuneration INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pension_standard_monthly_remuneration INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS resident_tax_monthly INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qualification_allowance INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
