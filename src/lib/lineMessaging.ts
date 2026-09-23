/**
 * 📱 LINE Messaging 連携ユーティリティ (LINE Shift Notification Engine)
 * 
 * スタッフごとの確定シフトの抽出・LINE通知メッセージの生成・
 * 店舗別友だち追加QRコードの生成・送信ログ管理を司るSSOTエンジン。
 */

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
function getDayOfWeekJa(dateStr: string): string {
  const dowList = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : `(${dowList[d.getDay()]})`;
}

/**
 * スタッフ個別のLINE送信用メッセージ本文を生成
 */
export function formatStaffShiftLineMessage(
  userName: string,
  shifts: ShiftItemSimple[],
  periodLabel: string,
  storeName?: string
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
    text += `※ この期間の出勤予定はありません（公休期間）。\n`;
  } else {
    text += `📅 確定勤務予定（合計: ${shiftCount}日 / ${totalHours}時間）:\n`;
    text += shiftLines.join('\n');
    text += `\n\n`;
  }

  text += `体調管理に気をつけて、今月もよろしくお願いいたします！\n`;
  text += `※ 都合が悪くなった場合は、速やかに店長までご連絡ください。`;

  return {
    messageText: text,
    shiftCount,
    totalHours
  };
}

/**
 * 店舗用LINE友だち追加QRコード画像URL（無料即時生成）
 */
export function getStoreLineQrCodeUrl(tenantId: string, storeName: string): string {
  // 公式LINEアカウント友だち追加URL または招待リンク
  const addFriendUrl = `https://lin.ee/rakumaru_demo?tenant=${encodeURIComponent(tenantId)}&store=${encodeURIComponent(storeName)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(addFriendUrl)}`;
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
 * 確定シフト LINE一括送信実行（シミュレーション ＆ ログ記録）
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
  timestamp: string;
}> {
  // 送信シミュレーション（将来的にSupabase Edge Function または LINE Messaging API に直結）
  const timestamp = new Date().toISOString();
  
  // 送信履歴をLocalStorageに安全に蓄積
  try {
    const logKey = `line_shift_send_logs_${tenantId}`;
    const raw = localStorage.getItem(logKey);
    const logs = raw ? JSON.parse(raw) : [];
    const newLog = {
      id: `log_${Date.now()}`,
      period: targetPeriodLabel,
      sentAt: timestamp,
      sentCount: recipients.length,
      recipients: recipients.map(r => ({ userId: r.userId, userName: r.userName }))
    };
    logs.unshift(newLog);
    localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
  } catch (e) {
    console.warn('LINE send log error:', e);
  }

  // わずかな非同期ウェイト（リアルな送信体験演出）
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    success: true,
    sentCount: recipients.length,
    timestamp
  };
}
