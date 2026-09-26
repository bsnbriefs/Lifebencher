import { json, readBody, requireUser, getAdmin } from '../_lib/admin.js';
import { productById } from '../_lib/catalog.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const body = await readBody(req);
    const product = productById(body.productId);
    if (!product) return json(res, 400, { error: 'Unknown product' });

    const db = getAdmin().firestore();
    const reference = `LB-${Date.now()}-${user.uid.slice(0, 6)}`;
    const origin = String(body.origin || process.env.PUBLIC_APP_URL || 'https://lifebencher.xyz').replace(/\/$/, '');

    await db.collection('transactions').add({
      userId: user.uid,
      productId: product.id,
      productName: product.name,
      amountNgn: product.priceNgn,
      currency: 'NGN',
      status: 'pending',
      reference,
      source: 'flutterwave',
      createdAt: new Date().toISOString(),
      ...(body.matchId ? { matchId: String(body.matchId) } : {})
    });

    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: product.priceNgn,
        currency: 'NGN',
        redirect_url: `${origin}/?flw=1`,
        customer: {
          email: body.email || user.email || 'member@lifebencher.xyz',
          name: body.name || 'Lifebencher member',
          phonenumber: body.phone || ''
        },
        meta: {
          userId: user.uid,
          productId: product.id
        },
        customizations: {
          title: 'Lifebencher Match',
          description: product.name
        }
      })
    });
    const flw = await flwRes.json();
    const link = flw?.data?.link;
    if (!link) {
      return json(res, 502, { error: flw?.message || 'Flutterwave did not return a checkout link' });
    }
    return json(res, 200, { link, reference });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Init failed' });
  }
}
