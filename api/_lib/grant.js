import { getAdmin } from "./admin.js";
import { productById } from "./catalog.js";

export function entitlementPatch(productId, uid) {
  const product = productById(productId);
  const patch = {
    userId: uid,
    updatedAt: new Date().toISOString(),
  };
  if (product?.id === "plus_monthly") {
    patch.plan = "plus";
    patch.planExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  } else if (product?.id === "matchmaking_local") {
    patch.matchmakingPackage = "local";
    patch.matchmakingRemaining = 3;
  } else if (product?.id === "matchmaking_international") {
    patch.matchmakingPackage = "international";
    patch.matchmakingRemaining = 3;
  } else if (product?.id === "boost_24h") {
    patch.spotlightUntil = new Date(Date.now() + 24 * 3600000).toISOString();
  } else if (product?.id === "extra_match") {
    patch.extraMatches = 1;
  }
  return patch;
}

export async function grantVerifiedTransaction(txSnap) {
  const db = getAdmin().firestore();
  const data = txSnap.data();
  if (!data) return { granted: false, reason: "missing" };
  if (data.status === "success") return { granted: false, reason: "already" };

  const patch = entitlementPatch(data.productId, data.userId);
  await db
    .collection("entitlements")
    .doc(data.userId)
    .set(patch, { merge: true });
  await txSnap.ref.update({
    status: "success",
    confirmedAt: new Date().toISOString(),
    source: "flutterwave",
  });
  return { granted: true };
}

export async function findTxByReference(reference) {
  const db = getAdmin().firestore();
  const snap = await db
    .collection("transactions")
    .where("reference", "==", reference)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0];
}

export async function verifyFlutterwave(transactionId) {
  const secret = process.env.FLW_SECRET_KEY;
  if (!secret) throw new Error("FLW_SECRET_KEY is not set");
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    }
  );
  const body = await res.json();
  return body;
}
