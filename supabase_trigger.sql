-- ユーザー新規登録時に自動で `public.users` と `public.tenants` を作成するトリガー
-- ※これはテスト・初期開発用の簡易設定です。

-- 1. 新規テナントとユーザーを自動作成する関数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- 新しいテナント（企業）を作成
  INSERT INTO public.tenants (name)
  VALUES (split_part(new.email, '@', 1) || ' 株式会社')
  RETURNING id INTO new_tenant_id;

  -- 新しいユーザーを管理者（admin）として作成
  INSERT INTO public.users (id, tenant_id, email, name, role)
  VALUES (new.id, new_tenant_id, new.email, split_part(new.email, '@', 1), 'admin');
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. トリガーの作成（既に存在する場合は一度削除）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
