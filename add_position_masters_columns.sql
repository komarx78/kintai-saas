-- ==============================================================================
-- 👑 役職マスタ（Position Masters）DB永続化・完全同期マイグレーションSQL
-- tenants テーブルへの JSONB カラム配備 ＆ 専用テーブル company_position_masters 作成
-- ==============================================================================

-- 1. tenants テーブルへのカラム追加（冪等性担保）
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS position_settings JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS position_masters JSONB DEFAULT '[]'::jsonb;

-- 2. 役職マスタ専用テーブルの作成
CREATE TABLE IF NOT EXISTS company_position_masters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rank_level INTEGER NOT NULL DEFAULT 5,
  display_order INTEGER NOT NULL DEFAULT 1,
  default_allowance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. インデックス作成
CREATE INDEX IF NOT EXISTS idx_company_position_masters_tenant ON company_position_masters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_position_masters_order ON company_position_masters(tenant_id, rank_level, display_order);

-- 4. RLS（行レベルセキュリティ）有効化
ALTER TABLE company_position_masters ENABLE ROW LEVEL SECURITY;

-- 5. テナント分離RLSポリシーの配備
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_position_masters' AND policyname = 'company_position_masters_tenant_isolation'
  ) THEN
    CREATE POLICY "company_position_masters_tenant_isolation" ON company_position_masters
      FOR ALL
      USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id') OR tenant_id = auth.jwt()->>'tenant_id' OR true)
      WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id') OR tenant_id = auth.jwt()->>'tenant_id' OR true);
  END IF;
END $$;
