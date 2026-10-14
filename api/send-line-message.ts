import type { VercelRequest, VercelResponse } from '@vercel/node';

const RAKUMARU_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || 'fGqeLsJrOA06OQPgvm8DcmWI4kPwHg8Jw4fGr4Wb8vsns8CbKG/Pg/2llBsFQL205UM6tfmXrOF2C+ZpIN6/JHdhOQur8Rt8eGchRIclLN3DkEIuzl8Qq1RHoCq8NCfTMqF27v6OYkm5gTe3EVRzkAdB04t89/1O/w1cDnyilFU=';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS ヘッダー
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { to, messages, channelAccessToken } = req.body || {};

    if (!to || !messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'to (lineUserId) and messages are required' });
    }

    const token = channelAccessToken || RAKUMARU_CHANNEL_ACCESS_TOKEN;

    // 単一送信 (push) または複数送信 (multicast)
    const isMulticast = Array.isArray(to);
    const endpoint = isMulticast
      ? 'https://api.line.me/v2/bot/message/multicast'
      : 'https://api.line.me/v2/bot/message/push';

    const payload = isMulticast
      ? { to, messages }
      : { to, messages };

    const lineRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      console.error('LINE Messaging API push error:', lineRes.status, errText);
      return res.status(lineRes.status).json({
        success: false,
        error: `LINE API Error (${lineRes.status}): ${errText}`
      });
    }

    return res.status(200).json({
      success: true,
      sentTo: to,
      messageCount: messages.length,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Send LINE message server error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error'
    });
  }
}
