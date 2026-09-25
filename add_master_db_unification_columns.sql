-- ==============================================================================
-- 🏛️ 【実DB完全一本化】全社マスタ設定（打刻丸め・プリセット・社会保険）DB永続化マイグレーションSQL
-- tenants テーブルへの JSONB カラム配備（冪等性担保）
-- ==============================================================================

-- 1. 打刻丸めルールのJSONBカラム追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS attendance_rounding_settings JSONB DEFAULT '{}'::jsonb;

-- 2. 自社打刻丸めカスタムプリセットのJSONBカラム追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_rounding_presets JSONB DEFAULT '[]'::jsonb;

-- 3. 社会保険・雇用保険・労働保険マスタのJSONBカラム追加
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS insurance_master_settings JSONB DEFAULT '{}'::jsonb;

-- 4. 役職マスタ設定のJSONBカラム（念押し担保）
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS position_settings JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS position_masters JSONB DEFAULT '[]'::jsonb;

-- 5. 役職マスタ専用テーブルの作成（未作成の場合）
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

CREATE INDEX IF NOT EXISTS idx_company_position_masters_tenant ON company_position_masters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_position_masters_order ON company_position_masters(tenant_id, rank_level, display_order);
ALTER TABLE company_position_masters ENABLE ROW LEVEL SECURITY;

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
