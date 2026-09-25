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
  plan: 'free' | 'plus';
  planExpiresAt: string | null;
  spotlightUntil: string | null;
  matchmakingPackage: 'none' | 'local' | 'international';
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
  } else if (product?.id === 'matchmaking_local') {
    patch.matchmakingPackage = 'local';
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'matchmaking_international') {
    patch.matchmakingPackage = 'international';
    patch.matchmakingRemaining = 3;
  } else if (product?.id === 'boost_24h' || product?.kind === 'boost') {
    patch.spotlightUntil = new Date(Date.now() + 24 * 3600000).toISOString();
  } else if (product?.id === 'extra_match') {
    patch.extraMatches = 1;
  }

  await setDoc(doc(db, 'entitlements', uid), patch, { merge: true });
  await adminSetTransactionStatus(tx.id, 'success');
}

export { PRODUCTS };
