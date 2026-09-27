import { getAdmin, json, readBody, requireUser } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const decoded = await requireUser(req);
    const { matchId, messageId } = await readBody(req);
    if (!matchId || !messageId) return json(res, 400, { error: 'Missing message' });
    const admin = getAdmin();
    const db = admin.firestore();
    const matchSnap = await db.doc(`matches/${matchId}`).get();
    if (!matchSnap.exists) return json(res, 404, { error: 'Not found' });
    const match = matchSnap.data();
    if (decoded.uid !== match.user1Id && decoded.uid !== match.user2Id) {
      return json(res, 403, { error: 'Not allowed' });
    }
    const msgRef = db.doc(`matches/${matchId}/messages/${messageId}`);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) return json(res, 404, { error: 'Not found' });
    const msg = msgSnap.data();
    if (!msg.viewOnce || !msg.imagePath) return json(res, 400, { error: 'Not a view-once photo' });
    const isSender = decoded.uid === msg.senderId;
    if (msg.viewedAt && !isSender) return json(res, 410, { error: 'Already viewed' });

    const file = admin.storage().bucket().file(msg.imagePath);
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 1000 });
    if (!isSender && !msg.viewedAt) {
      await msgRef.update({ viewedAt: new Date().toISOString() });
      await file.delete().catch(() => null);
    }
    return json(res, 200, { url });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Could not open photo' });
  }
}
