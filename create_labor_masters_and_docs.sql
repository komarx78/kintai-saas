-- ============================================================================
-- 部署マスタ ＆ 休日規程マスタ データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. department_masters (配属部署マスタ)
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

-- 2. holiday_rule_masters (休日規程マスタ)
CREATE TABLE IF NOT EXISTS public.holiday_rule_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    annual_holidays INTEGER DEFAULT 120,
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, title)
);

-- RLS設定
ALTER TABLE public.department_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_departments_all" ON public.department_masters;
CREATE POLICY "tenant_departments_all" ON public.department_masters FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

ALTER TABLE public.holiday_rule_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_holiday_rules_all" ON public.holiday_rule_masters;
CREATE POLICY "tenant_holiday_rules_all" ON public.holiday_rule_masters FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- 初期デフォルトマスタのシード関数
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- デフォルト部署
        INSERT INTO public.department_masters (tenant_id, name, display_order)
        VALUES 
            (t.id, '営業部', 1),
            (t.id, '総務・管理部', 2),
            (t.id, '店舗運営部', 3),
            (t.id, '製造・技術部', 4)
        ON CONFLICT (tenant_id, name) DO NOTHING;

        -- デフォルト休日規程
        INSERT INTO public.holiday_rule_masters (tenant_id, title, description, annual_holidays, display_order)
        VALUES 
            (t.id, '完全週休2日制（土日・祝日）', '土曜日、日曜日、国民の祝日、年末年始休暇、夏季休暇', 125, 1),
            (t.id, 'シフト制（月8日〜9日休）', '毎月作成する勤務シフト表により指定（年間公休105日）', 105, 2),
            (t.id, '週休2日制（水曜定休＋他1日）', '毎週水曜日定休日、その他平日1日指定、年末年始休暇', 115, 3)
        ON CONFLICT (tenant_id, title) DO NOTHING;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
