-- ============================================================================
-- 入社提出書類・通勤費・通帳コピー電子収集システム用 データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_document_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'bank_passbook' (通帳), 'commuting_pass' (通勤費), 'my_number' (マイナ), 'id_card' (身分証), 'dependents_form' (扶養控除), 'withholding_tax' (前職源泉)
    title VARCHAR(100) NOT NULL,
    
    -- 申請データ (JSONB)
    data JSONB DEFAULT '{}'::jsonb,
    
    -- 圧縮画像・PDFデータ (Base64またはURL)
    attachment_data TEXT DEFAULT NULL,
    attachment_filename VARCHAR(255) DEFAULT '',
    attachment_mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    
    -- 審査ステータス
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' (未審査), 'approved' (承認済・マスタ反映), 'rejected' (差戻し)
    admin_comment TEXT DEFAULT '',
    approved_by UUID REFERENCES public.users(id) DEFAULT NULL,
    approved_at TIMESTAMPTZ DEFAULT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_submissions_tenant_user ON public.employee_document_submissions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_doc_submissions_status ON public.employee_document_submissions(tenant_id, status);

ALTER TABLE public.employee_document_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_doc_submissions_all" ON public.employee_document_submissions;
CREATE POLICY "tenant_doc_submissions_all" ON public.employee_document_submissions FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

NOTIFY pgrst, 'reload schema';
