import { supabase } from './supabase';

/**
 * 📅 年間公的労務・社会保険料改定スケジュール＆リマインダー通知マネージャー
 */

export interface OfficialReminderEvent {
  id: string;
  month: number; // 1〜12 (主な発生月)
  title: string;
  category: 'social_rate' | 'official_report' | 'year_end' | 'bonus';
  categoryLabel: string;
  deadlineDescription: string;
  advanceNoticeTiming: string; // "前月15日頃 / 当月1日"
  summary: string;
  actionItems: string[];
  targetDocumentName: string;
  recommendedLink: string;
}

// 🏛️ 年間公的労務・法定期限カレンダー（全国共通・法廷スケジュール）
export const OFFICIAL_ANNUAL_EVENTS: OfficialReminderEvent[] = [
  {
    id: 'health_rate_march',
    month: 3,
    title: '健康保険・介護保険料率の改定（3月分 / 4月給与控除開始）',
    category: 'social_rate',
    categoryLabel: '社会保険料率改定',
    deadlineDescription: '毎年3月分（4月納付・4月支給給与から新料率適用）',
    advanceNoticeTiming: '2月中旬 ＆ 3月1日',
    summary: '協会けんぽ各都道府県支部の健康保険料率および全国一律の介護保険料率（40歳以上）が改定されます。',
    actionItems: [
      '【🏢 会社設定 ➔ 社会保険料マスタ】を開き、都道府県の新保険料率を確認・適用',
      '4月支給の給与計算において、健康保険料・介護保険料の新控除額が正しく反映されているか確認',
      '従業員へ料率改定のお知らせを周知'
    ],
    targetDocumentName: '健康保険・厚生年金保険 被保険者資格取得・喪失届',
    recommendedLink: '/company-settings'
  },
  {
    id: 'employment_rate_april',
    month: 4,
    title: '雇用保険料率の改定（4月1日〜翌年3月31日）',
    category: 'social_rate',
    categoryLabel: '労働保険料率改定',
    deadlineDescription: '毎年4月1日以降に支払われる賃金から適用',
    advanceNoticeTiming: '3月下旬 ＆ 4月1日',
    summary: '厚生労働省告示に基づき、新年度の雇用保険料率（労働者負担・事業者負担）が改定されます。',
    actionItems: [
      '厚労省発表の新雇用保険料率（一般事業等）をシステムマスタで確認',
      '4月度給与計算における雇用保険料控除額の自動計算を確認',
      '新入社員の雇用保険資格取得届を提出'
    ],
    targetDocumentName: '雇用保険被保険者資格取得届',
    recommendedLink: '/payroll'
  },
  {
    id: 'labor_insurance_june',
    month: 6,
    title: '労働保険（労災・雇用）年度更新 概算・確定保険料申告',
    category: 'official_report',
    categoryLabel: '公的届出申告',
    deadlineDescription: '毎年6月1日 〜 7月10日（厳守）',
    advanceNoticeTiming: '5月20日 ＆ 6月1日 ＆ 7月1日（締切10日前）',
    summary: '前年度（前年4月〜当年3月）の確定保険料と新年度の概算保険料を計算し、労働局・労基署へ申告・納付します。',
    actionItems: [
      '【労務・法定帳票発行センター】で「労働保険料 概算・確定保険料算定資料」を一撃自動出力',
      '役員除く全従業員の年間賃金総額および雇用保険対象賃金を確認',
      '労働局または金融機関窓口にて申告書提出および納付手続きを完了'
    ],
    targetDocumentName: '労働保険 確定・概算保険料算定基礎集計表',
    recommendedLink: '/payroll'
  },
  {
    id: 'standard_remuneration_july',
    month: 7,
    title: '社会保険 算定基礎届（定時決定）の届出',
    category: 'official_report',
    categoryLabel: '公的届出申告',
    deadlineDescription: '毎年7月1日 〜 7月10日（厳守）',
    advanceNoticeTiming: '6月20日 ＆ 7月1日 ＆ 7月7日（直前リマインド）',
    summary: '4月・5月・6月の給与支払実績に基づき、全被保険者の新標準報酬月額を日本年金機構へ届出します。',
    actionItems: [
      '4〜6月の賃金台帳・出勤日数を確定',
      '【労務・法定帳票発行センター】で算定基礎届の提出データを作成・確認',
      '所轄年金事務所または事務センターへ郵送・電子申請にて提出'
    ],
    targetDocumentName: '被保険者算定基礎届（定時決定）',
    recommendedLink: '/payroll'
  },
  {
    id: 'grade_change_september',
    month: 9,
    title: '定時決定による新標準報酬月額の適用（9月分 / 10月給与控除開始）',
    category: 'social_rate',
    categoryLabel: '社会保険等級改定',
    deadlineDescription: '毎年9月分（翌月控除の場合は10月支給給与から反映）',
    advanceNoticeTiming: '9月1日 ＆ 9月25日',
    summary: '年金事務所から届く「標準報酬決定通知書」の等級を給与計算マスタへ反映し、健康保険・厚生年金控除額を更新します。',
    actionItems: [
      '年金機構より届いた「標準報酬決定通知書」の内容を確認',
      '従業員の標準報酬月額マスタを更新し、10月支給給与の控除額を改定',
      '標準報酬月額変更のお知らせ（改定通知書）を従業員へ配布'
    ],
    targetDocumentName: '標準報酬決定通知書連動データ',
    recommendedLink: '/company-settings'
  },
  {
    id: 'year_end_tax_november',
    month: 11,
    title: '年末調整 申告書類の配布・回収・源泉徴収簿作成',
    category: 'year_end',
    categoryLabel: '年末調整',
    deadlineDescription: '11月上旬〜12月中旬（給与計算確定まで）',
    advanceNoticeTiming: '10月下旬 ＆ 11月15日 ＆ 12月1日',
    summary: '扶養控除等申告書、基礎控除・配偶者控除等申告書、保険料控除申告書を回収し、年税額を精算します。',
    actionItems: [
      '従業員へ各種控除申告書の案内と回収（生命保険料・地震保険料控除証明書等）',
      '【労務・法定帳票発行センター】で「源泉徴収簿（国税庁様式）」を作成',
      '12月支給給与（または賞与）にて年税額の過不足税額を精算・還付'
    ],
    targetDocumentName: '給与所得・退職所得に対する源泉徴収簿',
    recommendedLink: '/payroll'
  },
  {
    id: 'salary_report_january',
    month: 1,
    title: '給与支払報告書（市区町村）・法定調書合計表（税務署）の提出',
    category: 'official_report',
    categoryLabel: '法定帳票提出',
    deadlineDescription: '毎年1月31日（厳守）',
    advanceNoticeTiming: '1月10日 ＆ 1月20日',
    summary: '全従業員の給与支払報告書（総括表・個人別明細書）を各市区町村へ、法定調書合計表を所轄税務署へ提出します。',
    actionItems: [
      '前年1月〜12月の確定給与総額・源泉徴収票を確認',
      '従業員の現住所が属する各市区町村へ給与支払報告書を送付',
      '所轄税務署へ給与所得の源泉徴収票等の法定調書合計表を提出'
    ],
    targetDocumentName: '給与支払報告書 ＆ 法定調書合計表',
    recommendedLink: '/payroll'
  },
  {
    id: 'bonus_report_any',
    month: 0, // 随時（賞与月）
    title: '被保険者賞与支払届の提出（賞与支給日から5日以内）',
    category: 'bonus',
    categoryLabel: '随時公的届出',
    deadlineDescription: '賞与支給日から5日以内（日本年金機構）',
    advanceNoticeTiming: '賞与計算確定時 ＆ 支給当日',
    summary: '役員賞与・従業員賞与を支給した際、健康保険・厚生年金保険料を算定・納付するため年金事務所へ提出します。',
    actionItems: [
      '【労務・法定帳票発行センター】で「賞与支払届（年金機構公式様式）」を作成',
      '千円未満切捨の賞与総支給額・被保険者番号・生年月日を確認',
      '支給後速やかに年金事務所へ提出'
    ],
    targetDocumentName: '被保険者賞与支払届',
    recommendedLink: '/payroll'
  }
];

// ⚙️ 宛先マスタ設定インターフェース
export interface OfficialReminderSettings {
  enabled: boolean;
  recipient_emails: string[]; // 主担当・通知先メールアドレス一覧
  recipient_name: string;     // 担当者氏名
  gas_webhook_url?: string;   // GAS Webhook URL (Gmail自動送信)
  custom_webhook_url?: string;// 汎用Webhook URL
  notify_1month_before: boolean; // 1ヶ月前通知
  notify_2weeks_before: boolean; // 2週間前通知
  notify_on_month: boolean;      // 当月開始時通知
  event_toggles: Record<string, boolean>; // イベント個別の有効・無効
  updated_at?: string;
}

export const DEFAULT_OFFICIAL_REMINDER_SETTINGS: OfficialReminderSettings = {
  enabled: true,
  recipient_emails: [],
  recipient_name: '人事労務ご担当者',
  gas_webhook_url: '',
  custom_webhook_url: '',
  notify_1month_before: true,
  notify_2weeks_before: true,
  notify_on_month: true,
  event_toggles: {
    health_rate_march: true,
    employment_rate_april: true,
    labor_insurance_june: true,
    standard_remuneration_july: true,
    grade_change_september: true,
    year_end_tax_november: true,
    salary_report_january: true,
    bonus_report_any: true
  }
};

const STORAGE_KEY_PREFIX = 'kap_official_reminder_settings_';

/**
 * 宛先マスタ設定の取得（DB ➔ LocalStorage フォールバック）
 */
export const getOfficialReminderSettings = async (tenantId: string): Promise<OfficialReminderSettings> => {
  if (!tenantId) return DEFAULT_OFFICIAL_REMINDER_SETTINGS;
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('official_reminder_settings, notification_email, representative_name')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant && (tenant as any).official_reminder_settings) {
      return {
        ...DEFAULT_OFFICIAL_REMINDER_SETTINGS,
        ...(tenant as any).official_reminder_settings
      };
    }

    // LocalStorage フォールバック
    const local = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tenantId}`);
    if (local) {
      return {
        ...DEFAULT_OFFICIAL_REMINDER_SETTINGS,
        ...JSON.parse(local)
      };
    }

    // テナントの基本メールがある場合はそれを初期値に
    const fallbackEmails: string[] = [];
    if (tenant?.notification_email) fallbackEmails.push(tenant.notification_email);

    return {
      ...DEFAULT_OFFICIAL_REMINDER_SETTINGS,
      recipient_emails: fallbackEmails,
      recipient_name: tenant?.representative_name ? `${tenant.representative_name} 様` : '人事労務ご担当者'
    };
  } catch (e) {
    console.warn('Get official reminder settings error:', e);
    return DEFAULT_OFFICIAL_REMINDER_SETTINGS;
  }
};

/**
 * 宛先マスタ設定の保存（DB ＆ LocalStorage ダブル永続化）
 */
export const saveOfficialReminderSettings = async (
  tenantId: string,
  settings: OfficialReminderSettings
): Promise<{ success: boolean; error?: string }> => {
  if (!tenantId) return { success: false, error: 'テナントIDが指定されていません' };
  try {
    const updated = {
      ...settings,
      updated_at: new Date().toISOString()
    };

    // 1. LocalStorageへ即時保存
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));

    // 2. tenantsテーブルのofficial_reminder_settingsへ保存試行
    const { error } = await supabase
      .from('tenants')
      .update({ official_reminder_settings: updated } as any)
      .eq('id', tenantId);

    if (error) {
      console.warn('DB update failed, using localStorage cache:', error.message);
    }

    return { success: true };
  } catch (e: any) {
    console.error('Save official reminder settings error:', e);
    return { success: false, error: e.message || '保存に失敗しました' };
  }
};

/**
 * 送信クールダウン判定（憲法10条遵守：同一事象に対する重複送信物理遮断）
 */
const checkCooldown = (tenantId: string, eventId: string): boolean => {
  try {
    const key = `kap_reminder_cooldown_${tenantId}_${eventId}`;
    const lastSent = localStorage.getItem(key);
    if (!lastSent) return true; // 送信可能
    const sentTime = new Date(lastSent).getTime();
    const now = Date.now();
    // 最低24時間は同一イベントの再送を遮断
    return (now - sentTime) > 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
};

const recordCooldown = (tenantId: string, eventId: string) => {
  try {
    const key = `kap_reminder_cooldown_${tenantId}_${eventId}`;
    localStorage.setItem(key, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to record cooldown:', e);
  }
};

/**
 * ✉️ リマインダー通知メールの送信処理（GAS Webhook または 直通通知）
 */
export const sendOfficialReminderNotification = async (params: {
  tenantId: string;
  tenantName: string;
  event: OfficialReminderEvent;
  isTest?: boolean;
}): Promise<{ success: boolean; message: string }> => {
  const { tenantId, tenantName, event, isTest = false } = params;

  const settings = await getOfficialReminderSettings(tenantId);
  if (!settings.enabled && !isTest) {
    return { success: false, message: 'リマインダー通知が無効化されています。' };
  }

  const recipients = settings.recipient_emails.filter(e => e && e.includes('@'));
  if (recipients.length === 0) {
    return { success: false, message: '通知先メールアドレスが設定されていません。マスタ設定で登録してください。' };
  }

  // クールダウンチェック（テスト送信時はスキップ）
  if (!isTest && !checkCooldown(tenantId, event.id)) {
    return { success: false, message: '本日のリマインダー通知は既に送信済みです（二重送信防止ガード稼働中）。' };
  }

  const subject = `${isTest ? '【疎通テスト】' : '【重要・労務期限】'}${tenantName}様: ${event.title}のお知らせ`;

  // テキスト本文
  const textBody = 
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `【公的労務・法定期限リマインダー】${event.title}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${tenantName}\n` +
    `${settings.recipient_name} 様\n\n` +
    `いつも本システムをご利用いただき誠にありがとうございます。\n` +
    `社会保険料マスタの改定および公的帳票の提出時期が近づいてまいりましたのでご案内いたします。\n\n` +
    `■ 項目: ${event.title}\n` +
    `■ 区分: ${event.categoryLabel}\n` +
    `■ 法定期限: ${event.deadlineDescription}\n` +
    `■ 対象公的書類: ${event.targetDocumentName}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `【今月実施すべき実務アクション】\n` +
    event.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n') + `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `本システムの【🏢 労務・法定帳票発行センター】より、対象の公式公的帳票をワンクリックで自動作成・A4印刷いただけます。\n\n` +
    `※本メールは会社設定で登録された人事労務担当者様へ自動配信されています。\n` +
    `※通知先や時期の変更は【会社設定 ➔ 公的届出・社保改定通知マスタ】より設定いただけます。`;

  // HTMLメール本文
  const htmlBody = 
    `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">` +
    `  <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px;">` +
    `    <span style="font-size: 11px; font-weight: bold; background: rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">${event.categoryLabel}</span>` +
    `    <h2 style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.5px;">${event.title}</h2>` +
    `    <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.95;">公的届出・社会保険料改定 法定リマインダー通知</p>` +
    `  </div>` +
    `  <div style="font-size: 14px; margin-bottom: 20px;">` +
    `    <p style="margin: 0 0 6px;"><strong>${tenantName}</strong></p>` +
    `    <p style="margin: 0;"><strong>${settings.recipient_name} 様</strong></p>` +
    `  </div>` +
    `  <p style="font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 20px;">` +
    `    社会保険料マスタの改定および公的帳票の法定期限・提出時期が到来いたしました。法令に基づく適正な労務管理のため、下記の手続きをご確認ください。` +
    `  </p>` +
    `  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; background-color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">` +
    `    <tr><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 120px; font-weight: bold;">項目名</td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${event.title}</td></tr>` +
    `    <tr><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: bold;">法定期限・時期</td><td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #e11d48;">${event.deadlineDescription}</td></tr>` +
    `    <tr><td style="padding: 10px 14px; color: #64748b; font-weight: bold;">対象公的書類</td><td style="padding: 10px 14px; font-weight: bold; color: #0284c7;">${event.targetDocumentName}</td></tr>` +
    `  </table>` +
    `  <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">` +
    `    <div style="font-size: 13px; font-weight: 900; color: #1e3a8a; margin-bottom: 10px;">📋 今月実施すべき実務アクション</div>` +
    `    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #1e40af; line-height: 1.8;">` +
    event.actionItems.map(item => `<li>${item}</li>`).join('') +
    `    </ul>` +
    `  </div>` +
    `  <div style="text-align: center; margin: 28px 0 16px;">` +
    `    <a href="https://kintai.kap-cocotte.com" style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #4f46e5); color: white; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 12px rgba(14,165,233,0.3);">労務・法定帳票発行センターを開く</a>` +
    `  </div>` +
    `  <p style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; pt: 16px;">` +
    `    ※ 本メールはKAP勤怠システムよりマスタ設定されたご担当者様宛に自動送信されています。<br>` +
    `    ※ 通知先アドレスの追加・変更は【🏢 会社設定 ➔ 公的届出・社保改定通知マスタ】より随時設定いただけます。` +
    `  </p>` +
    `</div>`;

  // GAS Webhook URL (設定されている場合またはデフォルト)
  const targetWebhookUrl = settings.gas_webhook_url;

  try {
    const payload = {
      recipient_emails: recipients,
      subject: subject,
      body: textBody,
      html_body: htmlBody,
      tenant_name: tenantName,
      user_name: settings.recipient_name,
      event_id: event.id,
      event_title: event.title,
      is_test: isTest,
      created_at: new Date().toISOString()
    };

    if (targetWebhookUrl) {
      await fetch(targetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
    }

    if (!isTest) {
      recordCooldown(tenantId, event.id);
    }

    return {
      success: true,
      message: `${recipients.join(', ')} 宛にリマインダー通知（${event.title}）を送信いたしました。`
    };
  } catch (e: any) {
    console.error('Send reminder error:', e);
    return {
      success: false,
      message: `送信処理中にエラーが発生しました: ${e.message || '通信エラー'}`
    };
  }
};
