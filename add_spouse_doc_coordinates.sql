-- 国税庁 令和8年分 給与所得者の基礎控除申告書 兼 配偶者控除等申告書 兼 特定親族特別控除申告書 兼 所得金額調整控除申告書（基・配・特・所）印字座標マスタ設定カラムの追加
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS spouse_doc_coordinates JSONB;
