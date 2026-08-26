-- ユーザー新規登録時に自動で `public.users` と `public.tenants` を作成するトリガー
-- 招待コード（invite_code）がある場合は既存の企業に従業員として参加し、
-- ない場合は新しい企業の管理者として登録します。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  target_tenant_id UUID;
  user_role VARCHAR(50);
  invite_code TEXT;
BEGIN
  -- サインアップ時に送信されたメタデータから招待コードを取得
  invite_code := new.raw_user_meta_data->>'invite_code';

  IF invite_code IS NOT NULL AND invite_code != '' THEN
    -- 招待コードがある場合：既存のテナントに「user（一般従業員）」として参加
    target_tenant_id := invite_code::UUID;
    user_role := 'user';
  ELSE
    -- 招待コードがない場合：新規テナントを作成し、「admin（管理者）」として登録
    INSERT INTO public.tenants (name)
    VALUES (split_part(new.email, '@', 1) || ' 株式会社')
    RETURNING id INTO target_tenant_id;
    user_role := 'admin';
  END IF;

  -- usersテーブルへ登録
  INSERT INTO public.users (id, tenant_id, email, name, role)
  VALUES (new.id, target_tenant_id, new.email, split_part(new.email, '@', 1), user_role);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーの再作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
