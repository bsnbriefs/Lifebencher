import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';
import webpush from 'web-push';

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const { matchId, calleeId, callType } = await readBody(req);
    if (!matchId || !calleeId || calleeId === user.uid) return json(res, 400, { error: 'Invalid call' });
    const db = getAdmin().firestore();
    const match = await db.doc(`matches/${matchId}`).get();
    const data = match.data() || {};
    if (data.user1Id !== user.uid && data.user2Id !== user.uid) return json(res, 403, { error: 'Forbidden' });
    const caller = await db.doc(`profiles/${user.uid}`).get();
    const name = caller.data()?.displayName || 'Someone';
    const kind = callType === 'video' ? 'video' : 'voice';
    await db.collection('notifications').doc(`call-${matchId}`).set({
      userId: calleeId,
      title: `${name} is calling you`,
      body: `Incoming ${kind} call`,
      href: 'messages',
      callId: matchId,
      read: false,
      createdAt: new Date().toISOString()
    });
    if (!configured()) return json(res, 200, { ok: true, push: 'vapid_missing' });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@barristerstreet.org', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const subs = await db.collection('pushSubscriptions').where('userId', '==', calleeId).get();
    const payload = JSON.stringify({
      type: 'incoming_call',
      callId: matchId,
      callerId: user.uid,
      callerName: name,
      callType: kind,
      title: `${name} is calling you`,
      body: `Incoming ${kind} call`,
      url: `/#messages?callId=${matchId}`
    });
    let sent = 0;
    for (const doc of subs.docs) {
      try {
        await webpush.sendNotification(doc.data().subscription, payload);
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await doc.ref.delete();
      }
    }
    return json(res, 200, { ok: true, sent });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Call alert failed' });
  }
}
