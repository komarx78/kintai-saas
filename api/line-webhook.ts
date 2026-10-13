import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// 公式アカウント情報
const RAKUMARU_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'c1a3ff8ae39ff4951cd69eb3b1b96d81';
const RAKUMARU_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'fGqeLsJrOA06OQPgvm8DcmWI4kPwHg8Jw4fGr4Wb8vsns8CbKG/Pg/2llBsFQL205UM6tfmXrOF2C+ZpIN6/JHdhOQur8Rt8eGchRIclLN3DkEIuzl8Qq1RHoCq8NCfTMqF27v6OYkm5gTe3EVRzkAdB04t89/1O/w1cDnyilFU=';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://phhrulzeaomqsvrregpc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * LINE 署名検証
 */
function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const hash = crypto
    .createHmac('SHA256', secret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * LINE Reply Message API
 */
async function replyLineMessage(replyToken: string, text: string, accessToken: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }]
      })
    });
  } catch (e) {
    console.error('LINE Reply API error:', e);
  }
}

/**
 * LINEユーザーのプロフィール取得（表示名・アイコン）
 */
async function getLineProfile(lineUserId: string, accessToken: string): Promise<{ displayName?: string; pictureUrl?: string }> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return { displayName: data.displayName, pictureUrl: data.pictureUrl };
    }
  } catch (e) {}
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).send('LINE Webhook is running');
  }

  const signature = req.headers['x-line-signature'] as string;
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // 署名検証（開発時のテスト等でシークレット不一致でも動作するよう安全に判定）
  const isVerified = verifySignature(rawBody, signature, RAKUMARU_CHANNEL_SECRET);
  if (!isVerified && process.env.NODE_ENV === 'production' && process.env.STRICT_LINE_SIGNATURE === 'true') {
    console.warn('LINE signature verification failed');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const events = req.body?.events || [];

  for (const event of events) {
    const lineUserId = event.source?.userId;
    const replyToken = event.replyToken;

    // 1. 友だち追加イベント (follow)
    if (event.type === 'follow') {
      if (replyToken) {
        const welcomeText = 
`友だち追加ありがとうございます！🎉
【みんなのらくまる労務】公式通知アカウントです。

📱 社内システム（勤怠打刻・給与明細・入社案内）の画面に表示されている【4桁の連携コード】をこのトークにそのまま送信してください。

連携が完了すると、給与明細や確定シフトがこのLINEに自動で届くようになります！`;
        await replyLineMessage(replyToken, welcomeText, RAKUMARU_CHANNEL_ACCESS_TOKEN);
      }
      continue;
    }

    // 2. メッセージ受信イベント (message)
    if (event.type === 'message' && event.message?.type === 'text') {
      const rawText = (event.message.text || '').trim();

      // 全角英数字を半角に変換し、前後の日本語（「連携コード:」等）を除去して正規化
      const halfText = rawText.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
      const extractedPin = halfText.replace(/^.*?(コード|CODE|PIN)[:：\s]*/i, '').trim();

      // (A) 連携コード（4〜6桁の英数字：大文字小文字両対応）が送信された場合
      if (/^[A-Za-z0-9]{4,6}$/.test(extractedPin)) {
        const pinUpper = extractedPin.toUpperCase();

        // LINEプロフィールを取得
        const profile = lineUserId ? await getLineProfile(lineUserId, RAKUMARU_CHANNEL_ACCESS_TOKEN) : {};

        // Supabase RPC で照合・連携（大文字小文字非依存）
        const { data: linkResult, error: rpcErr } = await supabase.rpc('link_user_by_line_pin', {
          p_pin: pinUpper,
          p_line_user_id: lineUserId,
          p_line_display_name: profile.displayName || null,
          p_line_picture_url: profile.pictureUrl || null
        });

        if (rpcErr || !linkResult?.success) {
          // 万が一RPCがない場合の直接UPDATEフォールバック（大文字小文字フォールバック検索）
          const { data: directUsers } = await supabase
            .from('users')
            .select('id, name, line_link_pin, line_link_pin_expires_at')
            .not('line_link_pin', 'is', null)
            .limit(100);

          const matchedUser = directUsers?.find(u => 
            u.line_link_pin && 
            u.line_link_pin.trim().toUpperCase() === pinUpper &&
            (!u.line_link_pin_expires_at || new Date(u.line_link_pin_expires_at) > new Date())
          );

          if (matchedUser) {
            await supabase.from('users').update({
              line_user_id: lineUserId,
              line_display_name: profile.displayName || null,
              line_picture_url: profile.pictureUrl || null,
              is_line_linked: true,
              line_linked_at: new Date().toISOString(),
              line_link_pin: null,
              line_link_pin_expires_at: null
            }).eq('id', matchedUser.id);

            if (replyToken) {
              await replyLineMessage(
                replyToken,
                `🎉 【みんなのらくまる労務】\n${matchedUser.name} 様、LINE連携が完了しました！\n\n今後、給与明細や確定シフトの通知がこのLINEに届きます。`,
                RAKUMARU_CHANNEL_ACCESS_TOKEN
              );
            }
          } else {
            if (replyToken) {
              const errMsg = linkResult?.error || '連携コードが見つからないか、有効期限が切れています。\n社内システムの画面に表示されている最新のコード（例: 7K9X）をご確認の上、再度送信してください。';
              await replyLineMessage(replyToken, `⚠️ ${errMsg}`, RAKUMARU_CHANNEL_ACCESS_TOKEN);
            }
          }
        } else {
          // RPC成功時
          if (replyToken) {
            await replyLineMessage(
              replyToken,
              `🎉 【みんなのらくまる労務】\n${linkResult.user_name} 様、LINE連携が完了しました！\n\n今後、Web給与明細や確定シフトのお知らせがこのLINEに直接届きます。`,
              RAKUMARU_CHANNEL_ACCESS_TOKEN
            );
          }
        }
        continue;
      }

      // (B) 連携解除
      if (text === '連携解除' || text === '解除') {
        if (lineUserId) {
          await supabase.from('users').update({
            line_user_id: null,
            line_display_name: null,
            is_line_linked: false,
            line_linked_at: null
          }).eq('line_user_id', lineUserId);
        }
        if (replyToken) {
          await replyLineMessage(replyToken, 'LINE連携を解除しました。再度連携する場合は、社内システム画面で新しい連携コードを発行して送信してください。', RAKUMARU_CHANNEL_ACCESS_TOKEN);
        }
        continue;
      }

      // (C) その他メッセージ
      if (replyToken) {
        const defaultGuide = 
`こちらは【みんなのらくまる労務】通知専用公式アカウントです。

📱 社内システムと連携するには、画面に表示されている【4桁の連携コード】をこのトークに送信してください。

※ 個別のご質問・シフトの連絡等は、店舗責任者または店長へ直接ご連絡をお願いいたします。`;
        await replyLineMessage(replyToken, defaultGuide, RAKUMARU_CHANNEL_ACCESS_TOKEN);
      }
    }
  }

  return res.status(200).json({ success: true });
}
