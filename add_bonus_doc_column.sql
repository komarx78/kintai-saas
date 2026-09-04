-- 日本年金機構 被保険者賞与支払届（コード2265様式）印字座標マスタ設定カラムの追加
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS bonus_doc_coordinates JSONB;
