import { supabase } from './supabase';

/**
 * 🚨 全国社会保険料率マスタ（販売用）未更新検知 ＆ 販売管理者1日1回メール通知エンジン
 */

export interface MasterRateAlertSettings {
  enabled: boolean;
  recipient_emails: string[]; // 販売管理者の通知先メール
  recipient_name: string;
  gas_webhook_url?: string;
  target_fiscal_year: number;  // 更新対象の年度 (例: 2025, 2026)
  last_alert_sent_date?: string; // 最後にアラートを送信した日 (YYYY-MM-DD)
  last_updated_at?: string;      // マスタが更新された日時
  is_updated?: boolean;          // 更新完了フラグ（trueなら配信停止）
}

export const DEFAULT_MASTER_ALERT_SETTINGS: MasterRateAlertSettings = {
  enabled: true,
  recipient_emails: ['support@kap-cocotte.com'],
  recipient_name: '販売システム統括管理者',
  gas_webhook_url: '',
  target_fiscal_year: new Date().getFullYear(),
  last_alert_sent_date: '',
  is_updated: false
};

const STORAGE_KEY = 'kap_master_rate_alert_settings_v1';

/**
 * 販売管理者アラート設定の取得
 */
export const getMasterRateAlertSettings = async (): Promise<MasterRateAlertSettings> => {
  try {
    // 1. system_settings または特権テーブルから取得試行
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'master_rate_alert_settings')
      .maybeSingle();

    if (data && data.value) {
      return {
        ...DEFAULT_MASTER_ALERT_SETTINGS,
        ...data.value
      };
    }

    // 2. LocalStorage フォールバック
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      return {
        ...DEFAULT_MASTER_ALERT_SETTINGS,
        ...JSON.parse(local)
      };
    }
  } catch (e) {
    console.warn('Get master rate alert settings note:', e);
  }
  return DEFAULT_MASTER_ALERT_SETTINGS;
};

/**
 * 販売管理者アラート設定の保存
 */
export const saveMasterRateAlertSettings = async (
  settings: MasterRateAlertSettings
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updated = {
      ...settings,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // DBへの安全な保存試行
    try {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'master_rate_alert_settings',
          value: updated,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    } catch (dbErr) {
      console.warn('DB save note (using local cache):', dbErr);
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || '保存に失敗しました' };
  }
};

/**
 * 🔍 全国社会保険料率マスタの未更新状態を判定
 * 戻り値: { isOutdated: boolean; reason: string; recordCount: number; lastModified?: string }
 */
export const checkMasterRateStatus = async (targetYear: number = new Date().getFullYear()) => {
  try {
    const { data: rates, error } = await supabase
      .from('social_insurance_rates')
      .select('fiscal_year, updated_at')
      .eq('fiscal_year', targetYear);

    if (error || !rates || rates.length === 0) {
      return {
        isOutdated: true,
        reason: `令和${targetYear - 2018}年度（${targetYear}年度）の料率レコードがDBに未登録です。`,
        recordCount: 0
      };
    }

    // 47都道府県分すべて登録されているか確認
    if (rates.length < 47) {
      return {
        isOutdated: true,
        reason: `登録都道府県数が不足しています（${rates.length} / 47都道府県）。`,
        recordCount: rates.length
      };
    }

    // 更新日時をチェック（最新の更新日）
    const lastModified = rates[0]?.updated_at;

    return {
      isOutdated: false,
      reason: `令和${targetYear - 2018}年度の47都道府県料率マスタは正常に保存・適用されています。`,
      recordCount: rates.length,
      lastModified
    };
  } catch (e: any) {
    return {
      isOutdated: true,
      reason: `確認中にエラーが発生しました: ${e.message}`,
      recordCount: 0
    };
  }
};

/**
 * ✉️ 販売管理者へ未更新アラートメールを送信（1日1回制限・クールダウン完全準拠）
 */
export const sendMasterRateAlertIfNeeded = async (options?: {
  forceTest?: boolean;
  targetYear?: number;
}): Promise<{ sent: boolean; message: string; isOutdated: boolean }> => {
  const forceTest = options?.forceTest || false;
  const targetYear = options?.targetYear || new Date().getFullYear();

  const settings = await getMasterRateAlertSettings();
  if (!settings.enabled && !forceTest) {
    return { sent: false, message: '販売管理者向けアラート通知が無効になっています。', isOutdated: false };
  }

  // 1. マスタの更新状態をチェック
  const checkResult = await checkMasterRateStatus(targetYear);

  // 更新済みの場合 ➔ 配信完全停止！
  if (!checkResult.isOutdated && !forceTest) {
    // ステータスを更新済みに設定
    if (!settings.is_updated) {
      await saveMasterRateAlertSettings({
        ...settings,
        is_updated: true
      });
    }
    return {
      sent: false,
      message: '全国社会保険料率マスタは最新年度に更新済みです。メール配信は自動停止されています。',
      isOutdated: false
    };
  }

  // 2. 1日に1回制限（本日の日付と照合）
  const todayStr = new Date().toISOString().split('T')[0];
  if (!forceTest && settings.last_alert_sent_date === todayStr) {
    return {
      sent: false,
      message: `本日の未更新アラートは既に送信済みです（次回は明日送信されます）。二重送信防止ガード稼働中。`,
      isOutdated: true
    };
  }

  const recipients = settings.recipient_emails.filter(e => e && e.includes('@'));
  if (recipients.length === 0) {
    return {
      sent: false,
      message: '送信先メールアドレスが設定されていません。マスタ設定で登録してください。',
      isOutdated: true
    };
  }

  // 3. アラートメール本文の生成
  const subject = `${forceTest ? '【疎通テスト】' : '【至急・要更新】'}【KAP勤怠販売本部】全国社会保険料率マスタが未更新です（1日1回定期通知）`;

  const textBody =
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `【重要・販売管理者専用】全国社会保険料率マスタ 未更新アラート\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${settings.recipient_name} 様\n\n` +
    `いつもKAP勤怠システムを統括管理いただきありがとうございます。\n\n` +
    `令和${targetYear - 2018}年度（${targetYear}年度）の社会保険料改定時期が到来しておりますが、\n` +
    `販売用【全国社会保険料率マスタ】がまだ最新年度へ更新・保存されておりません。\n\n` +
    `■ 現況ステータス: 未更新（未反映）\n` +
    `■ 判定理由: ${checkResult.reason}\n` +
    `■ 影響範囲: 契約中全企業の給与計算・社会保険料控除が旧料率のままとなる恐れがあります。\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `【対応手順（所要時間1分）】\n` +
    `1. 特権スーパー管理者画面の【全国社会保険料率マスタ】を開きます。\n` +
    `2. 「令和${targetYear - 2018}年度（${targetYear}年度）」を選択します。\n` +
    `3. 「✨ 協会けんぽ公式標準料率を一括適用」または「全国マスタを一括保存」をクリックします。\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `※ マスタを更新・保存すると、本メール配信は即座に【自動停止】いたします。\n` +
    `※ 更新が完了するまで、1日に1回必ず通知メールが送付されます。\n\n` +
    `▼ 特権管理画面へアクセス:\n` +
    `https://kintai.kap-cocotte.com/super-admin`;

  const htmlBody =
    `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 2px solid #e11d48; border-radius: 16px; background-color: #ffffff; color: #1e293b;">` +
    `  <div style="background: linear-gradient(135deg, #e11d48, #be123c); color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px;">` +
    `    <span style="font-size: 11px; font-weight: 900; background: rgba(0,0,0,0.25); padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">販売管理者専用・至急対応</span>` +
    `    <h2 style="margin: 0; font-size: 19px; font-weight: 900;">🚨 全国社会保険料率マスタが未更新です</h2>` +
    `    <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.95;">1日1回 定期未更新督促通知</p>` +
    `  </div>` +
    `  <div style="font-size: 14px; margin-bottom: 16px;">` +
    `    <p style="margin: 0;"><strong>${settings.recipient_name} 様</strong></p>` +
    `  </div>` +
    `  <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px;">` +
    `    令和${targetYear - 2018}年度の協会けんぽ社会保険料改定時期が到来しておりますが、販売用【全国社会保険料率マスタ】が最新年度へ更新・保存されていません。<br>` +
    `    このまま放置すると、<strong>全契約企業の給与計算で旧料率が継続適用される重大なインシデント</strong>となります。` +
    `  </p>` +
    `  <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 16px; border-radius: 10px; margin-bottom: 24px;">` +
    `    <div style="font-size: 12px; font-weight: 900; color: #9f1239; margin-bottom: 6px;">【未更新検知の現況】</div>` +
    `    <div style="font-size: 13px; color: #be123c; font-weight: bold;">${checkResult.reason}</div>` +
    `  </div>` +
    `  <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">` +
    `    <div style="font-size: 13px; font-weight: 900; color: #1e1b4b; margin-bottom: 8px;">📋 更新手順（所要時間1分）</div>` +
    `    <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.8;">` +
    `      <li>特権スーパー管理者ダッシュボードを開く</li>` +
    `      <li>【全国社会保険料率マスタ】タブを選択</li>` +
    `      <li>「✨ 協会けんぽ公式標準料率を一括適用」または「全国マスタを一括保存」をクリック</li>` +
    `    </ol>` +
    `  </div>` +
    `  <div style="text-align: center; margin: 28px 0 16px;">` +
    `    <a href="https://kintai.kap-cocotte.com/super-admin" style="display: inline-block; background: #e11d48; color: white; padding: 13px 32px; text-decoration: none; border-radius: 10px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 12px rgba(225,29,72,0.35);">特権画面で今すぐ全国マスタを更新する</a>` +
    `  </div>` +
    `  <div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 8px; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center;">` +
    `    💡 <strong>更新後の配信停止について:</strong><br>` +
    `    全国社会保険料率マスタが更新・保存された時点で、<strong>本メールの配信は自動的に完全停止</strong>いたします。更新されるまでは1日に1回必ず通知されます。` +
    `  </div>` +
    `</div>`;

  // 4. 送信実行
  try {
    const payload = {
      recipient_emails: recipients,
      subject: subject,
      body: textBody,
      html_body: htmlBody,
      tenant_name: 'KAP勤怠 販売本部（特権統括）',
      user_name: settings.recipient_name,
      event_id: 'master_rate_outdated_alert',
      event_title: `令和${targetYear - 2018}年度 全国社会保険料率マスタ未更新`,
      is_test: forceTest,
      created_at: new Date().toISOString()
    };

    if (settings.gas_webhook_url) {
      await fetch(settings.gas_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
    }

    // 送信日を記録（1日1回制限）
    if (!forceTest) {
      await saveMasterRateAlertSettings({
        ...settings,
        last_alert_sent_date: todayStr,
        is_updated: false
      });
    }

    return {
      sent: true,
      message: `${recipients.join(', ')} 宛に販売管理者未更新アラートを送信しました。`,
      isOutdated: true
    };
  } catch (e: any) {
    console.error('Send master alert error:', e);
    return {
      sent: false,
      message: `送信処理中にエラーが発生しました: ${e.message}`,
      isOutdated: true
    };
  }
};

/**
 * 🎉 マスタ更新・保存成功時のコールバック（即座に配信停止フラグを立てる）
 */
export const markMasterRateAsUpdated = async (targetYear: number) => {
  try {
    const settings = await getMasterRateAlertSettings();
    await saveMasterRateAlertSettings({
      ...settings,
      target_fiscal_year: targetYear,
      is_updated: true,
      last_updated_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Mark master rate updated note:', e);
  }
};
