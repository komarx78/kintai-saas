-- =========================================================================
-- 📍 attendance_records テーブルへのスマートフォンGPS位置情報カラム追加
-- 不正打刻防止（自宅・遠隔地からの虚偽打刻検知）用
-- =========================================================================

-- 出勤時 GPS位置情報カラム
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_in_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS check_in_lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS check_in_accuracy NUMERIC(8, 2),
ADD COLUMN IF NOT EXISTS check_in_device VARCHAR(50) DEFAULT 'pc';

-- 退勤時 GPS位置情報カラム
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_out_lat NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS check_out_lng NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS check_out_accuracy NUMERIC(8, 2),
ADD COLUMN IF NOT EXISTS check_out_device VARCHAR(50) DEFAULT 'pc';

-- 検索・集計用インデックス（必要に応じて）
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON attendance_records (user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_tenant_date ON attendance_records (tenant_id, date);

COMMENT ON COLUMN attendance_records.check_in_lat IS '出勤時 GPS緯度';
COMMENT ON COLUMN attendance_records.check_in_lng IS '出勤時 GPS経度';
COMMENT ON COLUMN attendance_records.check_in_accuracy IS '出勤時 GPS測定精度(m)';
COMMENT ON COLUMN attendance_records.check_in_device IS '出勤時 打刻端末種別 (mobile / pc)';
COMMENT ON COLUMN attendance_records.check_out_lat IS '退勤時 GPS緯度';
COMMENT ON COLUMN attendance_records.check_out_lng IS '退勤時 GPS経度';
COMMENT ON COLUMN attendance_records.check_out_accuracy IS '退勤時 GPS測定精度(m)';
COMMENT ON COLUMN attendance_records.check_out_device IS '退勤時 打刻端末種別 (mobile / pc)';
