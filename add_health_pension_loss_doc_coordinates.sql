-- ══════════════════════════════════════════════════════════════════════════
-- 🏛️ 健康保険・厚生年金保険 被保険者資格喪失届（コード2201）印字座標カラム追加
-- （何度実行しても絶対にエラーを吐かない完全防御構文）
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS health_pension_loss_doc_coordinates JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN system_settings.health_pension_loss_doc_coordinates IS '健康保険・厚生年金保険 被保険者資格喪失届（様式コード2201）印字座標マスタ設定JSON';
