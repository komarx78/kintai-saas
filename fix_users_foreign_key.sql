-- ============================================================================
-- 従業員台帳（users）の auth.users 外部キー制約解除 & UUID自動採番設定 SQL
-- 【背景】
-- 管理者が従業員台帳にアルバイト・パート・スタッフ（40名等）を登録する際、
-- Supabase Auth アカウントを持たない従業員も台帳管理・シフト管理・給与計算できるようにするため、
-- users テーブルの users_id_fkey 制約を解除し、id に自動UUID採番を設定します。
-- ============================================================================

-- 1. users テーブルの auth.users 外部キー制約を安全に削除
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. users テーブルの id カラムにデフォルト値（gen_random_uuid()）を設定
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. RLS ポリシーの確認と安全な許可（管理者による従業員の一括作成・更新を許可）
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
CREATE POLICY "Admins can manage users" ON public.users FOR ALL USING (
  tenant_id = get_user_tenant_id()
);

-- 4. スキーマキャッシュの即時リロード
NOTIFY pgrst, 'reload schema';
