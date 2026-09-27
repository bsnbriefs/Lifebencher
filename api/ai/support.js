import { json, readBody, requireUser } from '../_lib/admin.js';
import { chatJson } from '../_lib/ai.js';

const FAQ = `Lifebencher Match FAQ (answer ONLY from this):
- Nigeria matchmaking ₦30,000 one-time, up to 3 introductions, local Discover pool.
- International matchmaking ₦50,000 one-time, up to 3 introductions, international pool.
- Plus ₦5,000/month. Boost ₦1,000/24h. Extra introduction ₦10,000.
- New card payments: Flutterwave. Prior payments: upload receipt on pay screen; admin Billing confirms. Do not pay twice.
- Sign in: email/password, Google, or email link. No phone SMS login.
- Profiles hidden on Discover until payment verified or admin approval.
- Mutual interest opens a 7-day chat. Admins never appear on Discover.
- Install: Android Install prompt; iPhone Share → Add to Home Screen.
Escalate (needHuman true) for refunds, payment disputes, why I am not approved, missing membership, complaints, account-specific status, anything not in this FAQ.
Never invent prices or policies. You are Lifebencher's AI support assistant, not a human admin.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireUser(req);
    const body = await readBody(req);
    const question = String(body.question || '').slice(0, 400);
    if (!question) return json(res, 400, { error: 'Ask a question' });
    const out = await chatJson(
      `${FAQ}\nReturn JSON {"answer":"","needHuman":false}. If unsure, needHuman true and answer offer to connect a Lifebencher admin.`,
      question
    );
    const needHuman = Boolean(out.needHuman);
    const answer = String(
      out.answer ||
        (needHuman
          ? "I'm not able to answer that confidently. Would you like me to connect you with a Lifebencher admin?"
          : '')
    ).slice(0, 800);
    return json(res, 200, { answer, escalate: needHuman });
  } catch (err) {
    const status = err.status || 500;
    return json(res, status, {
      error: status === 503 ? 'unavailable' : 'Could not answer right now. Try again shortly.',
      escalate: true
    });
  }
}
