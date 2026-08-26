-- ============================================================================
-- シフト管理機能用のテーブルおよびRLS追加 (シフトパターン・シフトデータ)
-- ============================================================================

-- 1. shift_patterns (シフトパターンマスタ)
CREATE TABLE IF NOT EXISTS shift_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT DEFAULT 60,
  color VARCHAR(50) DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. shifts (実際のシフトデータ)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  pattern_id UUID REFERENCES shift_patterns(id) ON DELETE SET NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT DEFAULT 60,
  color VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, work_date)
);

-- ============================================================================
-- RLS (Row Level Security) の設定
-- ============================================================================

-- shift_patterns
ALTER TABLE shift_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own tenant shift patterns" ON shift_patterns FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can insert own tenant shift patterns" ON shift_patterns FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can update own tenant shift patterns" ON shift_patterns FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can delete own tenant shift patterns" ON shift_patterns FOR DELETE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own tenant shifts" ON shifts FOR SELECT USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can insert own tenant shifts" ON shifts FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can update own tenant shifts" ON shifts FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can delete own tenant shifts" ON shifts FOR DELETE USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
