-- 有給・申請の通知を送信するための Webhook (pg_net) トリガー

-- 1. pg_net 拡張機能の有効化 (まだ有効になっていない場合)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. 申請時のメール送信を行う関数
CREATE OR REPLACE FUNCTION notify_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  applicant_name VARCHAR;
  my_approver_id UUID;
  tenant_name VARCHAR;
  -- APIキーは実際に取得したResendのAPIキーに後で置き換えます
  resend_api_key VARCHAR := 're_UNi2rZ3s_GhwfvdDoLqFVK5zN3nMkNoes';
  -- 送信元アドレス（Resendで設定したドメイン、またはテスト用のアドレス）
  from_email VARCHAR := 'onboarding@resend.dev';
  -- 本番公開時に、実際のURL（Firebase HostingのURL等）に変更してください
  system_url VARCHAR := 'http://localhost:5174';
  
  -- 送信先（上司 または 管理者）のメールアドレスリスト
  admin_emails JSONB;
  request_body JSONB;
BEGIN
  -- 申請者の名前と、上司（approver_id）を取得
  SELECT name, approver_id INTO applicant_name, my_approver_id FROM users WHERE id = NEW.user_id;
  
  -- 上司（approver_id）が設定されている場合は、その上司のメールアドレスを取得
  IF my_approver_id IS NOT NULL THEN
    SELECT json_build_array(email) INTO admin_emails FROM users WHERE id = my_approver_id;
  ELSE
    -- 上司が設定されていない場合は、そのテナント（企業）の管理者(role='admin')のメールアドレスを全て取得
    SELECT json_agg(email) INTO admin_emails 
    FROM users 
    WHERE tenant_id = NEW.tenant_id AND role = 'admin';
  END IF;

  -- もし管理者が取得できなかった場合は処理を中断
  IF admin_emails IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resendに送信するJSONボディの作成
  request_body := json_build_object(
    'from', from_email,
    'to', admin_emails,
    'subject', '【勤怠システム】' || applicant_name || 'さんから各種申請がありました',
    'html', '<p>' || applicant_name || 'さんから申請（' || NEW.type || '）が提出されました。</p>' ||
            '<p>期間: ' || NEW.start_date || ' ～ ' || NEW.end_date || '</p>' ||
            '<p>理由: ' || COALESCE(NEW.reason, '記載なし') || '</p>' ||
            '<hr><p>システムから承認・却下の手続きをお願いします。</p>' ||
            '<p><a href="' || system_url || '" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:5px;">管理画面を開く</a></p>'
  );

  -- pg_netを使用して非同期でHTTP POSTリクエストを送信
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := json_build_object(
      'Authorization', 'Bearer ' || resend_api_key,
      'Content-Type', 'application/json'
    )::jsonb,
    body := request_body
  );

  RETURN NEW;
END;
$$;

-- 3. 古いトリガーがあれば削除
DROP TRIGGER IF EXISTS on_leave_request_insert ON leave_requests;

-- 4. leave_requests テーブルへのINSERT時に動作するトリガーを作成
CREATE TRIGGER on_leave_request_insert
  AFTER INSERT ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_leave_request();
