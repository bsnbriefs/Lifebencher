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
    if (!userId || userId === adminUser.uid) return json(res, 400, { error: 'You cannot remove this account.' });
    if (reason.length < 8) return json(res, 400, { error: 'A removal reason is required.' });

    const admin = getAdmin();
    const db = admin.firestore();
    const [profileSnap, userSnap] = await Promise.all([
      db.doc(`profiles/${userId}`).get(),
      db.doc(`users/${userId}`).get()
    ]);
    if (!profileSnap.exists) return json(res, 404, { error: 'Account not found' });
    const profile = profileSnap.data() || {};
    const user = userSnap.data() || {};
    if (profile.isAdminProfile === true || user.role === 'admin' || user.email === SUPER) {
      return json(res, 400, { error: 'Admin accounts cannot be removed here.' });
    }

    await admin.auth().updateUser(userId, { disabled: true }).catch(() => undefined);
    const now = new Date().toISOString();
    await db.doc(`profiles/${userId}`).set({
      isVisible: false,
      isVerified: false,
      accountStatus: 'removed',
      removedAt: now,
      removedBy: adminUser.uid,
      removalReason: reason,
      updatedAt: now
    }, { merge: true });
    const [asUser1, asUser2] = await Promise.all([
      db.collection('matches').where('user1Id', '==', userId).get(),
      db.collection('matches').where('user2Id', '==', userId).get()
    ]);
    await Promise.all([...asUser1.docs, ...asUser2.docs].map((d) => d.ref.set({ status: 'ended', endedAt: now }, { merge: true })));
    await db.collection('moderationActions').add({
      targetUserId: userId,
      adminUserId: adminUser.uid,
      action: 'account_removed',
      reason,
      preserved: ['transactions', 'entitlements', 'moderationActions'],
      createdAt: now
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Removal failed' });
  }
}
