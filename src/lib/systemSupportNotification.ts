import { supabase } from './supabase';
import type { SystemImprovementSuggestion } from './systemSupportManager';

/**
 * 📬 システム改善要望・Q&A お知らせ ＆ メール通知管理モジュール
 */

export interface SystemNotificationSettings {
  enabled: boolean;
  recipient_emails: string[]; // 通知先メールアドレス
  gas_webhook_url?: string;   // GAS Webhook URL (推奨: Gmailから送信)
  custom_webhook_url?: string;// 汎用Webhook URL
  notify_on_new_suggestion: boolean;
  browser_notification_enabled: boolean;
  updated_at?: string;
}

const SETTINGS_STORAGE_KEY = 'kap_system_notification_settings_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: SystemNotificationSettings = {
  enabled: true,
  recipient_emails: ['support@kap-cocotte.com'],
  gas_webhook_url: '',
  custom_webhook_url: '',
  notify_on_new_suggestion: true,
  browser_notification_enabled: true
};

// 📋 GAS（Google Apps Script）用メール送信テンプレート
export const GAS_MAIL_SCRIPT_TEMPLATE = `/**
 * 【KAP勤怠・システム改善要望＆Q&A 自動メール通知スクリプト】
 * 
 * 1. Google Drive または script.google.com で新規スクリプトを作成
 * 2. このコードをそのまま貼り付けて保存
 * 3. 右上の「デプロイ」>「新しいデプロイ」を選択
 * 4. 種類:「ウェブアプリ」
 *    - 次のユーザーとして実行:「自分」
 *    - アクセスできるユーザー:「全員 (Anyone)」
 * 5. 発行された「ウェブアプリのURL」を本システムの管理画面に貼り付けるだけで完了！
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var recipients = data.recipient_emails || [];
    if (typeof recipients === 'string') recipients = [recipients];
    
    if (recipients.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '宛先メールアドレスがありません' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var subject = data.subject || "【KAP勤怠】新しいシステム改善要望・Q&Aが届きました";
    var tenantName = data.tenant_name || "未設定企業";
    var userName = data.user_name || "未設定ユーザー";
    var categoryLabel = data.category_label || "その他";
    var title = data.title || "無題";
    var content = data.content || "（本文なし）";
    var adminUrl = data.admin_url || "https://kintai.kap-cocotte.com/super-admin";
    var createdAt = data.created_at ? Utilities.formatDate(new Date(data.created_at), "JST", "yyyy/MM/dd HH:mm:ss") : Utilities.formatDate(new Date(), "JST", "yyyy/MM/dd HH:mm:ss");

    var body = 
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" +
      "【KAP勤怠】システム改善要望・Q&Aが届きました\\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n" +
      "■ 受信日時: " + createdAt + "\\n" +
      "■ 送信元企業: " + tenantName + "\\n" +
      "■ 送信者氏名: " + userName + " 様\\n" +
      "■ カテゴリ: " + categoryLabel + "\\n" +
      "■ タイトル: " + title + "\\n\\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" +
      "【ご要望・質問内容】\\n" +
      content + "\\n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n" +
      "▼ 特権管理画面（改善要望回収デスク）で確認・対応する:\\n" +
      adminUrl + "\\n\\n" +
      "※ 本メールはKAP勤怠システムより自動送信されています。";

    var htmlBody = 
      "<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;'>" +
      "  <div style='background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px;'>" +
      "    <h2 style='margin: 0; font-size: 18px;'>📬 新しい改善要望・Q&Aが届きました</h2>" +
      "    <p style='margin: 4px 0 0; font-size: 12px; opacity: 0.9;'>KAP勤怠・有給管理システム 特権統括通知</p>" +
      "  </div>" +
      "  <table style='width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;'>" +
      "    <tr><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 120px;'><strong>送信元企業</strong></td><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #1e293b;'>" + tenantName + "</td></tr>" +
      "    <tr><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;'><strong>送信者氏名</strong></td><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b;'>" + userName + " 様</td></tr>" +
      "    <tr><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;'><strong>カテゴリ</strong></td><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #4f46e5; font-weight: bold;'>" + categoryLabel + "</td></tr>" +
      "    <tr><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;'><strong>タイトル</strong></td><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #0f172a; font-size: 15px;'>" + title + "</td></tr>" +
      "    <tr><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;'><strong>受付日時</strong></td><td style='padding: 8px; border-bottom: 1px solid #f1f5f9; color: #64748b;'>" + createdAt + "</td></tr>" +
      "  </table>" +
      "  <div style='background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;'>" +
      "    <div style='font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: bold;'>【内容】</div>" +
      "    <div style='font-size: 14px; color: #334155; white-space: pre-wrap; line-height: 1.6;'>" + content + "</div>" +
      "  </div>" +
      "  <div style='text-align: center; margin-top: 24px;'>" +
      "    <a href='" + adminUrl + "' style='display: inline-block; background-color: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;'>特権管理画面で確認・返信する</a>" +
      "  </div>" +
      "  <p style='margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8;'>※ 本メールはKAP勤怠システムからの自動通知です。</p>" +
      "</div>";

    recipients.forEach(function(email) {
      if (email && email.indexOf('@') !== -1) {
        GmailApp.sendEmail(email.trim(), subject, body, {
          htmlBody: htmlBody,
          name: "KAP勤怠 サポート本部"
        });
      }
    });

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok', count: recipients.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;

/**
 * 通知設定の取得
 */
export async function fetchNotificationSettings(): Promise<SystemNotificationSettings> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('notification_settings')
      .limit(1)
      .maybeSingle();

    if (!error && data?.notification_settings) {
      const parsed = typeof data.notification_settings === 'string' 
        ? JSON.parse(data.notification_settings) 
        : data.notification_settings;
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed));
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('DB notification settings not accessible, checking local:', e);
  }

  const local = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (local) {
    try {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(local) };
    } catch (e) { /* ignore */ }
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

/**
 * 通知設定の保存
 */
export async function saveNotificationSettings(settings: SystemNotificationSettings): Promise<boolean> {
  const updated: SystemNotificationSettings = {
    ...settings,
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));

  try {
    const { data: existing } = await supabase
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('system_settings')
        .update({ notification_settings: updated })
        .eq('id', existing.id);
    }
  } catch (e) {
    console.warn('Could not save notification settings to DB:', e);
  }

  return true;
}

/**
 * 改善要望・Q&Aが投稿された際の自動メール通知
 */
export async function sendSuggestionNotification(
  suggestion: SystemImprovementSuggestion
): Promise<{ success: boolean; message: string }> {
  try {
    const settings = await fetchNotificationSettings();
    if (!settings.enabled || !settings.notify_on_new_suggestion) {
      return { success: true, message: '通知設定が無効のためスキップされました' };
    }

    if (!settings.recipient_emails || settings.recipient_emails.length === 0) {
      return { success: false, message: '通知先メールアドレスが設定されていません' };
    }

    const categoryLabels: Record<string, string> = {
      feature: '🚀 新機能リクエスト',
      ui_ux: '🎨 画面・使いやすさ改善',
      bug: '🐛 不具合・動作報告',
      performance: '⚡ 表示速度・快適化',
      other: '💬 Q&A・ご意見・ご要望'
    };

    const categoryLabel = categoryLabels[suggestion.category] || suggestion.category;
    const subject = `【KAP勤怠】${suggestion.tenant_name} 様より改善要望・Q&Aが届きました（${suggestion.title}）`;

    const payload = {
      action: 'new_suggestion',
      recipient_emails: settings.recipient_emails,
      subject,
      tenant_name: suggestion.tenant_name,
      user_name: suggestion.user_name,
      category: suggestion.category,
      category_label: categoryLabel,
      title: suggestion.title,
      content: suggestion.content,
      created_at: suggestion.created_at,
      admin_url: 'https://kintai.kap-cocotte.com/super-admin'
    };

    // ① GAS Webhook への送信（優先）
    if (settings.gas_webhook_url && settings.gas_webhook_url.trim()) {
      try {
        await fetch(settings.gas_webhook_url.trim(), {
          method: 'POST',
          mode: 'no-cors', // GAS Web App の CORS 制限を透過
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        console.log('Notification dispatched to GAS Webhook successfully.');
      } catch (gasErr) {
        console.warn('GAS Webhook dispatch error:', gasErr);
      }
    }

    // ② 汎用カスタムWebhookへの送信（設定されている場合）
    if (settings.custom_webhook_url && settings.custom_webhook_url.trim()) {
      try {
        await fetch(settings.custom_webhook_url.trim(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (customErr) {
        console.warn('Custom Webhook dispatch error:', customErr);
      }
    }

    return { success: true, message: '通知が正常に発火されました' };
  } catch (err: any) {
    console.error('sendSuggestionNotification error:', err);
    return { success: false, message: err.message || '送信処理中にエラーが発生しました' };
  }
}

/**
 * テストメール送信
 */
export async function sendTestNotificationEmail(
  targetEmail: string,
  webhookUrl?: string
): Promise<{ success: boolean; message: string }> {
  if (!targetEmail || !targetEmail.includes('@')) {
    return { success: false, message: '有効なメールアドレスを入力してください' };
  }

  const testPayload = {
    action: 'test_notification',
    recipient_emails: [targetEmail],
    subject: '【KAP勤怠・テスト通知】メール送信連携テストが成功しました',
    tenant_name: '株式会社テスト（システム検証）',
    user_name: 'システム管理者',
    category: 'feature',
    category_label: '🔔 メール連携接続テスト',
    title: 'メール通知機能のテスト疎通確認',
    content: 'このメールは、KAP勤怠システムの特権管理画面より送信された接続テスト通知です。\n本メールが正常に届いていれば、新着の改善要望やQ&Aが投稿された際にも自動でメール通知が送信されます！',
    created_at: new Date().toISOString(),
    admin_url: 'https://kintai.kap-cocotte.com/super-admin'
  };

  const url = webhookUrl || (await fetchNotificationSettings()).gas_webhook_url;
  if (!url || !url.trim()) {
    return { 
      success: false, 
      message: 'GAS Webhook URLが設定されていません。GASスクリプトをデプロイしてURLを入力してください。' 
    };
  }

  try {
    await fetch(url.trim(), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    return { 
      success: true, 
      message: `${targetEmail} 宛てにテスト送信リクエストを送信しました！間もなく受信トレイへ届きます。` 
    };
  } catch (err: any) {
    return { 
      success: false, 
      message: `送信エラー: ${err.message}` 
    };
  }
}

/**
 * デスクトップ通知（ブラウザ通知）の発火
 */
export function triggerDesktopNotification(title: string, body: string) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    });
  }
}
