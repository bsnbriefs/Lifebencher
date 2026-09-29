import { json, readBody, requireUser, getAdmin } from '../../server/_lib/admin.js';
import { chatJson } from '../../server/_lib/ai.js';

const FAQ = `Lifebencher Match FAQ (answer ONLY from this):
- Nigeria matchmaking ₦30,000 one-time, up to 3 introductions, local Discover pool.
- International matchmaking ₦50,000 one-time, up to 3 introductions, international pool.
- Nigeria + International ₦60,000 one-time, both pools, up to 3 introductions.
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
  const action = String(req.query?.action || '').replace(/^\//, '');
  try {
    if (action === 'support') return support(req, res);
    if (action === 'profile-assist') return profileAssist(req, res);
    if (action === 'match-explain') return matchExplain(req, res);
    if (action === 'photo-moderation') return photoModeration(req, res);
    if (action === 'safety-scan') return safetyScan(req, res);
    if (action === 'receipt-review') return receiptReview(req, res);
    return json(res, 404, { error: 'Unknown AI action' });
  } catch (err) {
    const status = err.status || 500;
    return json(res, status, { error: status === 503 ? 'unavailable' : err.message || 'AI request failed' });
  }
}

async function support(req, res) {
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
}

async function profileAssist(req, res) {
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
}

async function matchExplain(req, res) {
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
}

async function photoModeration(req, res) {
  await requireUser(req);
  const { imageUrl } = await readBody(req);
  if (!imageUrl) return json(res, 400, { error: 'Missing image' });
  const out = await chatJson(
    'You review dating profile photos. Return JSON {"flagged":false,"reason":""}. Flag only clear nudity, sexual acts, or pornographic content. Uncertain = flagged false. Do not invent.',
    'Is this photo acceptable as a public dating profile picture?',
    imageUrl
  );
  return json(res, 200, { flagged: Boolean(out.flagged), reason: String(out.reason || '').slice(0, 200) });
}

async function safetyScan(req, res) {
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
}

async function receiptReview(req, res) {
  const user = await requireUser(req);
  const body = await readBody(req);
  const receiptUrl = String(body.receiptUrl || '');
  const txId = String(body.txId || '');
  const expectedAmount = Number(body.expectedAmountNgn || 0);
  const productName = String(body.productName || '');
  if (!receiptUrl) return json(res, 400, { error: 'Missing receipt' });
  const out = await chatJson(
    `You read Nigerian bank-transfer receipts and alerts for Lifebencher Match.
Return JSON only:
{"amountNgn":null,"date":"","bank":"","sender":"","reference":"","consistent":false,"confidence":0,"note":""}
amountNgn is a number if visible. consistent is true only if amount is within 2% of expectedAmountNgn.
confidence is 0-1. note is one sentence for an admin. Never approve payment. Never invent a matching amount if unreadable.`,
    `Expected product: ${productName}. Expected amount NGN: ${expectedAmount}. Extract fields from the image.`,
    receiptUrl
  );
  const note = String(out.note || 'Receipt uploaded — admin review required.').slice(0, 400);
  const confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
  if (txId) {
    try {
      await getAdmin().firestore().collection('transactions').doc(txId).update({
        aiReceiptNote: note,
        aiReceiptConfidence: confidence,
        aiReceiptExtract: {
          amountNgn: out.amountNgn ?? null,
          date: String(out.date || '').slice(0, 40),
          bank: String(out.bank || '').slice(0, 80),
          sender: String(out.sender || '').slice(0, 80),
          reference: String(out.reference || '').slice(0, 80),
          consistent: Boolean(out.consistent)
        }
      });
    } catch {
      /* admin SDK should succeed */
    }
  }
  return json(res, 200, { note, confidence, extract: out, userId: user.uid });
}
