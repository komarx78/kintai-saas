-- =========================================================================
-- システム共通設定テーブル（system_settings）に AIプラットフォームキーを追加
-- =========================================================================

-- gemini_api_key カラムが存在しない場合は追加
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS gemini_api_key VARCHAR(255);

-- 特権管理者（superadmin）のみが system_settings を閲覧・更新可能とするRLSポリシー
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザー（従業員等）は読み取りのみ可能（AI機能呼び出し用）
CREATE POLICY "Allow read system_settings for authenticated users"
    ON system_settings FOR SELECT
    TO authenticated
    USING (true);

-- superadmin ロールのユーザーのみが更新可能
CREATE POLICY "Allow all for superadmin on system_settings"
    ON system_settings FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'superadmin'
        )
    );
