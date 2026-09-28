import { getAdmin, json, readBody, requireUser } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const decoded = await requireUser(req);
    const { matchId, path } = await readBody(req);
    if (!matchId || !path) return json(res, 400, { error: 'Missing path' });
    if (!String(path).startsWith(`chatAudio/${matchId}/`) && !String(path).startsWith(`chatPhotos/${matchId}/`)) {
      return json(res, 403, { error: 'Not allowed' });
    }
    const admin = getAdmin();
    const matchSnap = await admin.firestore().doc(`matches/${matchId}`).get();
    if (!matchSnap.exists) return json(res, 404, { error: 'Not found' });
    const match = matchSnap.data();
    if (decoded.uid !== match.user1Id && decoded.uid !== match.user2Id) {
      return json(res, 403, { error: 'Not allowed' });
    }
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    const names = [
      process.env.FIREBASE_STORAGE_BUCKET,
      cred.project_id ? `${cred.project_id}.firebasestorage.app` : null,
      cred.project_id ? `${cred.project_id}.appspot.com` : null
    ].filter(Boolean);
    let lastErr;
    for (const name of names) {
      try {
        const [url] = await admin.storage().bucket(name).file(path).getSignedUrl({
          action: 'read',
          expires: Date.now() + 120 * 1000,
          version: 'v4'
        });
        return json(res, 200, { url });
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Unable to play this voice message. Tap to retry.');
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Unable to play this voice message. Tap to retry.' });
  }
}
