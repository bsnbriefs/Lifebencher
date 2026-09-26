import { json, readBody, requireUser } from '../_lib/admin.js';
import { chatJson } from '../_lib/ai.js';

const FACTS = `Lifebencher Match (lifebencher.xyz) product facts:
- Nigeria matchmaking ₦30,000 one-time, up to 3 introductions.
- International matchmaking ₦50,000 one-time, up to 3 introductions.
- Lifebencher Plus ₦5,000/month (who liked you, filters, 1 boost).
- Profile Boost ₦1,000 / 24 hours.
- New card payments go through Flutterwave and unlock after verification — no admin.
- People who paid before the website upload a receipt from gallery on the matchmaking screen; admin Billing confirms. They must not pay again.
- Profiles stay hidden from Discover until admin verifies or a matchmaking claim is granted.
- Matching uses mutual interest and a 7-day connection window.
- Phone SMS may fail; email and password work.
If you do not know, say ask support. Never invent a price.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    await requireUser(req);
    const body = await readBody(req);
    const question = String(body.question || '').slice(0, 400);
    if (!question) return json(res, 400, { error: 'Ask a question' });
    const out = await chatJson(
      `${FACTS}\nReturn JSON {"answer":""} in plain helpful English, 3 sentences max.`,
      question
    );
    return json(res, 200, { answer: String(out.answer || '').slice(0, 800) });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Support failed' });
  }
}
