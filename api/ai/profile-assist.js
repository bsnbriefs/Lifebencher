import { json, readBody, requireUser } from '../_lib/admin.js';
import { chatJson } from '../_lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireUser(req);
    const body = await readBody(req);
    const draft = String(body.bio || '').slice(0, 1000);
    const extras = {
      displayName: String(body.displayName || '').slice(0, 60),
      profession: String(body.profession || '').slice(0, 100),
      location: String(body.location || '').slice(0, 100),
      relationshipGoal: String(body.relationshipGoal || '').slice(0, 100)
    };
    const out = await chatJson(
      `You help Lifebencher Match members polish a dating bio. Return JSON only:
{"suggestedBio":"","missing":[],"notes":""}
Rules: keep the user's meaning and voice. Never invent job, faith, children, income, or location they did not write. If the draft is empty, suggestedBio stays empty and missing lists what they should add.`,
      JSON.stringify({ draft, extras })
    );
    return json(res, 200, {
      suggestedBio: String(out.suggestedBio || '').slice(0, 1000),
      missing: Array.isArray(out.missing) ? out.missing.slice(0, 8).map(String) : [],
      notes: String(out.notes || '').slice(0, 400)
    });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Assist failed' });
  }
}
