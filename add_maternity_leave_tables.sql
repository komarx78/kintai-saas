-- ============================================================================
-- 産前産後・育児休業 手続き＆労務書類管理 データベースマイグレーション
-- (Supabase SQL Editor で実行してください / 完全冪等性保証)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_maternity_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- 申請基本情報
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    pregnancy_type VARCHAR(10) NOT NULL DEFAULT 'single', -- 'single' (単胎), 'multiple' (多胎)
    expected_birth_date DATE NOT NULL, -- 出産予定日
    actual_birth_date DATE DEFAULT NULL, -- 実出産日
    
    -- 産前産後休業期間
    maternity_leave_start_date DATE NOT NULL, -- 産前休業開始日 (単胎42日前 / 多胎98日前)
    maternity_leave_end_date DATE NOT NULL,   -- 産後休業終了日 (出産翌日から56日後)
    
    -- 育児休業期間
    childcare_leave_start_date DATE DEFAULT NULL, -- 育児休業開始日 (産後終了翌日)
    childcare_leave_end_date DATE DEFAULT NULL,   -- 育児休業終了日 (原則満1歳の誕生日前日)
    return_to_work_date DATE DEFAULT NULL,        -- 復職予定日 (育休終了翌日)
    childcare_extended VARCHAR(20) DEFAULT 'none', -- 'none', '1_year_6_months', '2_years'
    
    -- お子様の情報
    child_name VARCHAR(100) DEFAULT '',
    child_birth_date DATE DEFAULT NULL,
    child_relationship VARCHAR(20) DEFAULT '実子',
    child_my_number VARCHAR(12) DEFAULT '',
    
    -- 休業中の連絡先
    contact_phone VARCHAR(50) DEFAULT '',
    contact_email VARCHAR(100) DEFAULT '',
    contact_line_id VARCHAR(50) DEFAULT '',
    remarks TEXT DEFAULT '',
    
    -- 実務チェックリスト・進捗 (原本3準拠 JSONB)
    checklist JSONB DEFAULT '{
      "internal_maternity_app_1": false,
      "internal_maternity_app_2": false,
      "internal_childcare_app_1": false,
      "internal_childcare_app_2": false,
      "attached_maternal_handbook_1": false,
      "attached_maternal_handbook_2": false,
      "attached_child_mynumber": false,
      "external_maternity_notice_1": false,
      "external_maternity_notice_2": false,
      "external_childcare_notice_1": false,
      "external_childcare_notice_2": false,
      "dependent_health_insurance_added": false
    }'::jsonb,
    
    -- 添付証憑データ (母子手帳写し・出生証明等)
    attachment_handbook_url TEXT DEFAULT NULL,
    attachment_handbook_filename VARCHAR(255) DEFAULT '',
    attachment_certificate_url TEXT DEFAULT NULL,
    attachment_certificate_filename VARCHAR(255) DEFAULT '',
    attachment_mynumber_url TEXT DEFAULT NULL,
    attachment_mynumber_filename VARCHAR(255) DEFAULT '',
    
    -- 住民税立替表データ (原本4準拠 JSONB: 年・月別立替額および精算ステータス)
    resident_tax_advance JSONB DEFAULT '{
      "start_date": "",
      "records": []
    }'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_maternity_leaves_tenant_user ON public.employee_maternity_leaves(tenant_id, user_id);

-- RLS（行レベルセキュリティ）有効化
ALTER TABLE public.employee_maternity_leaves ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを安全に削除して再作成（二重実行エラー防止）
DROP POLICY IF EXISTS "tenant_maternity_leaves_all" ON public.employee_maternity_leaves;
CREATE POLICY "tenant_maternity_leaves_all" ON public.employee_maternity_leaves FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

NOTIFY pgrst, 'reload schema';
