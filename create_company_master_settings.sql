-- ============================================================================
-- 全社共通 会社・労務マスタ一元化 データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. tenants テーブルの会社情報・就業ルール・休日・給与設定カラムの拡充
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '東京都千代田区〇〇 1-2-3',
ADD COLUMN IF NOT EXISTS representative_name VARCHAR(100) DEFAULT '代表取締役 〇〇 〇〇',
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50) DEFAULT '03-0000-0000',
ADD COLUMN IF NOT EXISTS corporate_number VARCHAR(20) DEFAULT '',
ADD COLUMN IF NOT EXISTS company_seal_url TEXT DEFAULT '',

-- 年間休日・就業時間設定 (JSONB)
ADD COLUMN IF NOT EXISTS work_calendar_settings JSONB DEFAULT '{
  "fixed_holidays": [0, 6],
  "national_holidays_enabled": true,
  "winter_vacation_enabled": true,
  "winter_vacation_start": "2026-12-29",
  "winter_vacation_end": "2027-01-03",
  "summer_vacation_enabled": true,
  "summer_vacation_start": "2026-08-13",
  "summer_vacation_end": "2026-08-16",
  "custom_holidays": [],
  "annual_holidays_count": 125,
  "standard_start_time": "09:00",
  "standard_end_time": "18:00",
  "standard_break_minutes": 60,
  "holiday_text_summary": "完全週休2日制（土日・祝日）、年末年始休暇、夏季休暇（年間休日125日）"
}'::jsonb,

-- 給与・労務共通設定 (JSONB)
ADD COLUMN IF NOT EXISTS payroll_common_settings JSONB DEFAULT '{
  "closing_day": 31,
  "payment_day": 25,
  "payment_month": "current",
  "overtime_rate": 1.25,
  "night_rate": 0.25,
  "holiday_rate": 1.35,
  "health_insurance_rate": 0.05,
  "pension_rate": 0.0915,
  "employment_insurance_rate": 0.006,
  "commuting_allowance_limit": 150000
}'::jsonb,

-- 就業規則・社内規定本文 (AI連動)
ADD COLUMN IF NOT EXISTS employment_rules_text TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT DEFAULT '';

-- 2. 配属部署マスタテーブル (department_masters)
CREATE TABLE IF NOT EXISTS public.department_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) DEFAULT '',
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE public.department_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_departments_all" ON public.department_masters;
CREATE POLICY "tenant_departments_all" ON public.department_masters FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- デフォルト部署のシード
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        INSERT INTO public.department_masters (tenant_id, name, display_order)
        VALUES 
            (t.id, '営業部', 1),
            (t.id, '総務・管理部', 2),
            (t.id, '店舗運営部', 3),
            (t.id, '製造・技術部', 4)
        ON CONFLICT (tenant_id, name) DO NOTHING;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
