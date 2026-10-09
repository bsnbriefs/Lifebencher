import { json, readBody, requireUser, getAdmin } from '../../server/_lib/admin.js';
import { matchTypeFromProductId, productById } from '../../server/_lib/catalog.js';
import {
  findTxByReference,
  grantVerifiedTransaction,
  verifyFlutterwave
} from '../../server/_lib/grant.js';

async function init(req, res) {
  const user = await requireUser(req);
  const body = await readBody(req);
  const product = productById(body.productId) || (body.productId === 'matchmaking_both'
    ? { id: 'matchmaking_both', name: 'Local + Foreign', priceNgn: 60000 }
    : null);

  if (!product) return json(res, 400, { error: 'Unknown product' });

  const db = getAdmin().firestore();
  const matchType = matchTypeFromProductId(product.id);
  const existing = await db.collection('transactions').where('userId', '==', user.uid).get();
  const pending = existing.docs.find((d) => d.data().productId === product.id && d.data().status === 'pending' && d.data().source === 'flutterwave');
  const reference = pending?.data().reference || `LB-${Date.now()}-${user.uid.slice(0, 6)}`;
  if (!pending) {
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
      ...(matchType ? { matchType } : {}),
      ...(body.matchId ? { matchId: String(body.matchId) } : {})
    });
  }

  const origin = String(
    body.origin || process.env.PUBLIC_APP_URL || 'https://lifebencher.xyz'
  ).replace(/\/$/, '');

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
        productId: product.id,
        ...(matchType ? { matchType } : {})
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
    return json(res, 502, {
      error: flw?.message || 'Flutterwave did not return a checkout link'
    });
  }

  return json(res, 200, { link, reference });
}

async function verify(req, res) {
  await requireUser(req);

  const body = await readBody(req);
  const transactionId = body.transaction_id || body.transactionId;
  const txRef = body.tx_ref || body.txRef;

  if (!transactionId || !txRef) {
    return json(res, 400, {
      error: 'Missing transaction_id or tx_ref'
    });
  }

  const txSnap = await findTxByReference(txRef);
  if (!txSnap) return json(res, 404, { error: 'Payment record not found' });

  const expected = txSnap.data();
  const flw = await verifyFlutterwave(transactionId);
  const data = flw?.data;

  const ok =
    flw?.status === 'success' &&
    data?.status === 'successful' &&
    data?.tx_ref === txRef &&
    data?.currency === 'NGN' &&
    Number(data?.amount) >= Number(expected.amountNgn);

  if (!ok) {
    await txSnap.ref.update({
      status: expected.status === 'success' ? 'success' : 'failed'
    });

    return json(res, 400, {
      error: 'Payment not verified',
      verified: false
    });
  }

  const result = await grantVerifiedTransaction(txSnap);

  return json(res, 200, {
    verified: true,
    granted: result.granted
  });
}

async function webhook(req, res) {
  const hash = process.env.FLW_SECRET_HASH || '';
  const incoming = req.headers['verif-hash'];

  if (!hash || incoming !== hash) {
    return json(res, 401, { error: 'Invalid webhook' });
  }

  try {
    const body = await readBody(req);
    const data = body.data || {};
    const txRef = data.tx_ref;
    const id = data.id;

    if (!txRef || !id) {
      return json(res, 200, { ok: true });
    }

    const flw = await verifyFlutterwave(id);
    const verified = flw?.data;

    if (
      verified?.status !== 'successful' ||
      verified?.tx_ref !== txRef ||
      verified?.currency !== 'NGN'
    ) {
      return json(res, 200, { ok: true, skipped: true });
    }

    const txSnap = await findTxByReference(txRef);

    if (!txSnap) {
      return json(res, 200, { ok: true, missing: true });
    }

    if (Number(verified.amount) < Number(txSnap.data().amountNgn)) {
      return json(res, 200, { ok: true, amount: false });
    }

    await grantVerifiedTransaction(txSnap);

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('flutterwave webhook', err);
    return json(res, 200, { ok: true });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const action = req.query?.action;

    if (action === 'init') return await init(req, res);
    if (action === 'verify') return await verify(req, res);
    if (action === 'webhook') return await webhook(req, res);

    return json(res, 404, { error: 'Unknown action' });
  } catch (err) {
    return json(res, err.status || 500, {
      error: err.message || 'Flutterwave request failed'
    });
  }
}
