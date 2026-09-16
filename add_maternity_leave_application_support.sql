-- ============================================================================
-- 産前産後・育児休業 社員申請＆管理者審査パイプライン データベースマイグレーション
-- (Supabase SQL Editor で実行してください / 完全冪等性保証)
-- ============================================================================

-- 1. employee_maternity_leaves テーブルへステータス・申請日時・精算希望カラムを追加
ALTER TABLE public.employee_maternity_leaves 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'submitted';

ALTER TABLE public.employee_maternity_leaves 
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.employee_maternity_leaves 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.employee_maternity_leaves 
ADD COLUMN IF NOT EXISTS resident_tax_settlement_preference VARCHAR(50) DEFAULT 'deduct_from_salary';

ALTER TABLE public.employee_maternity_leaves 
ADD COLUMN IF NOT EXISTS applicant_signature_name VARCHAR(100) DEFAULT '';

-- 2. 未ログインの社員でも専用URL（tenant_id & user_id）から産休申請を送信できるようにRLSを適正化
DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_insert" ON public.employee_maternity_leaves;
CREATE POLICY "tenant_maternity_leaves_anon_insert" ON public.employee_maternity_leaves 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_maternity_leaves_anon_update" ON public.employee_maternity_leaves;
CREATE POLICY "tenant_maternity_leaves_anon_update" ON public.employee_maternity_leaves 
FOR UPDATE USING (true);

-- 3. employee_document_submissions へも未ログイン社員からの産休申請INSERTを許可
DROP POLICY IF EXISTS "tenant_doc_submissions_anon_insert" ON public.employee_document_submissions;
CREATE POLICY "tenant_doc_submissions_anon_insert" ON public.employee_document_submissions 
FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
