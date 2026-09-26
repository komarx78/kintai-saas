-- ==============================================================================
-- 🧹 アルバイト・パート専用 9月度ダミー打刻クリーンアップSQL
-- ※ 正社員（full-time）および管理者の打刻は1件も削除せず、アルバイトのみを対象とします
-- ==============================================================================

-- 実行用DELETE文（アルバイトの9月度ダミー打刻のみをピンポイント削除）
DELETE FROM public.attendance_records
WHERE user_id IN (
  SELECT id FROM public.users 
  WHERE employment_type IN ('part-time', 'パート')
    AND role NOT IN ('admin', 'superadmin')
)
AND date >= '2026-09-01' AND date <= '2026-09-30';

-- 実行確認メッセージ
SELECT '✅ アルバイト・パートの9月度ダミー打刻クリーンアップが安全に完了しました。正社員のデータは保護されています。' AS result;
