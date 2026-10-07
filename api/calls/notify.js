import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const { matchId, calleeId } = await readBody(req);
    if (!matchId || !calleeId || calleeId === user.uid) return json(res, 400, { error: 'Invalid call' });
    const db = getAdmin().firestore();
    const match = await db.doc(`matches/${matchId}`).get();
    const data = match.data() || {};
    if (data.user1Id !== user.uid && data.user2Id !== user.uid) return json(res, 403, { error: 'Forbidden' });
    const caller = await db.doc(`profiles/${user.uid}`).get();
    const name = caller.data()?.displayName || 'Someone';
    await db.collection('notifications').doc(`call-${matchId}-${Date.now()}`).set({
      userId: calleeId,
      title: 'Incoming call',
      body: `${name} is calling you`,
      href: 'messages',
      read: false,
      createdAt: new Date().toISOString()
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Call alert failed' });
  }
}
