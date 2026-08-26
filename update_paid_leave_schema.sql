-- ==========================================
-- 有給休暇自動付与・管理システム用 スキーマ拡張
-- ==========================================

-- 1. ユーザーテーブルに雇用形態と週所定労働日数を追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'full-time';
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_working_days INT DEFAULT 5;

-- 2. 有給休暇付与履歴テーブルの作成
CREATE TABLE IF NOT EXISTS paid_leave_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grant_date DATE NOT NULL,
  granted_days NUMERIC(5,2) NOT NULL,
  expiration_date DATE NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS設定
ALTER TABLE paid_leave_grants ENABLE ROW LEVEL SECURITY;

-- テナント内のすべての付与履歴を閲覧可能（管理画面・打刻画面での残数照会用）
CREATE POLICY "Users can view tenant leave grants" 
ON paid_leave_grants FOR SELECT 
USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);

-- 管理者またはシステムのみがINSERT/UPDATE可能（基本的には関数から付与される）
CREATE POLICY "Admins can insert leave grants" 
ON paid_leave_grants FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND tenant_id = paid_leave_grants.tenant_id)
);
