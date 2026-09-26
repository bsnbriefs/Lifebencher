import { json, readBody, requireUser } from '../_lib/admin.js';
import { chatJson } from '../_lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireUser(req);
    const body = await readBody(req);
    const out = await chatJson(
      `Explain Lifebencher compatibility using ONLY the provided fields and the existing numeric score.
Return JSON:
{"explanation":"","starters":[]}
starters: 2 short respectful conversation openers. Do not invent traits, tribe, money, or children. Do not mention AI.`,
      JSON.stringify({
        score: body.score,
        summary: body.summary,
        me: body.me,
        them: body.them
      })
    );
    return json(res, 200, {
      explanation: String(out.explanation || body.summary || '').slice(0, 500),
      starters: Array.isArray(out.starters) ? out.starters.slice(0, 3).map((s) => String(s).slice(0, 160)) : []
    });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Explain failed' });
  }
}
