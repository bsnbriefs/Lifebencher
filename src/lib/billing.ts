import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { PRODUCTS, matchTypeFromProductId, productById } from './products';
import { auth, db, storage } from './firebase';

export type TxStatus = 'pending' | 'success' | 'failed';

export interface BillingTransaction {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  amountNgn: number;
  currency: 'NGN';
  status: TxStatus;
  reference: string;
  createdAt: string;
  confirmedAt?: string;
  matchId?: string;
  receiptUrl?: string;
  source?: string;
  matchType?: 'local' | 'international' | null;
  aiReceiptNote?: string;
  aiReceiptConfidence?: number;
}

export interface Entitlements {
  userId: string;
  plan: 'free' | 'plus';
  planExpiresAt: string | null;
  spotlightUntil: string | null;
  matchmakingPackage: 'none' | 'local' | 'international';
  matchType: 'local' | 'international' | 'none';
  matchmakingRemaining: number;
  extraMatches: number;
  updatedAt: string;
}

export const EMPTY_ENTITLEMENTS = (uid: string): Entitlements => ({
  userId: uid,
  plan: 'free',
  planExpiresAt: null,
  spotlightUntil: null,
  matchmakingPackage: 'none',
  matchType: 'none',
  matchmakingRemaining: 0,
  extraMatches: 0,
  updatedAt: new Date().toISOString()
});

export function planActive(ent: Entitlements): boolean {
  if (ent.plan === 'free') return false;
  if (!ent.planExpiresAt) return false;
  return new Date(ent.planExpiresAt).getTime() > Date.now();
}

export function spotlightActive(ent: Entitlements): boolean {
  return Boolean(ent.spotlightUntil && new Date(ent.spotlightUntil).getTime() > Date.now());
}

export function listenEntitlements(uid: string, onChange: (ent: Entitlements) => void): () => void {
  return onSnapshot(
    doc(db, 'entitlements', uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(EMPTY_ENTITLEMENTS(uid));
        return;
      }
      const d = snap.data() as Partial<Entitlements> & { matchType?: string };
      const matchType =
        d.matchType === 'local' || d.matchType === 'international'
          ? d.matchType
          : d.matchmakingPackage === 'local' || d.matchmakingPackage === 'international'
            ? d.matchmakingPackage
            : 'none';
      onChange({ ...EMPTY_ENTITLEMENTS(uid), ...d, matchType, userId: uid });
    },
    () => onChange(EMPTY_ENTITLEMENTS(uid))
  );
}

export function listenMyTransactions(uid: string, onChange: (rows: BillingTransaction[]) => void): () => void {
  const q = query(collection(db, 'transactions'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BillingTransaction, 'id'>) }));
      onChange(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    () => onChange([])
  );
}

export function listenAllTransactions(
  onChange: (rows: BillingTransaction[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    collection(db, 'transactions'),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BillingTransaction, 'id'>) }));
      onChange(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    (err) => {
      onChange([]);
      onError?.(err.message || 'Cannot list billing. Publish Firestore rules and set users/{uid}.role to admin.');
    }
  );
}

export async function uploadPaymentReceipt(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (file.size > 5 * 1024 * 1024) throw new Error('Receipt must be under 5MB');
  const path = `receipts/${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '')}`;
  const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type || 'image/jpeg' });
  return getDownloadURL(snap.ref);
}

export async function createPendingTransaction(
  productId: string,
  extras?: { matchId?: string; receiptUrl?: string }
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const product = productById(productId);
  if (!product) throw new Error('Unknown product');
  const now = new Date().toISOString();
  const reference = `LB-${Date.now()}-${uid.slice(0, 6)}`;
  const payload = {
    userId: uid,
    productId: product.id,
    productName: product.name,
    amountNgn: product.priceNgn,
    currency: 'NGN' as const,
    status: 'pending' as const,
    reference,
    createdAt: now,
    source: extras?.receiptUrl ? 'receipt_claim' : 'claim',
    ...(matchTypeFromProductId(product.id) ? { matchType: matchTypeFromProductId(product.id) } : {}),
    ...(extras?.matchId ? { matchId: extras.matchId } : {}),
    ...(extras?.receiptUrl ? { receiptUrl: extras.receiptUrl } : {})
  };
  const ref = await addDoc(collection(db, 'transactions'), payload);
  return ref.id;
}

async function publishProfileIfComplete(uid: string, matchType?: 'local' | 'international' | null): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'profiles', uid));
    const d = snap.data() || {};
    const complete = Boolean(d.displayName) && (Boolean(d.bio) || Boolean(d.profession) || Boolean(d.photoUrl));
    if (!complete) return;
    await updateDoc(doc(db, 'profiles', uid), {
      isVisible: true,
      isVerified: true,
      updatedAt: new Date().toISOString(),
      ...(matchType ? { matchType } : {})
    });
  } catch {
    /* admin session required to flip visibility */
  }
}

export async function adminSetTransactionStatus(id: string, status: TxStatus): Promise<void> {
  await updateDoc(doc(db, 'transactions', id), {
    status,
    ...(status === 'pending' ? {} : { confirmedAt: new Date().toISOString() })
  });
}

export async function adminGrantFromTransaction(tx: BillingTransaction): Promise<void> {
  const uid = tx.userId;
  const product = productById(tx.productId);
  const patch: Record<string, unknown> = {
    userId: uid,
    updatedAt: new Date().toISOString()
  };

  if (product?.id === 'plus_monthly') {
    patch.plan = 'plus';
    patch.planExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  } else if (product?.id === 'matchmaking_local' || product?.id === 'matchmaking_international') {
    const matchType = matchTypeFromProductId(product.id);
    patch.matchmakingPackage = matchType;
    patch.matchType = matchType;
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'boost_24h' || product?.kind === 'boost') {
    patch.spotlightUntil = new Date(Date.now() + 24 * 3600000).toISOString();
  } else if (product?.id === 'extra_match') {
    patch.extraMatches = 1;
  }

  await setDoc(doc(db, 'entitlements', uid), patch, { merge: true });
  await adminSetTransactionStatus(tx.id, 'success');
  if (product?.id === 'matchmaking_local' || product?.id === 'matchmaking_international') {
    await publishProfileIfComplete(uid, matchTypeFromProductId(product.id));
  }
}

export async function adminGrantMatchmaking(
  uid: string,
  pack: 'local' | 'international'
): Promise<void> {
  await setDoc(
    doc(db, 'entitlements', uid),
    {
      userId: uid,
      matchmakingPackage: pack,
      matchType: pack,
      matchmakingRemaining: 3,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  await publishProfileIfComplete(uid, pack);
}

export { PRODUCTS };
