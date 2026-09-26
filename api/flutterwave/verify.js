import { json, readBody, requireUser } from "../_lib/admin.js";
import {
  findTxByReference,
  grantVerifiedTransaction,
  verifyFlutterwave,
} from "../_lib/grant.js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return json(res, 405, { error: "Method not allowed" });
  try {
    await requireUser(req);
    const body = await readBody(req);
    const transactionId = body.transaction_id || body.transactionId;
    const txRef = body.tx_ref || body.txRef;
    if (!transactionId || !txRef)
      return json(res, 400, { error: "Missing transaction_id or tx_ref" });

    const txSnap = await findTxByReference(txRef);
    if (!txSnap) return json(res, 404, { error: "Payment record not found" });
    const expected = txSnap.data();

    const flw = await verifyFlutterwave(transactionId);
    const data = flw?.data;
    const ok =
      flw?.status === "success" &&
      data?.status === "successful" &&
      data?.tx_ref === txRef &&
      data?.currency === "NGN" &&
      Number(data?.amount) >= Number(expected.amountNgn);

    if (!ok) {
      await txSnap.ref.update({
        status: expected.status === "success" ? "success" : "failed",
      });
      return json(res, 400, { error: "Payment not verified", verified: false });
    }

    const result = await grantVerifiedTransaction(txSnap);
    return json(res, 200, { verified: true, granted: result.granted });
  } catch (err) {
    return json(res, err.status || 500, {
      error: err.message || "Verify failed",
    });
  }
}
