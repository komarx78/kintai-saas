-- 販売用 勤怠・有給管理システム Supabase スキーマ定義
-- 注意: これは参考用のSQLであり、実際のSupabaseのSQLエディタで実行して構築します。

-- ==========================================
-- テーブルの作成 (依存関係の順)
-- ==========================================

-- 1. system_settings (システムマスタ設定)
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_1_user INT NOT NULL DEFAULT 2000,
  price_2_users INT NOT NULL DEFAULT 4000,
  price_3_users INT NOT NULL DEFAULT 6000,
  price_4_users INT NOT NULL DEFAULT 8000,
  price_5_users INT NOT NULL DEFAULT 10000,
  price_1_user_annual INT NOT NULL DEFAULT 20000,
  price_2_users_annual INT NOT NULL DEFAULT 40000,
  price_3_users_annual INT NOT NULL DEFAULT 60000,
  price_4_users_annual INT NOT NULL DEFAULT 80000,
  price_5_users_annual INT NOT NULL DEFAULT 100000,
  additional_user_price INT NOT NULL DEFAULT 500,
  additional_user_price_annual INT NOT NULL DEFAULT 5000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. tenants (導入企業マスタ)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'active',
  closing_day INT DEFAULT 0,
  ot_warning_hours INT DEFAULT 20,
  daikyu_limit_months INT DEFAULT 1,
  plan_type VARCHAR(50) DEFAULT 'trial',
  billing_cycle VARCHAR(50) DEFAULT 'monthly',
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month',
  custom_price_1_user INT,
  custom_price_2_users INT,
  custom_price_3_users INT,
  custom_price_4_users INT,
  custom_price_5_users INT,
  custom_price_1_user_annual INT,
  custom_price_2_users_annual INT,
  custom_price_3_users_annual INT,
  custom_price_4_users_annual INT,
  custom_price_5_users_annual INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. users (従業員マスタ)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  department VARCHAR(100),
  approver_id UUID REFERENCES users(id),
  join_date DATE,
  paid_leave_balance NUMERIC(5,2) DEFAULT 0,
  paid_leave_carryover NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. attendance_records (出退勤データ)
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  record_time TIMESTAMPTZ NOT NULL,
  type VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. leave_requests (有給・休暇・打刻修正申請)
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT '申請中',
  approver_id UUID REFERENCES users(id),
  substitute_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. shift_patterns (シフトパターンマスタ)
CREATE TABLE shift_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT DEFAULT 60,
  color VARCHAR(50) DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. shifts (実際のシフトデータ)
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  pattern_id UUID REFERENCES shift_patterns(id) ON DELETE SET NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, work_date)
);


-- ==========================================
-- RLS (Row Level Security) の設定とポリシー
-- （すべてのテーブルが作成された後に定義）
-- ==========================================

-- system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for system_settings" ON system_settings FOR SELECT USING (true);

-- tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tenant" ON tenants FOR SELECT USING (
  id = (SELECT tenant_id FROM users WHERE users.id = auth.uid())
);

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view users in same tenant" ON users FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users u WHERE u.id = auth.uid())
);
CREATE POLICY "Admins can manage users" ON users FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users admin 
    WHERE admin.id = auth.uid() 
      AND admin.role = 'admin' 
      AND admin.tenant_id = users.tenant_id
  )
);

-- attendance_records
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tenant attendance" ON attendance_records FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Users can insert own attendance" ON attendance_records FOR INSERT WITH CHECK (
  user_id = auth.uid() AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);

-- leave_requests
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tenant leave requests" ON leave_requests FOR SELECT USING (
  tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Users can insert own requests" ON leave_requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
);
CREATE POLICY "Approvers can update status" ON leave_requests FOR UPDATE USING (
  approver_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND tenant_id = leave_requests.tenant_id)
);

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
