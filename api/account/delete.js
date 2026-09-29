import { getAdmin, json, requireUser } from '../../server/_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const decoded = await requireUser(req);
    const uid = decoded.uid;
    const admin = getAdmin();
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    await db.doc(`profiles/${uid}`).set({ isVisible: false, isVerified: false, updatedAt: new Date().toISOString() }, { merge: true });
    await Promise.all([
      db.doc(`profiles/${uid}`).delete().catch(() => null),
      db.doc(`preferences/${uid}`).delete().catch(() => null),
      db.doc(`users/${uid}`).delete().catch(() => null)
    ]);

    for (const prefix of [`profilePhotos/${uid}/`, `receipts/${uid}/`]) {
      try {
        await bucket.deleteFiles({ prefix, force: true });
      } catch {
        /* ignore */
      }
    }
    try {
      const [files] = await bucket.getFiles({ prefix: 'chatPhotos/' });
      await Promise.all(
        files.filter((f) => f.name.includes(`/${uid}/`)).map((f) => f.delete().catch(() => null))
      );
    } catch {
      /* ignore */
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Delete failed' });
  }
}
