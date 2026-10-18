import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_SQUARE_ACCESS_TOKEN =
  process.env.SQUARE_ACCESS_TOKEN ||
  'EAAAlxiU1IySQqbuT4_PmG4NKfiZiNFwshTTwBVmoKzgO9RIvy4dizktQoKakEAX';
const DEFAULT_SQUARE_LOCATION_ID =
  process.env.VITE_SQUARE_LOCATION_ID ||
  process.env.SQUARE_LOCATION_ID ||
  'LV2RHGP5T5613';

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
    const {
      tenantId,
      tenantName,
      planName,
      unitPrice,
      userCount,
      lineOptionFee,
      lineOptionName,
      redirectUrl,
      accessToken,
      locationId
    } = req.body || {};

    const token = accessToken || DEFAULT_SQUARE_ACCESS_TOKEN;
    const locId = locationId || DEFAULT_SQUARE_LOCATION_ID;

    const safeUserCount = Math.max(1, Number(userCount) || 1);
    const safeUnitPrice = Math.max(0, Number(unitPrice) || 500);
    const safeLineFee = Math.max(0, Number(lineOptionFee) || 0);

    const lineItems: any[] = [
      {
        name: `みんなのらくまる労務（${planName || 'フルセットプラン'}）`,
        quantity: String(safeUserCount),
        note: `${tenantName || 'ご契約企業'}様 在籍${safeUserCount}名分 月額利用料`,
        base_price_money: {
          amount: safeUnitPrice,
          currency: 'JPY'
        }
      }
    ];

    if (safeLineFee > 0) {
      lineItems.push({
        name: lineOptionName || '公式LINE代行配信オプション（月額）',
        quantity: '1',
        note: '全店舗共通・公式LINE通知代行',
        base_price_money: {
          amount: safeLineFee,
          currency: 'JPY'
        }
      });
    }

    const idempotencyKey = `rakumaru_${tenantId || 'tenant'}_${Date.now()}`;

    const payload: any = {
      idempotency_key: idempotencyKey,
      order: {
        location_id: locId,
        line_items: lineItems
      },
      checkout_options: {
        ask_for_shipping_address: false,
        merchant_support_email: 'info@kap-cocotte.com'
      }
    };

    if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.startsWith('http')) {
      payload.checkout_options.redirect_url = redirectUrl;
    }

    const sqRes = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
      method: 'POST',
      headers: {
        'Square-Version': '2025-01-23',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const sqData = await sqRes.json();

    if (!sqRes.ok || sqData.errors) {
      console.error('Square Payment Link API Error:', sqRes.status, sqData);
      return res.status(sqRes.status || 400).json({
        success: false,
        error: sqData.errors?.[0]?.detail || 'Square決済リンクの生成に失敗しました',
        details: sqData.errors
      });
    }

    return res.status(200).json({
      success: true,
      url: sqData.payment_link?.url || sqData.payment_link?.long_url,
      paymentLinkId: sqData.payment_link?.id,
      orderId: sqData.payment_link?.order_id,
      createdAt: sqData.payment_link?.created_at
    });
  } catch (err: any) {
    console.error('Square checkout server error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error'
    });
  }
}
