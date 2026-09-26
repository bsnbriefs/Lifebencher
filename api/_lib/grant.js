import { getAdmin } from './admin.js';
import { productById } from './catalog.js';

export function entitlementPatch(productId, uid, existing = {}) {
  const product = productById(productId);
  const patch = {
    userId: uid,
    updatedAt: new Date().toISOString()
  };
  if (product?.id === 'plus_monthly') {
    const base = existing.planExpiresAt ? new Date(existing.planExpiresAt) : new Date();
    const start = base.getTime() > Date.now() ? base : new Date();
    patch.plan = 'plus';
    patch.planExpiresAt = new Date(start.getTime() + 30 * 86400000).toISOString();
  } else if (product?.id === 'matchmaking_local') {
    patch.matchmakingPackage = 'local';
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'matchmaking_international') {
    patch.matchmakingPackage = 'international';
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'boost_24h') {
    const until = existing.spotlightUntil ? new Date(existing.spotlightUntil) : new Date();
    const start = until.getTime() > Date.now() ? until : new Date();
    patch.spotlightUntil = new Date(start.getTime() + 24 * 3600000).toISOString();
  } else if (product?.id === 'extra_match') {
    patch.extraMatches = Number(existing.extraMatches || 0) + 1;
  }
  return patch;
}

export async function grantVerifiedTransaction(txSnap) {
  const db = getAdmin().firestore();
  return db.runTransaction(async (t) => {
    const fresh = await t.get(txSnap.ref);
    const data = fresh.data();
    if (!data) return { granted: false, reason: 'missing' };
    if (data.status === 'success') return { granted: false, reason: 'already' };

    const entRef = db.collection('entitlements').doc(data.userId);
    const entSnap = await t.get(entRef);
    const patch = entitlementPatch(data.productId, data.userId, entSnap.data() || {});
    t.set(entRef, patch, { merge: true });
    t.update(fresh.ref, {
      status: 'success',
      confirmedAt: new Date().toISOString(),
      source: 'flutterwave'
    });
    return { granted: true };
  });
}

export async function findTxByReference(reference) {
  const db = getAdmin().firestore();
  const snap = await db.collection('transactions').where('reference', '==', reference).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0];
}

export async function verifyFlutterwave(transactionId) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error('FLW_SECRET_KEY is not set');
  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${secret}` }
  });
  return res.json();
}
