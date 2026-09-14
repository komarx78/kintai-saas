-- ==============================================================================
-- 雇用保険被保険者資格取得届（ハローワーク様式第2号）全社印字座標マスタ設定カラム追加
-- ==============================================================================

-- 1. system_settings テーブルに印字座標マスタ用 JSONB カラムを追加（完全冪等・安全）
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS employment_acq_doc_coordinates JSONB;

-- 2. レコードが1件も存在しない場合のみ初期レコード作成（UUID自動採番）
INSERT INTO system_settings (created_at, updated_at)
SELECT now(), now()
WHERE NOT EXISTS (SELECT 1 FROM system_settings);
