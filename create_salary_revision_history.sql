-- ============================================================================
-- 昇給・給与改定履歴テーブル (salary_revision_history) 新設マイグレーション
-- (Supabase SQL Editor で実行してください)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.salary_revision_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    revision_date DATE NOT NULL, -- 改定適用日 (例: 2026-04-01)
    applied_year_month VARCHAR(7) NOT NULL, -- 適用年月 (例: '2026-04')
    revision_type VARCHAR(50) NOT NULL DEFAULT 'regular', -- 'regular'(定期昇給), 'base_up'(ベースアップ), 'promotion'(昇格昇給), 'position'(役職変更), 'qualification'(資格取得), 'special'(特別昇給), 'other'(その他)
    
    -- 改定前後の給与内訳
    previous_base_salary NUMERIC NOT NULL DEFAULT 0,
    new_base_salary NUMERIC NOT NULL DEFAULT 0,
    diff_base_salary NUMERIC NOT NULL DEFAULT 0, -- 昇給差額
    
    previous_total_allowance NUMERIC NOT NULL DEFAULT 0, -- 各種手当合計
    new_total_allowance NUMERIC NOT NULL DEFAULT 0,
    
    previous_total_salary NUMERIC NOT NULL DEFAULT 0, -- 総支給額 (基本給 + 手当)
    new_total_salary NUMERIC NOT NULL DEFAULT 0,
    diff_total_salary NUMERIC NOT NULL DEFAULT 0,
    
    revision_rate NUMERIC DEFAULT 0, -- 昇給率 (例: 5.2%)
    
    allowance_details JSONB DEFAULT '{}'::jsonb, -- 各種手当の内訳 (役職手当、資格手当等)
    reason_note TEXT, -- 改定理由・人事考課メモ
    approved_by VARCHAR(100), -- 承認者・決裁者
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_salary_revision_tenant ON public.salary_revision_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_salary_revision_user ON public.salary_revision_history(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_revision_date ON public.salary_revision_history(revision_date DESC);

-- RLS (テナント完全分離)
ALTER TABLE public.salary_revision_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for salary_revision_history" ON public.salary_revision_history
    FOR ALL USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'superadmin')
    );

NOTIFY pgrst, 'reload schema';
