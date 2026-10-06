import { collection, doc, limit, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: 'discover' | 'messages' | 'matches';
  read: boolean;
  createdAt: string;
};

export function listenNotifications(uid: string, onChange: (items: AppNotification[]) => void): () => void {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(30));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        userId: String(data.userId || uid),
        title: String(data.title || 'Update'),
        body: String(data.body || ''),
        href: data.href === 'messages' || data.href === 'matches' ? data.href : 'discover',
        read: data.read === true,
        createdAt: String(data.createdAt || '')
      } as AppNotification;
    });
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    onChange(items);
  }, () => onChange([]));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read: true });
}
