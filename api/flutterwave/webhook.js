import { json, readBody } from "../_lib/admin.js";
import {
  findTxByReference,
  grantVerifiedTransaction,
  verifyFlutterwave,
} from "../_lib/grant.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return json(res, 405, { error: "Method not allowed" });
  const hash = process.env.FLW_SECRET_HASH || "";
  const incoming = req.headers["verif-hash"];
  if (!hash || incoming !== hash)
    return json(res, 401, { error: "Invalid webhook" });

  try {
    const body = await readBody(req);
    const data = body.data || {};
    const txRef = data.tx_ref;
    const id = data.id;
    if (!txRef || !id) return json(res, 200, { ok: true });

    const flw = await verifyFlutterwave(id);
    const verified = flw?.data;
    if (
      verified?.status !== "successful" ||
      verified?.tx_ref !== txRef ||
      verified?.currency !== "NGN"
    ) {
      return json(res, 200, { ok: true, skipped: true });
    }

    const txSnap = await findTxByReference(txRef);
    if (!txSnap) return json(res, 200, { ok: true, missing: true });
    if (Number(verified.amount) < Number(txSnap.data().amountNgn)) {
      return json(res, 200, { ok: true, amount: false });
    }
    await grantVerifiedTransaction(txSnap);
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 200, { ok: true });
  }
}
