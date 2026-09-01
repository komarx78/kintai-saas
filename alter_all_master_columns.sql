-- ============================================================================
-- 従業員マスタ・給与マスタ・労務マスタ 統合カラム追加SQL
-- (Supabase SQL Editor で一度だけ実行してください)
-- ============================================================================

-- 1. users テーブルに生年月日・住所・電話番号カラムを追加
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- 2. employee_payroll_profiles テーブルに生年月日カラムを追加
ALTER TABLE public.employee_payroll_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 3. employee_onboarding_profiles テーブルに生年月日・住所・電話番号カラムを追加
ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(30);

-- 4. スキーマキャッシュの即時リロード
NOTIFY pgrst, 'reload schema';
