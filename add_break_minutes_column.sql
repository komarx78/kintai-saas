-- ⏰ 勤怠レコード（attendance_records）に休憩時間（分）カラムを追加
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT NULL;

-- カラムの説明コメント
COMMENT ON COLUMN attendance_records.break_minutes IS '個別登録・申請された休憩時間（分）。未設定（NULL）の場合は法定所定の自動控除（6h超45分、8h超60分等）を適用';
