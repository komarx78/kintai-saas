-- ============================================================================
-- 住所フリガナ（address_kana）大元マスタ統一マイグレーション
-- (何度実行してもエラーにならない完全冪等性保証構文)
-- ============================================================================

-- 1. users テーブルに住所フリガナ（address_kana）カラムを追加
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS address_kana TEXT;

-- 2. employee_onboarding_profiles テーブルに住所フリガナ（address_kana）カラムを追加
ALTER TABLE IF EXISTS public.employee_onboarding_profiles ADD COLUMN IF NOT EXISTS address_kana TEXT;

-- 3. PostgREST スキーマキャッシュの即時リロード
NOTIFY pgrst, 'reload schema';
