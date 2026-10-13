import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAKUMARU_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") || "c1a3ff8ae39ff4951cd69eb3b1b96d81";
const RAKUMARU_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "2bzMLZ1Svthjn94ea3y4HHSeRjMw9SA1F9lgom1PkoUa2gUs3F8ovxG+ikJFVTwF5UM6tfmXrOF2C+ZplN6/JHdhOQur8Rt8eGchRIcILN1idPlIDv7OLvlva7Zfahj+ZAvjBfIwYSV+FZQ7sG97fwdB04t89/10/w1cDnyilFU=";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://phhrulzeaomqsvrregpc.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y";

const supabase = createClient(supabaseUrl, supabaseKey);

async function replyLineMessage(replyToken: string, text: string, accessToken: string) {
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }]
      })
    });
  } catch (e) {
    console.error("LINE Reply error:", e);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("LINE Webhook ready", { status: 200 });
  }

  try {
    const body = await req.json();
    const events = body?.events || [];

    for (const event of events) {
      const lineUserId = event.source?.userId;
      const replyToken = event.replyToken;

      if (event.type === "follow" && replyToken) {
        const welcome = 
`友だち追加ありがとうございます！🎉
【みんなのらくまる労務】公式通知アカウントです。

📱 社内システム（勤怠・給与・入社手続き）の画面に表示されている【4桁の連携コード】をこのトークに送信してください。`;
        await replyLineMessage(replyToken, welcome, RAKUMARU_CHANNEL_ACCESS_TOKEN);
        continue;
      }

      if (event.type === "message" && event.message?.type === "text") {
        const text = (event.message.text || "").trim();

        if (/^\d{4,6}$/.test(text)) {
          const { data: linkResult } = await supabase.rpc("link_user_by_line_pin", {
            p_pin: text,
            p_line_user_id: lineUserId
          });

          if (linkResult?.success && replyToken) {
            await replyLineMessage(
              replyToken,
              `🎉 【みんなのらくまる労務】\n${linkResult.user_name} 様、LINE連携が完了しました！\n今後、給与明細や確定シフトの通知がこのLINEに直接届きます。`,
              RAKUMARU_CHANNEL_ACCESS_TOKEN
            );
          } else if (replyToken) {
            await replyLineMessage(
              replyToken,
              `⚠️ 連携コードが見つからないか、有効期限が切れています。\n画面の最新コードをご確認の上、再度送信してください。`,
              RAKUMARU_CHANNEL_ACCESS_TOKEN
            );
          }
          continue;
        }

        if (replyToken) {
          await replyLineMessage(
            replyToken,
            `こちらは【みんなのらくまる労務】通知専用アカウントです。\n画面の【4桁の連携コード】を送信して連携を行ってください。`,
            RAKUMARU_CHANNEL_ACCESS_TOKEN
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
