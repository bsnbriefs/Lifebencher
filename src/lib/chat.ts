import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { Message } from '../types';
import { auth, db, storage, handleFirestoreError, OperationType } from './firebase';

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function listenMatchMessages(
  matchId: string,
  onChange: (messages: Message[]) => void
): () => void {
  const q = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const messages: Message[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          conversationId: matchId,
          senderId: String(data.senderId || ''),
          content: String(data.content || ''),
          createdAt: toIso(data.createdAt),
          readAt: data.readAt ? toIso(data.readAt) : undefined,
          kind: (data.kind as Message['kind']) || 'text',
          imagePath: data.imagePath ? String(data.imagePath) : undefined,
          imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
          viewOnce: Boolean(data.viewOnce),
          viewedAt: data.viewedAt ? toIso(data.viewedAt) : undefined
        };
      });
      onChange(messages);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `/matches/${matchId}/messages`)
  );
}

export function listenLatestMessage(
  matchId: string,
  onChange: (preview: { text: string; at: string } | null) => void
): () => void {
  const q = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => {
      const d = snap.docs[0];
      if (!d) {
        onChange(null);
        return;
      }
      const data = d.data() as Record<string, unknown>;
      onChange({
        text: String(data.content || ''),
        at: toIso(data.createdAt)
      });
    },
    () => onChange(null)
  );
}

export async function sendMatchImage(matchId: string, file: File, viewOnce: boolean): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    throw new Error('Use a JPG, PNG or WebP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB');
  const path = `chatPhotos/${matchId}/${uid}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '')}`;
  await uploadBytes(storageRef(storage, path), file, { contentType: type });
  const imageUrl = viewOnce ? '' : await getDownloadURL(storageRef(storage, path));
  const col = collection(db, 'matches', matchId, 'messages');
  const msgRef = doc(col);
  await setDoc(msgRef, {
    id: msgRef.id,
    matchId,
    senderId: uid,
    content: viewOnce ? 'View once photo' : 'Photo',
    createdAt: new Date().toISOString(),
    kind: viewOnce ? 'viewOnce' : 'image',
    imagePath: path,
    ...(imageUrl ? { imageUrl } : {}),
    viewOnce
  });
}

export async function sendMatchMessage(matchId: string, content: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const text = content.trim();
  if (!text) return;
  if (text.length > 2000) throw new Error('Message is too long');

  const col = collection(db, 'matches', matchId, 'messages');
  const ref = doc(col);
  try {
    await setDoc(ref, {
      id: ref.id,
      matchId,
      senderId: uid,
      content: text.slice(0, 2000),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `/matches/${matchId}/messages`);
  }
}
