import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';

const SUPER = 'admin@barristerstreet.org';

async function requireAdmin(req) {
  const user = await requireUser(req);
  if (user.email === SUPER) return user;
  const db = getAdmin().firestore();
  const [adminDoc, userDoc] = await Promise.all([
    db.collection('admins').doc(user.uid).get(),
    db.collection('users').doc(user.uid).get()
  ]);
  if (adminDoc.exists || userDoc.data()?.role === 'admin') return user;
  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const adminUser = await requireAdmin(req);
    const body = await readBody(req);
    const userId = String(body.userId || '');
    const reason = String(body.reason || '').trim();
    if (!userId || userId === adminUser.uid) return json(res, 400, { error: 'Invalid account' });
    if (reason.length < 8) return json(res, 400, { error: 'A removal reason is required.' });

    const admin = getAdmin();
    const db = admin.firestore();
    await admin.auth().updateUser(userId, { disabled: true }).catch(() => undefined);
    await db.doc(`profiles/${userId}`).set({
      isVisible: false,
      isVerified: false,
      accountStatus: 'removed',
      removedAt: new Date().toISOString()
    }, { merge: true });
    await db.collection('moderationActions').add({
      targetUserId: userId,
      adminUserId: adminUser.uid,
      action: 'account_removed',
      reason,
      createdAt: new Date().toISOString()
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Removal failed' });
  }
}
