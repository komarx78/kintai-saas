-- ==============================================================================
-- 🧹 アルバイト・パート専用 9月度ダミー打刻クリーンアップSQL
-- ※ 正社員（full-time）および管理者の打刻は1件も削除せず、アルバイトのみを対象とします
-- ==============================================================================

-- 1. 安全確認（削除対象件数の事前確認用カウント）
-- SELECT COUNT(*) FROM public.attendance_records
-- WHERE user_id IN (
--   SELECT id FROM public.users 
--   WHERE employment_type IN ('part-time', 'パート')
--     AND role NOT IN ('admin', 'superadmin')
-- )
-- AND date >= '2026-09-01' AND date <= '2026-09-30';

-- 2. 実行用DELETE文（アルバイトの9月度ダミー打刻のみをピンポイント削除）
DELETE FROM public.attendance_records
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE employment_type IN ('part-time', 'パート')
    AND role NOT IN ('admin', 'superadmin')
)
AND date >= '2026-09-01' AND date <= '2026-09-30';

-- 3. 実行完了メッセージ
SELECT '✅ アルバイト・パートの9月度ダミー打刻クリーンアップが安全に完了しました。正社員のデータは保護されています。' AS result;
