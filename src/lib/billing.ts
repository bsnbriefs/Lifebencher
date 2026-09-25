import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { PRODUCTS, productById } from './products';
import { auth, db } from './firebase';

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
}

export interface Entitlements {
  userId: string;
  plan: 'free' | 'plus' | 'priority';
  planExpiresAt: string | null;
  spotlightUntil: string | null;
  superInterestCredits: number;
  matchmakingPackage: 'none' | 'local' | 'international';
  matchmakingRemaining: number;
  conciergeTier: 'none' | 'concierge_150' | 'concierge_200' | 'concierge_350';
  conciergeStatus: 'none' | 'pending' | 'active' | 'completed';
  verificationRequested: boolean;
  extraMatches: number;
  updatedAt: string;
}

export const EMPTY_ENTITLEMENTS = (uid: string): Entitlements => ({
  userId: uid,
  plan: 'free',
  planExpiresAt: null,
  spotlightUntil: null,
  superInterestCredits: 0,
  matchmakingPackage: 'none',
  matchmakingRemaining: 0,
  conciergeTier: 'none',
  conciergeStatus: 'none',
  verificationRequested: false,
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
      const d = snap.data() as Partial<Entitlements>;
      onChange({ ...EMPTY_ENTITLEMENTS(uid), ...d, userId: uid });
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

export function listenAllTransactions(onChange: (rows: BillingTransaction[]) => void): () => void {
  return onSnapshot(
    collection(db, 'transactions'),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BillingTransaction, 'id'>) }));
      onChange(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    () => onChange([])
  );
}

export async function createPendingTransaction(productId: string, matchId?: string): Promise<string> {
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
    ...(matchId ? { matchId } : {})
  };
  const ref = await addDoc(collection(db, 'transactions'), payload);
  return ref.id;
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
  } else if (product?.id === 'priority_monthly') {
    patch.plan = 'priority';
    patch.planExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  } else if (product?.id === 'matchmaking_local') {
    patch.matchmakingPackage = 'local';
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'matchmaking_international') {
    patch.matchmakingPackage = 'international';
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'concierge_150' || product?.id === 'concierge_200' || product?.id === 'concierge_350') {
    patch.conciergeTier = product.id;
    patch.conciergeStatus = 'pending';
  } else if (product?.kind === 'spotlight') {
    const hours = product.id === 'spotlight_7d' ? 24 * 7 : product.id === 'spotlight_3d' ? 24 * 3 : 24;
    patch.spotlightUntil = new Date(Date.now() + hours * 3600000).toISOString();
  } else if (product?.kind === 'super_interest') {
    const add = product.id === 'super_15' ? 15 : product.id === 'super_5' ? 5 : 1;
    patch.superInterestCredits = add;
  } else if (product?.id === 'verification_request') {
    patch.verificationRequested = true;
    await setDoc(
      doc(db, 'verificationRequests', uid),
      { userId: uid, status: 'pending', transactionId: tx.id, createdAt: new Date().toISOString() },
      { merge: true }
    );
  } else if (product?.id === 'extra_match') {
    patch.extraMatches = 1;
  }

  await setDoc(doc(db, 'entitlements', uid), patch, { merge: true });
  await adminSetTransactionStatus(tx.id, 'success');
}

export { PRODUCTS };
