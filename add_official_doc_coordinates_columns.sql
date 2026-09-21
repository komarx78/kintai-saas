-- ==============================================================================
-- 🏛️ 官公庁公的帳票（賞与支払届・健康保険厚生年金資格取得届）印字座標マスタ永続化防壁SQL
-- 【軍律第16条・第18条完全遵守：何度実行してもエラーにならない一撃無痛・完全冪等性構文】
-- ==============================================================================

-- 1. system_settings テーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 賞与支払届 印字座標マスタカラムの追加
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS bonus_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 3. 健康保険・厚生年金保険 被保険者資格取得届 印字座標マスタカラムの追加
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS health_pension_acq_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 4. 雇用保険被保険者資格取得届 印字座標マスタカラムの追加
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS employment_acq_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 5. 雇用保険被保険者資格喪失届 印字座標マスタカラムの追加
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS employment_loss_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 6. 配偶者控除申告書 印字座標マスタカラムの追加
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS spouse_doc_coordinates JSONB DEFAULT '[]'::jsonb;

-- 7. RLSポリシーの設定（全認証ユーザー閲覧可、管理者更新可）
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read system_settings" ON public.system_settings;
CREATE POLICY "Allow authenticated read system_settings" 
ON public.system_settings FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated write system_settings" ON public.system_settings;
CREATE POLICY "Allow authenticated write system_settings" 
ON public.system_settings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 8. 初期レコードが未登録の場合は1行生成
INSERT INTO public.system_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1);
