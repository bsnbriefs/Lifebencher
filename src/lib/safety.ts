import { addDoc, collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase';

export function blockIdFor(a: string, b: string): string {
  return `b_${[a, b].sort().join('_')}`;
}

export async function reportUser(targetId: string, reason: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await addDoc(collection(db, 'reports'), {
    reporterId: uid,
    targetId,
    reason: reason.slice(0, 400),
    createdAt: new Date().toISOString(),
    status: 'open'
  });
}

export async function blockUser(targetId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (uid === targetId) throw new Error('Cannot block yourself');
  await setDoc(doc(db, 'blocks', `${uid}_${targetId}`), {
    blockerId: uid,
    targetId,
    createdAt: new Date().toISOString()
  });
}

export function listenBlockedIds(uid: string, onChange: (ids: string[]) => void): () => void {
  const q = query(collection(db, 'blocks'), where('blockerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => String((d.data() as { targetId?: string }).targetId || ''))),
    () => onChange([])
  );
}
