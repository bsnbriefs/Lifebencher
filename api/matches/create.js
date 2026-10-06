import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';

function matchIdFor(a, b) {
  const [x, y] = [a, b].sort();
  return `m_${x}_${y}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const decoded = await requireUser(req);
    const { otherUserId } = await readBody(req);
    if (!otherUserId || otherUserId === decoded.uid) return json(res, 400, { error: 'Invalid match' });

    const admin = getAdmin();
    const db = admin.firestore();
    const id = matchIdFor(decoded.uid, otherUserId);
    const ref = db.doc(`matches/${id}`);
    const existing = await ref.get();
    if (existing.exists) return json(res, 200, { id });

    const entRef = db.doc(`entitlements/${decoded.uid}`);
    const ent = await entRef.get();
    const data = ent.exists ? ent.data() : {};
    const extra = Math.max(0, Number(data.extraMatches || 0));
    const cap = 3 + extra;
    const [asUser1, asUser2] = await Promise.all([
      db.collection('matches').where('user1Id', '==', decoded.uid).get(),
      db.collection('matches').where('user2Id', '==', decoded.uid).get()
    ]);
    const ids = new Set();
    asUser1.docs.forEach((d) => ids.add(d.id));
    asUser2.docs.forEach((d) => ids.add(d.id));
    if (ids.size >= cap) return json(res, 403, { error: 'Your 3-match allowance has been used. Existing chats stay open.' });

    const now = new Date().toISOString();
    await ref.set({
      id,
      user1Id: decoded.uid,
      user2Id: otherUserId,
      status: 'active',
      startedAt: now,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      extendedCount: 0
    });
    await entRef.set({
      matchmakingRemaining: Math.max(0, cap - (ids.size + 1)),
      updatedAt: now
    }, { merge: true });
    return json(res, 200, { id });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Could not open match' });
  }
}
