import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

export interface ReviewItem {
  id: string;
  type: string;
  userId?: string;
  targetId?: string;
  reason?: string;
  evidence?: string;
  confidence?: number;
  recommendedAction?: string;
  status: string;
  createdAt: string;
}

export function listenReviewQueue(onChange: (rows: ReviewItem[]) => void): () => void {
  return onSnapshot(
    collection(db, 'reviewQueue'),
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReviewItem, 'id'>) }));
      onChange(rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    },
    () => onChange([])
  );
}

export async function closeReviewItem(id: string): Promise<void> {
  await updateDoc(doc(db, 'reviewQueue', id), { status: 'closed' });
}
