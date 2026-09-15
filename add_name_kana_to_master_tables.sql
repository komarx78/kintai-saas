-- ============================================================================
-- 氏名フリガナ（name_kana）大元マスタ統一マイグレーション
-- (何度実行してもエラーにならない完全冪等性保証構文)
-- ============================================================================

-- 1. users テーブルに氏名フリガナ（name_kana）カラムを追加
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS name_kana TEXT;

-- 2. employee_onboarding_profiles テーブルに氏名フリガナ（name_kana）カラムを追加
ALTER TABLE IF EXISTS public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS name_kana TEXT;

-- 3. employee_payroll_profiles テーブルに氏名フリガナ（name_kana）カラムを追加
ALTER TABLE IF EXISTS public.employee_payroll_profiles ADD COLUMN IF NOT EXISTS name_kana TEXT;

-- 4. PostgREST スキーマキャッシュの即時リロード
NOTIFY pgrst, 'reload schema';
