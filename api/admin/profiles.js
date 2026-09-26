import { getAdmin, json, requireUser } from '../_lib/admin.js';

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
  const err = new Error('Admin only');
  err.status = 403;
  throw err;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const snap = await getAdmin().firestore().collection('profiles').get();
    const profiles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return json(res, 200, { profiles });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'List failed' });
  }
}
