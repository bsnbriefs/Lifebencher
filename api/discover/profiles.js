import { getAdmin, json, requireUser } from '../../server/_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const snap = await getAdmin().firestore().collection('profiles').limit(200).get();
    const profiles = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.id !== user.uid && p.userId !== user.uid && p.isAdminProfile !== true)
      .filter((p) => p.isVerified === true || p.isVisible === true)
      .map((p) => ({
        id: p.id,
        userId: p.userId || p.id,
        displayName: p.displayName || '',
        age: p.age || 0,
        gender: p.gender || 'other',
        location: p.location || '',
        profession: p.profession || '',
        education: p.education || '',
        bio: p.bio || '',
        photoUrl: p.photoUrl || '',
        photoUrls: Array.isArray(p.photoUrls) ? p.photoUrls : [],
        interests: Array.isArray(p.interests) ? p.interests : [],
        values: Array.isArray(p.values) ? p.values : [],
        relationshipGoal: p.relationshipGoal || '',
        relationshipIntent: Array.isArray(p.relationshipIntent) ? p.relationshipIntent : [],
        lifestyle: p.lifestyle || {},
        isVerified: p.isVerified === true,
        isVisible: p.isVisible === true,
        matchType: p.matchType || null,
        createdAt: p.createdAt || '',
        updatedAt: p.updatedAt || '',
        lastActiveAt: p.lastActiveAt || ''
      }));
    return json(res, 200, { profiles });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Discover failed' });
  }
}
