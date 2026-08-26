-- ============================================================================
-- 企業別 休暇・代休・有給・労務ルールマスタ（company_leave_rules / tenants拡張）
-- ============================================================================

-- tenants テーブルに leave_rules (JSONB) カラムを追加（柔軟なマスタ設定用）
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_rules JSONB DEFAULT '{
  "paid_leave": {
    "grant_timing": "standard_6months",
    "allow_half_day": true,
    "allow_hourly": false,
    "max_hourly_days": 5,
    "application_deadline": "prior_day",
    "expire_years": 2,
    "allow_accumulated": false
  },
  "substitute_leave": {
    "mode": "both",
    "expire_months": 2,
    "grant_condition": "half_4h_full_8h",
    "pay_overtime_premium": true
  },
  "work_hours": {
    "closing_day": "end_of_month",
    "daily_work_hours": 8,
    "weekly_work_days": 5,
    "rounding_unit": 15,
    "overtime_alert_warning": 20,
    "overtime_alert_danger": 40,
    "overtime_alert_prohibited": 60
  }
}'::jsonb;

-- RLSポリシーの確認（自社テナントのみ更新・参照可能）
-- （既存のテナントポリシーにより認証済み管理者が自社テナントをUPDATE可能）
