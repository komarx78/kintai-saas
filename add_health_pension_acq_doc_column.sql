-- 日本年金機構 / 協会けんぽ
-- 健康保険・厚生年金保険 被保険者資格取得届（様式コード 2200）印字座標マスタ設定カラムの追加
-- 【司馬懿・SQL一撃無痛掟（完全冪等性保証）】

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS health_pension_acq_doc_coordinates JSONB;

-- テーブルレコードが存在しない場合の初期レコード配備（冪等）
INSERT INTO system_settings (id, updated_at)
VALUES (gen_random_uuid(), NOW())
ON CONFLICT (id) DO NOTHING;
