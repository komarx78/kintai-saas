-- =========================================================================
-- 就業規則・社内規定 ＆ テナント別AI設定テーブル（company_rules）
-- =========================================================================

CREATE TABLE IF NOT EXISTS company_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL DEFAULT '就業規則',
    content TEXT NOT NULL,
    gemini_api_key VARCHAR(255), -- テナントごとのGemini APIキー
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_tenant_rule_title UNIQUE (tenant_id, title)
);

-- RLS（Row Level Security）の有効化
ALTER TABLE company_rules ENABLE ROW LEVEL SECURITY;

-- 従業員・管理者は自社テナントの就業規則・AIキーを参照可能
CREATE POLICY "Users can read own tenant company rules"
    ON company_rules FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- 管理者のみが自社テナントの就業規則・AIキーを更新可能
CREATE POLICY "Admins can manage own tenant company rules"
    ON company_rules FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid() AND role = '管理者'
        )
    );
