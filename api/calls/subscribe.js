import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const { subscription } = await readBody(req);
    if (!subscription?.endpoint) return json(res, 400, { error: 'Missing subscription' });
    const id = Buffer.from(subscription.endpoint).toString('base64url').slice(-80);
    await getAdmin().firestore().doc(`pushSubscriptions/${id}`).set({
      userId: user.uid,
      subscription,
      updatedAt: new Date().toISOString()
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Could not save subscription' });
  }
}
