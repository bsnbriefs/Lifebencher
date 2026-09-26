import { json, readBody, requireUser, getAdmin } from '../_lib/admin.js';
import { chatJson } from '../_lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const body = await readBody(req);
    const text = String(body.text || '').slice(0, 2000);
    const kind = String(body.kind || 'bio');
    if (!text.trim()) return json(res, 200, { flagged: false });

    const out = await chatJson(
      `You flag possible scam, harassment, money-solicitation, spam, or explicit content for a Nigerian Christian courtship app.
Return JSON only:
{"flagged":false,"reason":"","confidence":0,"recommendedAction":"none"}
recommendedAction is none|review|hide. Never ban. Do not infer ethnicity or religion. Flag only from the text given.`,
      JSON.stringify({ kind, text })
    );

    const flagged = Boolean(out.flagged) && Number(out.confidence || 0) >= 0.55;
    if (flagged) {
      await getAdmin().firestore().collection('reviewQueue').add({
        type: kind === 'message' ? 'message_flag' : 'profile_flag',
        userId: user.uid,
        targetId: String(body.targetId || user.uid),
        reason: String(out.reason || 'Flagged text').slice(0, 400),
        evidence: text.slice(0, 500),
        confidence: Number(out.confidence || 0),
        recommendedAction: String(out.recommendedAction || 'review').slice(0, 20),
        status: 'open',
        createdAt: new Date().toISOString()
      });
    }
    return json(res, 200, { flagged, reason: flagged ? out.reason : '' });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Scan failed' });
  }
}
