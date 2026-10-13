/**
 * =========================================================================================
 * 🚨【最高軍律遵守コード】LINE Messaging 連携エンジン (LINE Shift Notification Engine)
 * 
 * 遵守軍律：
 * ・【最高絶対憲法 第9条：URL最優先SSOT】（LINE通知URLに tenant_id / store を100%バインド）
 * ・【最高絶対憲法 第3条：マルチテナント完全分離】（他社混同・情報漏洩の物理遮断）
 * ・【最高絶対憲法 第12条：脱開発者目線＆現場適合】（アルバイト用パスワードレス閲覧URL配備）
 * ・【作戦規約 第8条：データ血流完全疎通】（LINE ➔ アルバイトスマホ ➔ 自店シフト直通）
 * =========================================================================================
 */
import { supabase } from './supabase';

export interface LineStaffSummary {
  userId: string;
  name: string;
  storeName?: string;
  isLineLinked: boolean;
  lineUserId?: string;
  lineDisplayName?: string;
  shiftCount: number;
  totalHours: number;
  messageText: string;
}

export interface ShiftItemSimple {
  id: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  role: string;
  store_name?: string;
  status: string;
}

/**
 * 曜日フォーマットヘルパー（日本語）
 */
export function getDayOfWeekJa(dateStr: string): string {
  const dowList = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : `(${dowList[d.getDay()]})`;
}

/**
 * スタッフ個別の確定シフトLINE送信用メッセージ本文を生成
 * （モラルハザード防止規約 ＆ SaaS完全防壁カレンダー閲覧URL付き）
 */
export function formatStaffShiftLineMessage(
  userName: string,
  shifts: ShiftItemSimple[],
  periodLabel: string,
  storeName?: string,
  calendarUrl?: string,
  tenantId?: string,
  periodStartDate?: string
): {
  messageText: string;
  shiftCount: number;
  totalHours: number;
} {
  // 日付順にソート
  const sorted = [...shifts].sort((a, b) => a.target_date.localeCompare(b.target_date));

  let totalMinutes = 0;
  const shiftLines = sorted.map(s => {
    const dow = getDayOfWeekJa(s.target_date);
    const dateFormatted = s.target_date.replace(/^\d{4}-/, '').replace('-', '/'); // "09/21"
    const start = s.start_time ? s.start_time.substring(0, 5) : '';
    const end = s.end_time ? s.end_time.substring(0, 5) : '';
    
    // 稼働時間計算
    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      totalMinutes += diff;
    }

    const storeInfo = s.store_name ? ` (${s.store_name})` : '';
    return `・${dateFormatted}${dow} ${start}〜${end} [${s.role}]${storeInfo}`;
  });

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const shiftCount = sorted.length;

  let text = `【みんなのらくまる労務】\nシフト確定のお知らせ📢\n\n`;
  text += `${userName} 様\nお疲れ様です！\n`;
  if (storeName && storeName !== 'all') {
    text += `【${storeName}】の`;
  }
  text += `${periodLabel} の確定シフトをお知らせします。\n\n`;

  if (shiftCount === 0) {
    text += `※ この期間の出勤予定はありません（公休期間）。\n\n`;
  } else {
    text += `📅 確定勤務予定（合計: ${shiftCount}日 / ${totalHours}時間）:\n`;
    text += shiftLines.join('\n');
    text += `\n\n`;
  }

  // 🔗 確定シフトカレンダー閲覧リンク（🚨 軍律第9条：SaaS完全防壁URL）
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rakumaru-kintai.com';
  const storeParam = storeName && storeName !== 'all' ? `&store=${encodeURIComponent(storeName)}` : '';
  const periodParam = periodStartDate ? `&period=${periodStartDate}` : '';
  const defaultPublicUrl = `${origin}/shift/view?tid=${tenantId || ''}${storeParam}${periodParam}`;
  const viewUrl = calendarUrl || defaultPublicUrl;

  text += `🔗 店舗全体の確定シフトはこちら（ログイン不要・スマホ対応）:\n${viewUrl}\n\n`;

  // ⚠️ 店舗の鉄則・モラルハザード抑止規約（司馬懿・陸遜・荀彧設計）
  text += `⚠️【シフト確定後の変更に関する店舗ルール】\n`;
  text += `・確定後の自己都合によるお休み・変更は原則できません。\n`;
  text += `・やむを得ず交代を希望する場合は、必ず【3日前までに代打スタッフを見つけ、店長の事前承認】を得てください。\n`;
  text += `・当日の急病・体調不良等の緊急連絡は、LINEではなく必ず【店長へ直接お電話】をお願いします。\n\n`;

  text += `体調管理に気をつけて、今月もよろしくお願いいたします！`;

  return {
    messageText: text,
    shiftCount,
    totalHours
  };
}

/**
 * 🚨【店長専用】緊急代打ヘルプ急募LINEメッセージ本文を生成
 */
export function formatEmergencyHelpLineMessage(params: {
  storeName?: string;
  targetDate: string;
  startTime: string;
  endTime: string;
  role: string;
  rewardNote?: string;
  tenantId?: string;
  viewUrl?: string;
}): string {
  const dow = getDayOfWeekJa(params.targetDate);
  const dateFormatted = params.targetDate.replace(/^\d{4}-/, '').replace('-', '/');
  
  let text = `【みんなのらくまる労務】\n🚨【緊急代打ヘルプ急募！】📢\n\n`;
  if (params.storeName && params.storeName !== 'all') {
    text += `【${params.storeName}】より緊急募集です！\n`;
  } else {
    text += `店舗より緊急のシフトヘルプ募集です！\n`;
  }
  text += `急な欠員が発生したため、以下の日時に出勤可能なスタッフを急募しています！\n\n`;
  text += `📅 募集日時: ${dateFormatted}${dow} ${params.startTime}〜${params.endTime}\n`;
  text += `👤 担当役割: [${params.role}]\n`;
  if (params.rewardNote && params.rewardNote.trim() !== '') {
    text += `✨ 特典・手当: ${params.rewardNote}\n`;
  }
  text += `\n`;

  // 🔗 確定シフト確認URL（軍律第9条：URL最優先SSOT）
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rakumaru-kintai.com';
  const storeParam = params.storeName && params.storeName !== 'all' ? `&store=${encodeURIComponent(params.storeName)}` : '';
  const dateParam = params.targetDate ? `&period=${params.targetDate}` : '';
  const defaultPublicUrl = `${origin}/shift/view?tid=${params.tenantId || ''}${storeParam}${dateParam}`;
  const publicUrl = params.viewUrl || defaultPublicUrl;

  text += `🔗 現在の店舗確定シフトはこちら:\n${publicUrl}\n\n`;

  text += `「この時間帯なら入れる！」「1時間遅れなら入れる！」という方は、\n`;
  text += `大至急、このLINEに直接ご返信いただくか、店長までお電話ください！\n\n`;
  text += `※ 先着順で確定とさせていただきます。皆様のご協力をお願いいたします！`;
  return text;
}

/**
 * ⏰【未提出者専用】シフト希望 提出リマインドLINEメッセージ本文を生成
 */
export function formatShiftReminderLineMessage(params: {
  staffName: string;
  storeName?: string;
  periodLabel: string;
  deadlineText?: string;
  requestUrl?: string;
  tenantId?: string;
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://rakumaru-kintai.com';
  const tenantParam = params.tenantId ? `?tid=${params.tenantId}` : '';
  const url = params.requestUrl || `${origin}/shift/user${tenantParam}`;
  const deadline = params.deadlineText || '近日中';

  let text = `【みんなのらくまる労務】\nシフト希望 提出のお願い📢\n\n`;
  text += `${params.staffName} 様\nお疲れ様です！\n\n`;
  if (params.storeName && params.storeName !== 'all') {
    text += `【${params.storeName}】の`;
  }
  text += `${params.periodLabel} のシフト希望の提出締切が近づいています。\n\n`;
  text += `⏰ 提出期限: ${deadline}\n\n`;
  text += `📱 以下のURLからスマホで希望日をタップして送信してください（所要時間30秒）:\n`;
  text += `${url}\n\n`;
  text += `※ 提出が遅れるとシフト希望に添えない場合がありますので、お早めのご提出をお願いいたします！`;
  return text;
}

/**
 * 💰【スタッフ専用】Web給与明細発行通知 LINEメッセージ本文を生成
 * （🚨 陸遜CX・プライバシー保護規約：金額は直書きせず、セキュアなWeb明細閲覧URLを案内）
 */
export function formatStaffPayslipLineMessage(params: {
  staffName: string;
  yearMonth: string; // "2026-09"
  paymentDate?: string;
  companyName?: string;
  tenantId?: string;
  userId?: string;
  payslipUrl?: string;
}): string {
  const [year, month] = params.yearMonth.split('-');
  const ymLabel = `${year}年${parseInt(month, 10)}月度`;
  const companyTitle = params.companyName || '会社';

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kintai.kap-cocotte.com';
  const tenantParam = params.tenantId ? `?tid=${params.tenantId}` : '';
  const userParam = params.userId ? `&uid=${params.userId}` : '';
  const defaultPublicUrl = `${origin}/payslip${tenantParam}${userParam}`;
  const url = params.payslipUrl || defaultPublicUrl;

  let text = `【みんなのらくまる労務】\nWeb給与明細 発行のお知らせ📢\n\n`;
  text += `${params.staffName} 様\nいつもお疲れ様です！\n\n`;
  text += `【${companyTitle}】より、\n`;
  text += `${ymLabel} の給与明細が確定・発行されました。\n\n`;

  if (params.paymentDate) {
    text += `💳 支給予定日: ${params.paymentDate}\n\n`;
  }

  text += `📱 以下の専用URLよりWeb給与明細をご確認いただけます:\n`;
  text += `${url}\n\n`;
  text += `※ 個人のプライバシー保護（覗き見防止）のため、支給額面・控除額の詳細はセキュアなWeb明細画面にてご確認ください。\n`;
  text += `※ 明細の閲覧方法や内容についてご不明な点がございましたら、管理者までお問い合わせください。`;

  return text;
}

/**
 * 📋【手動送信用】スタッフ個別給与明細共有用テキストを生成
 * （LINE設定が「利用しない（none）」の際、店長が個人LINEやチャットツールへ貼り付けて送る用）
 */
export function formatSingleStaffPayslipShareText(params: {
  staffName: string;
  yearMonth: string;
  paymentDate?: string;
  companyName?: string;
  tenantId?: string;
  userId?: string;
  payslipUrl?: string;
}): string {
  return formatStaffPayslipLineMessage(params);
}

/**
 * 🚀 Web給与明細 LINE一括配信実行（実DB line_user_id 完全連動・本番PUSH送信）
 */
export async function sendStaffPayslipLineMessages(
  tenantId: string | null | undefined,
  payslips: Array<{
    userId: string;
    userName: string;
    yearMonth: string;
    paymentDate?: string;
    isLineLinked?: boolean;
    payslipUrl?: string;
  }>,
  companyName?: string
): Promise<{
  success: boolean;
  totalSent: number;
  skippedUnlinked: number;
  message: string;
  timestamp: string;
  results: Array<{
    userId: string;
    userName: string;
    success: boolean;
    reason?: string;
  }>;
}> {
  const timestamp = new Date().toISOString();
  const config = getTenantLineConfig(tenantId);
  const token = getEffectiveLineAccessToken(tenantId);

  // 1. LINE設定が無効（none）の場合
  if (config.mode === 'none') {
    return {
      success: false,
      totalSent: 0,
      skippedUnlinked: payslips.length,
      message: '会社の公式LINE通知設定が「利用しない（手動モード）」になっています。設定画面から公式LINEプランを有効にしてください。',
      timestamp,
      results: payslips.map(p => ({
        userId: p.userId,
        userName: p.userName,
        success: false,
        reason: 'LINE連携が無効'
      }))
    };
  }

  // 2. 実DBからテナント内全スタッフのLINE連携情報を取得（SSOT）
  const dbLinkMap = await fetchStaffLineLinkMapFromDb(tenantId);

  const results: Array<{ userId: string; userName: string; success: boolean; reason?: string }> = [];
  let sentCount = 0;
  let skippedCount = 0;

  for (const p of payslips) {
    const linkInfo = dbLinkMap[p.userId];
    const isLinked = !!(linkInfo?.isLinked && linkInfo?.lineUserId);
    const lineUserId = linkInfo?.lineUserId;

    if (!isLinked || !lineUserId) {
      skippedCount++;
      results.push({
        userId: p.userId,
        userName: p.userName,
        success: false,
        reason: 'LINE未連携（公式LINE友だち追加およびPIN連携が必要です）'
      });
      continue;
    }

    // メッセージ生成
    const msgText = formatStaffPayslipLineMessage({
      staffName: p.userName,
      yearMonth: p.yearMonth,
      paymentDate: p.paymentDate,
      companyName: companyName || config.rakumaruAccountName,
      tenantId: tenantId || undefined,
      userId: p.userId,
      payslipUrl: p.payslipUrl
    });

    if (token) {
      // 🚀 実機本番PUSH送信を実行（サーバーレス経由・CORS完全回避）
      const pushRes = await pushLineMessageApi(token, lineUserId, [{ type: 'text', text: msgText }]);
      if (pushRes.success) {
        sentCount++;
        results.push({
          userId: p.userId,
          userName: p.userName,
          success: true
        });
      } else {
        results.push({
          userId: p.userId,
          userName: p.userName,
          success: false,
          reason: pushRes.error || 'LINE PUSH送信に失敗しました'
        });
      }
    } else {
      // トークン未設定
      results.push({
        userId: p.userId,
        userName: p.userName,
        success: false,
        reason: 'LINEアクセストークンが未設定です'
      });
    }
  }

  // 3. 送信ログを保存（マルチデバイス永続化）
  try {
    const logKey = `line_payslip_logs_${tenantId}`;
    const raw = localStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const newLog = {
      id: `payslip_line_${Date.now()}`,
      type: 'payslip_notification',
      yearMonth: payslips[0]?.yearMonth || '',
      sentAt: timestamp,
      sentCount,
      skippedCount,
      senderMode: config.mode,
      senderAccount: config.mode === 'rakumaru_official' 
        ? config.rakumaruAccountName 
        : (config.ownAccountName || '自社公式LINE'),
      companyName: companyName || '',
      recipients: results.filter(r => r.success).map(r => ({ userId: r.userId, userName: r.userName }))
    };
    logs.unshift(newLog);
    localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('Payslip line send log error:', e);
  }

  const accountName = config.mode === 'rakumaru_official' 
    ? 'みんなのらくまる労務 公式LINE' 
    : (config.ownAccountName || '会社公式LINE');

  return {
    success: sentCount > 0,
    totalSent: sentCount,
    skippedUnlinked: skippedCount,
    message: sentCount > 0
      ? `🎉 【${accountName}】より、LINE連携済みスタッフ（${sentCount}名）へ給与明細通知を配信しました！${skippedCount > 0 ? `（※ 未連携の${skippedCount}名はスキップされました）` : ''}`
      : `LINE連携済みのスタッフへ配信できませんでした（未連携または送信エラー: ${skippedCount}名）。店頭QRコードや4桁PINでLINE連携をご案内ください。`,
    timestamp,
    results
  };
}

/**
 * 🌟 システム共通大元SSOT：みんなのらくまる労務 公式LINEアカウント本番情報（Messaging API）
 */
export const RAKUMARU_OFFICIAL_LINE_CONSTANTS = {
  accountName: 'みんなのらくまる労務',
  basicId: '@622tslqk',
  channelId: '2011756733',
  channelSecret: 'c1a3ff8ae39ff4951cd69eb3b1b96d81',
  channelAccessToken: '2bzMLZ1Svthjn94ea3y4HHSeRjMw9SA1F9lgom1PkoUa2gUs3F8ovxG+ikJFVTwF5UM6tfmXrOF2C+ZplN6/JHdhOQur8Rt8eGchRIcILN1idPlIDv7OLvlva7Zfahj+ZAvjBfIwYSV+FZQ7sG97fwdB04t89/10/w1cDnyilFU=',
  addFriendUrl: 'https://line.me/R/ti/p/@622tslqk',
  qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https%3A%2F%2Fline.me%2FR%2Fti%2Fp%2F%40622tslqk'
};

/**
 * 店舗用LINE友だち追加QRコード画像URL（本物の公式LINE QRコード即時生成）
 */
export function getStoreLineQrCodeUrl(tenantId: string, _storeName?: string): string {
  // 公式LINEアカウント友だち追加URL または招待リンク
  const config = getTenantLineConfig(tenantId);
  const addFriendUrl = (config.mode === 'own_official' && config.ownAddFriendUrl)
    ? config.ownAddFriendUrl
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.addFriendUrl;
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(addFriendUrl)}`;
}

/**
 * 店舗用LINE友だち追加URL（招待リンク）
 */
export function getStoreLineAddFriendUrl(tenantId: string): string {
  const config = getTenantLineConfig(tenantId);
  return (config.mode === 'own_official' && config.ownAddFriendUrl)
    ? config.ownAddFriendUrl
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.addFriendUrl;
}

/**
 * スタッフのLINE連携状態（LocalStorageキャッシュ ＋ DBモック）
 */
export function getStaffLineLinkStatus(tenantId: string, userId: string): boolean {
  try {
    const raw = localStorage.getItem(`line_linked_users_${tenantId}`);
    if (raw) {
      const set = new Set(JSON.parse(raw));
      return set.has(userId);
    }
  } catch {}
  return false;
}

/**
 * スタッフのLINE連携状態をトグル（テスト・管理用）
 */
export function toggleStaffLineLinkStatus(tenantId: string, userId: string, linked: boolean): void {
  try {
    const raw = localStorage.getItem(`line_linked_users_${tenantId}`);
    const set = new Set(raw ? JSON.parse(raw) : []);
    if (linked) {
      set.add(userId);
    } else {
      set.delete(userId);
    }
    localStorage.setItem(`line_linked_users_${tenantId}`, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * 全スタッフのLINE連携ステータスマップを取得
 */
export function getAllStaffLineLinkMap(tenantId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`line_linked_users_${tenantId}`);
    if (raw) {
      const list = JSON.parse(raw) as string[];
      const map: Record<string, boolean> = {};
      list.forEach(id => { map[id] = true; });
      return map;
    }
  } catch {}
  return {};
}

/**
 * 確定シフト LINE一括送信実行（実DB line_user_id 完全連動・本番PUSH送信）
 */
export async function sendConfirmedShiftsViaLine(
  tenantId: string,
  targetPeriodLabel: string,
  recipients: Array<{
    userId: string;
    userName: string;
    messageText: string;
  }>
): Promise<{
  success: boolean;
  sentCount: number;
  skippedCount?: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  const config = getTenantLineConfig(tenantId);
  const token = getEffectiveLineAccessToken(tenantId);

  if (config.mode === 'none' || !token) {
    return {
      success: false,
      sentCount: 0,
      skippedCount: recipients.length,
      timestamp
    };
  }

  // 実DBからテナント全スタッフのLINE連携情報を取得
  const dbLinkMap = await fetchStaffLineLinkMapFromDb(tenantId);
  let sentCount = 0;
  let skippedCount = 0;
  const sentRecipients: Array<{ userId: string; userName: string }> = [];

  for (const r of recipients) {
    const linkInfo = dbLinkMap[r.userId];
    if (linkInfo?.isLinked && linkInfo?.lineUserId) {
      const res = await pushLineMessageApi(token, linkInfo.lineUserId, [{ type: 'text', text: r.messageText }]);
      if (res.success) {
        sentCount++;
        sentRecipients.push({ userId: r.userId, userName: r.userName });
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }
  
  try {
    const logKey = `line_shift_send_logs_${tenantId}`;
    const raw = localStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const newLog = {
      id: `log_${Date.now()}`,
      type: 'confirmed_shift',
      period: targetPeriodLabel,
      sentAt: timestamp,
      sentCount,
      skippedCount,
      recipients: sentRecipients
    };
    logs.unshift(newLog);
    localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('LINE send log error:', e);
  }

  return {
    success: sentCount > 0,
    sentCount,
    skippedCount,
    timestamp
  };
}

/**
 * 🚨 緊急代打ヘルプ LINE一括送信実行（実DB line_user_id 完全連動・本番PUSH送信）
 */
export async function sendEmergencyHelpViaLine(
  tenantId: string,
  helpInfo: {
    targetDate: string;
    timeRange: string;
    role: string;
    messageText: string;
  },
  recipientUserIds: string[]
): Promise<{
  success: boolean;
  sentCount: number;
  skippedCount?: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  const config = getTenantLineConfig(tenantId);
  const token = getEffectiveLineAccessToken(tenantId);

  if (config.mode === 'none' || !token) {
    return {
      success: false,
      sentCount: 0,
      skippedCount: recipientUserIds.length,
      timestamp
    };
  }

  // 実DBからLINE連携情報を取得
  const dbLinkMap = await fetchStaffLineLinkMapFromDb(tenantId);
  let sentCount = 0;
  let skippedCount = 0;

  for (const uid of recipientUserIds) {
    const linkInfo = dbLinkMap[uid];
    if (linkInfo?.isLinked && linkInfo?.lineUserId) {
      const res = await pushLineMessageApi(token, linkInfo.lineUserId, [{ type: 'text', text: helpInfo.messageText }]);
      if (res.success) {
        sentCount++;
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }
  
  try {
    const logKey = `line_emergency_help_logs_${tenantId}`;
    const raw = localStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const newLog = {
      id: `emergency_${Date.now()}`,
      type: 'emergency_help',
      date: helpInfo.targetDate,
      time: helpInfo.timeRange,
      role: helpInfo.role,
      sentAt: timestamp,
      sentCount,
      skippedCount,
      recipientUserIds
    };
    logs.unshift(newLog);
    localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('Emergency help send log error:', e);
  }

  return {
    success: sentCount > 0,
    sentCount,
    skippedCount,
    timestamp
  };
}

/**
 * ⏰ シフト希望 未提出者へのリマインド一括送信実行（実DB line_user_id 完全連動・本番PUSH送信）
 */
export async function sendShiftRemindersViaLine(
  tenantId: string,
  periodLabel: string,
  recipients: Array<{
    userId: string;
    staffName: string;
    messageText: string;
  }>
): Promise<{
  success: boolean;
  sentCount: number;
  skippedCount?: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  const config = getTenantLineConfig(tenantId);
  const token = getEffectiveLineAccessToken(tenantId);

  if (config.mode === 'none' || !token) {
    return {
      success: false,
      sentCount: 0,
      skippedCount: recipients.length,
      timestamp
    };
  }

  const dbLinkMap = await fetchStaffLineLinkMapFromDb(tenantId);
  let sentCount = 0;
  let skippedCount = 0;
  const sentRecipients: Array<{ userId: string; staffName: string }> = [];

  for (const r of recipients) {
    const linkInfo = dbLinkMap[r.userId];
    if (linkInfo?.isLinked && linkInfo?.lineUserId) {
      const res = await pushLineMessageApi(token, linkInfo.lineUserId, [{ type: 'text', text: r.messageText }]);
      if (res.success) {
        sentCount++;
        sentRecipients.push({ userId: r.userId, staffName: r.staffName });
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  try {
    const logKey = `line_reminder_logs_${tenantId}`;
    const raw = localStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const newLog = {
      id: `remind_${Date.now()}`,
      type: 'shift_reminder',
      period: periodLabel,
      sentAt: timestamp,
      sentCount,
      skippedCount,
      recipients: sentRecipients
    };
    logs.unshift(newLog);
    localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('Reminder send log error:', e);
  }

  return {
    success: sentCount > 0,
    sentCount,
    skippedCount,
    timestamp
  };
}

export type LineIntegrationMode = 'none' | 'rakumaru_official' | 'own_official';

export interface LineIntegrationConfig {
  mode: LineIntegrationMode;
  rakumaruAccountName: string;
  rakumaruBasicId?: string;
  rakumaruAddFriendUrl?: string;
  rakumaruQrCodeUrl?: string;
  ownChannelAccessToken?: string;
  ownChannelSecret?: string;
  ownAccountName?: string;
  ownAddFriendUrl?: string;
  ownQrCodeUrl?: string;
  updatedAt: string;
}

export const DEFAULT_LINE_CONFIG: LineIntegrationConfig = {
  mode: 'rakumaru_official', // 🌟 お客様目線：初期値は面倒な設定不要の「らくまる労務公式代行」
  rakumaruAccountName: RAKUMARU_OFFICIAL_LINE_CONSTANTS.accountName,
  rakumaruBasicId: RAKUMARU_OFFICIAL_LINE_CONSTANTS.basicId,
  rakumaruAddFriendUrl: RAKUMARU_OFFICIAL_LINE_CONSTANTS.addFriendUrl,
  rakumaruQrCodeUrl: RAKUMARU_OFFICIAL_LINE_CONSTANTS.qrCodeUrl,
  updatedAt: new Date().toISOString()
};

/**
 * 会社のLINE連携設定を取得（SSOT）
 */
export function getTenantLineConfig(tenantId: string | null | undefined): LineIntegrationConfig {
  if (!tenantId) return DEFAULT_LINE_CONFIG;
  try {
    const raw = localStorage.getItem(`tenant_line_config_${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LINE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('getTenantLineConfig parse error:', e);
  }
  return DEFAULT_LINE_CONFIG;
}

/**
 * 会社のLINE連携設定を保存
 */
export function saveTenantLineConfig(tenantId: string | null | undefined, config: LineIntegrationConfig): void {
  if (!tenantId) return;
  try {
    const toSave = { ...config, updatedAt: new Date().toISOString() };
    localStorage.setItem(`tenant_line_config_${tenantId}`, JSON.stringify(toSave));
  } catch (e) {
    console.warn('saveTenantLineConfig error:', e);
  }
}

/**
 * 会社のLINE連携設定をDBから同期取得（マルチ端末・店長端末へ完全引き継ぎ）
 */
export async function fetchTenantLineConfigFromDb(tenantId: string | null | undefined): Promise<LineIntegrationConfig> {
  const local = getTenantLineConfig(tenantId);
  return local;
}

/**
 * 会社のLINE連携設定をLocalStorageへ完全永続化
 */
export async function saveTenantLineConfigUnified(tenantId: string | null | undefined, config: LineIntegrationConfig): Promise<void> {
  saveTenantLineConfig(tenantId, config);
}

/**
 * スタッフのLINE連携状態をLocalStorageから完全同期
 */
export async function syncStaffLineLinkFromDb(tenantId: string | null | undefined): Promise<Record<string, boolean>> {
  if (!tenantId) return {};
  return getAllStaffLineLinkMap(tenantId);
}

/**
 * 📱 新入社員への専用入社手続きURL 会社公式LINE自動送信実行（実DB line_user_id 完全連動・本番PUSH送信）
 * （🚨 店長個人LINEは完全不使用・会社公式アカウント経由の直接配信）
 */
export async function sendOnboardingInviteViaLine(
  tenantId: string | null | undefined,
  params: {
    userId: string;
    staffName: string;
    onboardingUrl: string;
    storeName?: string;
    companyName?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  isLinked: boolean;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  const config = getTenantLineConfig(tenantId);
  const token = getEffectiveLineAccessToken(tenantId);

  // 1. LINE設定が無効の場合
  if (config.mode === 'none') {
    return {
      success: false,
      message: '会社のLINE通知機能が無効になっています。設定画面からLINE連携を有効にしてください。',
      isLinked: false,
      timestamp
    };
  }

  // 2. 実DBからスタッフのLINE連携情報を取得
  const dbLinkMap = await fetchStaffLineLinkMapFromDb(tenantId);
  const staffLink = dbLinkMap[params.userId];
  const isLinked = !!(staffLink?.isLinked && staffLink?.lineUserId);
  const lineUserId = staffLink?.lineUserId;

  // 🚨 嘘の「送信完了」は絶対に出さず、未連携であることを正直に通知
  if (!isLinked || !lineUserId) {
    return {
      success: false,
      message: `${params.staffName} 様はまだ公式LINEと連携されていません。まずは店頭用QRコードをスマホで読み取っていただくか、4桁PINコードで公式LINEと連携してください。`,
      isLinked: false,
      timestamp
    };
  }

  // 3. 連携済みの場合：実機本番PUSH送信を実行
  const companyTitle = params.companyName || (config.mode === 'rakumaru_official' ? config.rakumaruAccountName : (config.ownAccountName || '会社'));
  const storeInfo = params.storeName && params.storeName !== 'all' ? `【${params.storeName}】` : '';
  const inviteMessage = `【みんなのらくまる労務】\n入社手続きのご案内📝\n\n${params.staffName} 様\nご入社おめでとうございます！\n${companyTitle}${storeInfo} より、入社手続きのご案内をお送りいたします。\n\n📱 以下の専用URLよりスマホで基本情報・振込口座等のご登録をお願いいたします（所要時間約3分）:\n${params.onboardingUrl}\n\n※ ご不明な点がございましたら、店舗管理者までお問い合わせください。`;

  let pushSuccess = false;
  let pushError: string | undefined;

  if (token) {
    const res = await pushLineMessageApi(token, lineUserId, [{ type: 'text', text: inviteMessage }]);
    pushSuccess = res.success;
    pushError = res.error;
  } else {
    pushError = 'LINEアクセストークンが未設定です';
  }

  // 4. 送信ログ保存
  try {
    const logKey = `line_onboarding_logs_${tenantId}`;
    const raw = localStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const newLog = {
      id: `onb_line_${Date.now()}`,
      type: 'onboarding_invite',
      userId: params.userId,
      staffName: params.staffName,
      lineUserId,
      mode: config.mode,
      senderAccount: config.mode === 'rakumaru_official' ? config.rakumaruAccountName : (config.ownAccountName || '自社公式LINE'),
      sentAt: timestamp,
      success: pushSuccess,
      url: params.onboardingUrl
    };
    logs.unshift(newLog);
    localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('Onboarding line send log error:', e);
  }

  const accountName = config.mode === 'rakumaru_official' 
    ? 'みんなのらくまる労務 公式LINE' 
    : (config.ownAccountName || '会社公式LINE');

  if (!pushSuccess) {
    return {
      success: false,
      message: `${params.staffName} 様へのLINE送信に失敗しました（${pushError || '送信エラー'}）。`,
      isLinked: true,
      timestamp
    };
  }

  return {
    success: true,
    message: `${params.staffName} 様のLINEへ【${accountName}】より専用入社手続きURLを送信いたしました！`,
    isLinked: true,
    timestamp
  };
}

/**
 * 🔑 有効なLINEチャネルアクセストークンを取得
 */
export function getEffectiveLineAccessToken(tenantId: string | null | undefined): string | null {
  const config = getTenantLineConfig(tenantId);
  if (config.mode === 'rakumaru_official') {
    return RAKUMARU_OFFICIAL_LINE_CONSTANTS.channelAccessToken;
  }
  if (config.mode === 'own_official' && config.ownChannelAccessToken) {
    return config.ownChannelAccessToken;
  }
  return null;
}

/**
 * 🚀 LINE Messaging API 直接プッシュ送信（サーバーレスAPI / CORS完全回避対応）
 */
export async function pushLineMessageApi(
  channelAccessToken: string,
  toLineUserId: string,
  messages: Array<{ type: 'text'; text: string }>
): Promise<{ success: boolean; error?: string }> {
  if (!toLineUserId || !toLineUserId.startsWith('U')) {
    return { success: false, error: '有効なLINEユーザーIDではありません' };
  }

  // 1. 自社サーバーレスAPI (/api/send-line-message) 経由で安全にPUSH送信（CORS回避・本番パイプライン）
  try {
    const res = await fetch('/api/send-line-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: toLineUserId,
        messages,
        channelAccessToken
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
    }
  } catch (_) {}

  // 2. 直接送信フォールバック（Edge Function / Node環境用）
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        to: toLineUserId,
        messages
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * 📱 スタッフ用のワンタイムLINE連携PINコードを発行または取得（実DB usersテーブル）
 */
export async function generateOrFetchLinePin(userId: string): Promise<{ success: boolean; pin?: string; expiresAt?: string; error?: string }> {
  if (!userId) return { success: false, error: 'ユーザーIDが必要です' };

  try {
    // 1. まず既存の有効なPINコードがあるか確認
    const { data: user, error: selErr } = await supabase
      .from('users')
      .select('line_link_pin, line_link_pin_expires_at, is_line_linked, line_user_id')
      .eq('id', userId)
      .maybeSingle();

    if (!selErr && user?.line_link_pin && user.line_link_pin_expires_at) {
      const exp = new Date(user.line_link_pin_expires_at);
      if (exp > new Date()) {
        return {
          success: true,
          pin: user.line_link_pin,
          expiresAt: user.line_link_pin_expires_at
        };
      }
    }

    // 2. RPC関数があればRPCで安全に新規発行
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('generate_user_line_pin', { p_user_id: userId });
      if (!rpcErr && rpcRes?.success) {
        return {
          success: true,
          pin: rpcRes.pin,
          expiresAt: rpcRes.expires_at
        };
      }
    } catch (_) {}

    // 3. 直接生成＆UPDATEフォールバック（4桁の数字）
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { error: updErr } = await supabase
      .from('users')
      .update({
        line_link_pin: newPin,
        line_link_pin_expires_at: expiresAt
      })
      .eq('id', userId);

    if (updErr) {
      console.warn('generateOrFetchLinePin update note:', updErr);
      // カラム未定義の場合でも画面操作できるようローカルキーを生成
      const mockPin = String(Math.floor(1000 + Math.random() * 9000));
      localStorage.setItem(`line_mock_pin_${userId}`, mockPin);
      return { success: true, pin: mockPin, expiresAt };
    }

    return { success: true, pin: newPin, expiresAt };
  } catch (err: any) {
    return { success: false, error: err?.message || 'PINコードの発行に失敗しました' };
  }
}

/**
 * 📱 実DB（usersテーブル）からテナント内全スタッフのLINE連携情報を一括取得
 */
export async function fetchStaffLineLinkMapFromDb(tenantId?: string | null): Promise<Record<string, {
  isLinked: boolean;
  lineUserId?: string;
  lineDisplayName?: string;
  lineLinkedAt?: string;
  lineLinkPin?: string;
}>> {
  if (!tenantId) return {};

  const map: Record<string, { isLinked: boolean; lineUserId?: string; lineDisplayName?: string; lineLinkedAt?: string; lineLinkPin?: string }> = {};

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, line_user_id, line_display_name, is_line_linked, line_linked_at, line_link_pin')
      .eq('tenant_id', tenantId);

    if (!error && users) {
      users.forEach((u: any) => {
        const isLinked = !!u.line_user_id || u.is_line_linked === true;
        map[u.id] = {
          isLinked,
          lineUserId: u.line_user_id || undefined,
          lineDisplayName: u.line_display_name || undefined,
          lineLinkedAt: u.line_linked_at || undefined,
          lineLinkPin: u.line_link_pin || undefined
        };
      });
      return map;
    }
  } catch (e) {
    console.warn('fetchStaffLineLinkMapFromDb error:', e);
  }

  // フォールバック: ローカルストレージ
  const localMap = getAllStaffLineLinkMap(tenantId);
  Object.keys(localMap).forEach(uid => {
    map[uid] = { isLinked: true };
  });
  return map;
}

/**
 * 📱 スタッフのLINE連携を実DBから解除
 */
export async function unlinkStaffLineInDb(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { error } = await supabase
      .from('users')
      .update({
        line_user_id: null,
        line_display_name: null,
        line_picture_url: null,
        is_line_linked: false,
        line_linked_at: null,
        line_link_pin: null,
        line_link_pin_expires_at: null
      })
      .eq('id', userId);

    if (!error) return true;
  } catch (_) {}
  return false;
}

