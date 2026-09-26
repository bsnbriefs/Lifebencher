import { json, readBody, requireUser, getAdmin } from '../_lib/admin.js';
import { chatJson } from '../_lib/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
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
        /* client-created doc; admin update may fail if rules — server admin SDK bypasses */
      }
    }

    return json(res, 200, {
      note,
      confidence,
      extract: out,
      userId: user.uid
    });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || 'Receipt review failed' });
  }
}
