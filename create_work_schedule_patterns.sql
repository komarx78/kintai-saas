-- ============================================================================
-- 就業時間パターンマスタ ＆ tenants テーブル修正 データベースマイグレーション
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. tenants テーブルに updated_at カラムを追加（安全対策）
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. 就業時間パターンマスタテーブル (work_schedule_patterns)
CREATE TABLE IF NOT EXISTS public.work_schedule_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_time VARCHAR(10) NOT NULL DEFAULT '09:00',
    end_time VARCHAR(10) NOT NULL DEFAULT '18:00',
    break_minutes INTEGER NOT NULL DEFAULT 60,
    target_department VARCHAR(100) DEFAULT '',
    display_order INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_schedule_patterns_tenant ON public.work_schedule_patterns(tenant_id);

ALTER TABLE public.work_schedule_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_work_patterns_all" ON public.work_schedule_patterns;
CREATE POLICY "tenant_work_patterns_all" ON public.work_schedule_patterns FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
);

-- デフォルト就業時間パターンのシード
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        INSERT INTO public.work_schedule_patterns (tenant_id, name, start_time, end_time, break_minutes, target_department, display_order)
        VALUES 
            (t.id, '標準勤務（本社・営業）', '09:00', '18:00', 60, '営業部', 1),
            (t.id, '店舗早番（8:00〜17:00）', '08:00', '17:00', 60, '店舗運営部', 2),
            (t.id, '店舗遅番（12:00〜21:00）', '12:00', '21:00', 60, '店舗運営部', 3),
            (t.id, '育児・介護時短勤務', '09:30', '16:30', 60, '', 4)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
