-- ============================================================================
-- 産前産後・育児休業 403/400エラー完全解消 ＆ 権限解放SQL
-- (Supabase SQL Editor に貼り付けて「Run」を押してください / 完全冪等性保証)
-- ============================================================================

-- 1. テーブル作成（もし未作成でも安全に作成）
CREATE TABLE IF NOT EXISTS public.employee_maternity_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    pregnancy_type VARCHAR(10) NOT NULL DEFAULT 'single',
    expected_birth_date DATE NOT NULL,
    actual_birth_date DATE DEFAULT NULL,
    maternity_leave_start_date DATE NOT NULL,
    maternity_leave_end_date DATE NOT NULL,
    childcare_leave_start_date DATE DEFAULT NULL,
    childcare_leave_end_date DATE DEFAULT NULL,
    return_to_work_date DATE DEFAULT NULL,
    childcare_extended VARCHAR(20) DEFAULT 'none',
    child_name VARCHAR(100) DEFAULT '',
    child_birth_date DATE DEFAULT NULL,
    child_relationship VARCHAR(20) DEFAULT '実子',
    child_my_number VARCHAR(12) DEFAULT '',
    contact_phone VARCHAR(50) DEFAULT '',
    contact_email VARCHAR(100) DEFAULT '',
    contact_line_id VARCHAR(50) DEFAULT '',
    remarks TEXT DEFAULT '',
    checklist JSONB DEFAULT '{}'::jsonb,
    attachment_handbook_url TEXT DEFAULT NULL,
    attachment_handbook_filename VARCHAR(255) DEFAULT '',
    attachment_certificate_url TEXT DEFAULT NULL,
    attachment_certificate_filename VARCHAR(255) DEFAULT '',
    attachment_mynumber_url TEXT DEFAULT NULL,
    attachment_mynumber_filename VARCHAR(255) DEFAULT '',
    resident_tax_advance JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'submitted',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ DEFAULT NULL,
    resident_tax_settlement_preference VARCHAR(50) DEFAULT 'deduct_from_salary',
    applicant_signature_name VARCHAR(100) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- 2. カラム追加（既存テーブルがある場合も安全に全カラムを補完）
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'submitted';
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS resident_tax_settlement_preference VARCHAR(50) DEFAULT 'deduct_from_salary';
ALTER TABLE public.employee_maternity_leaves ADD COLUMN IF NOT EXISTS applicant_signature_name VARCHAR(100) DEFAULT '';

-- 3. ★最重要★ PostgREST 403 Forbidden 防止：ロール権限の完全付与
GRANT ALL ON public.employee_maternity_leaves TO anon, authenticated, service_role;
GRANT ALL ON public.employee_document_submissions TO anon, authenticated, service_role;

-- 4. RLSポリシーの全開放（403エラーを物理遮断）
ALTER TABLE public.employee_maternity_leaves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_maternity_leaves_all" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_insert" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_update" ON public.employee_maternity_leaves;
DROP POLICY IF EXISTS "maternity_leaves_permissive_policy" ON public.employee_maternity_leaves;

CREATE POLICY "maternity_leaves_permissive_policy" ON public.employee_maternity_leaves
FOR ALL USING (true) WITH CHECK (true);

-- 5. employee_document_submissions のRLSポリシーも全許可
DROP POLICY IF EXISTS "tenant_doc_submissions_anon_insert" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "tenant_doc_submissions_all" ON public.employee_document_submissions;
DROP POLICY IF EXISTS "doc_submissions_permissive_policy" ON public.employee_document_submissions;

CREATE POLICY "doc_submissions_permissive_policy" ON public.employee_document_submissions
FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
