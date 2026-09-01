-- ============================================================================
-- payslips テーブル 不足カラム一括追加＆制約完全対応スクリプト
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

DO $$
BEGIN
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS absence_deduction INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS late_early_deduction INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS special_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS hourly_wage INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS late_early_hours NUMERIC DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS midnight_hours NUMERIC DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS holiday_hours NUMERIC DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS midnight_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS holiday_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS position_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS qualification_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS housing_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS family_allowance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS nursing_insurance INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS resident_tax INTEGER DEFAULT 0;
    ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS other_deductions INTEGER DEFAULT 0;
    
    -- UNIQUE 制約の追加
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payslips_tenant_id_user_id_year_month_key'
    ) THEN
        BEGIN
            ALTER TABLE public.payslips ADD CONSTRAINT payslips_tenant_id_user_id_year_month_key UNIQUE(tenant_id, user_id, year_month);
        EXCEPTION
            WHEN others THEN NULL;
        END;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
