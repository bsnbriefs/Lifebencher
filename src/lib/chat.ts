import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  runTransaction,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { uploadBytes, ref as storageRef } from 'firebase/storage';
import { Message } from '../types';
import { auth, db, storage, handleFirestoreError, OperationType } from './firebase';

export type DisappearingMode = 'off' | '24h' | '7d' | '30d';

async function chatAction(action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not signed in');
  const token = await currentUser.getIdToken();
  const res = await fetch(`/api/chat/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let data: Record<string, unknown> = {};
  try { data = (await res.json()) as Record<string, unknown>; } catch { /* leave empty */ }
  if (!res.ok) throw new Error(String(data.error || 'Chat request failed'));
  return data;
}

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
      const now = Date.now();
      const messages: Message[] = snap.docs
        .filter((d) => {
          const expiresAt = toIso((d.data() as Record<string, unknown>).expiresAt);
          return !expiresAt || Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) > now;
        })
        .map((d) => {
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
          viewedAt: data.viewedAt ? toIso(data.viewedAt) : undefined,
          audioPath: data.audioPath ? String(data.audioPath) : undefined,
          audioUrl: data.audioUrl ? String(data.audioUrl) : undefined,
          durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
          replyToId: data.replyToId ? String(data.replyToId) : undefined,
          replyToPreview: data.replyToPreview ? String(data.replyToPreview) : undefined,
          reactions: data.reactions && typeof data.reactions === 'object' ? (data.reactions as Record<string, string[]>) : undefined
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
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Use a JPG, PNG or WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB');
  const safeName = file.name.replace(/[^\w.-]+/g, '') || 'photo';
  const path = `chatPhotos/${matchId}/${uid}/${Date.now()}-${safeName}`;
  await uploadBytes(storageRef(storage, path), file, { contentType: type });
  await chatAction('send', {
    matchId,
    kind: viewOnce ? 'viewOnce' : 'image',
    content: viewOnce ? 'View once photo' : 'Photo',
    imagePath: path,
    viewOnce
  });
}

export async function resolveChatMediaUrl(matchId: string, path: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!path) throw new Error('Missing media path');

  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/api/chat/media', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ matchId, path })
  });

  let body: { url?: string; error?: string } = {};
  try {
    body = (await res.json()) as { url?: string; error?: string };
  } catch {
    /* leave body empty */
  }

  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Unable to load chat media. Tap to retry.');
  }
  return body.url;
}

export async function markMatchMessagesRead(matchId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const q = query(collection(db, 'matches', matchId, 'messages'), orderBy('createdAt', 'desc'), limit(40));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((d) => {
        const data = d.data();
        if (data.senderId === uid || data.readAt) return Promise.resolve();
        return updateDoc(d.ref, { readAt: new Date().toISOString() }).catch(() => undefined);
      })
    );
  } catch {
    // Read receipts are best-effort. Never surface a Firestore permission error in the chat UI.
  }
}

export function pickRecorderMime(): string {
  const types = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export async function sendMatchAudio(matchId: string, blob: Blob, durationMs: number): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (blob.size > 8 * 1024 * 1024) throw new Error('Voice note is too large.');
  const type = blob.type || 'audio/mp4';
  const ext = type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('mpeg') ? 'mp3' : 'webm';
  const path = `chatAudio/${matchId}/${uid}/${Date.now()}.${ext}`;
  await uploadBytes(storageRef(storage, path), blob, { contentType: type.split(';')[0] });
  await chatAction('send', {
    matchId,
    kind: 'audio',
    content: 'Voice message',
    audioPath: path,
    durationMs: Math.max(1, Math.round(durationMs))
  });
}

export async function unsendMatchMessage(matchId: string, messageId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!messageId) throw new Error('Missing message');

  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/api/chat/delete-message', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ matchId, messageId })
  });

  let body: { error?: string } = {};
  try {
    body = (await res.json()) as { error?: string };
  } catch {
    /* leave body empty */
  }

  if (!res.ok) {
    throw new Error(body.error || 'Unable to delete this message.');
  }
}

export async function sendMatchMessage(matchId: string, content: string, replyTo?: { id: string; preview: string }): Promise<void> {
  const text = content.trim();
  if (!text) return;
  if (text.length > 2000) throw new Error('Message is too long');
  await chatAction('send', {
    matchId,
    kind: 'text',
    content: text.slice(0, 2000),
    ...(replyTo ? { replyToId: replyTo.id, replyToPreview: replyTo.preview.slice(0, 240) } : {})
  });
}


export async function editMatchMessage(matchId: string, messageId: string, content: string): Promise<void> {
  const text = content.trim();
  if (!messageId) throw new Error('Missing message');
  if (!text) throw new Error('Message cannot be empty');
  if (text.length > 2000) throw new Error('Message is too long');
  await chatAction('edit', { matchId, messageId, content: text });
}

export async function cleanupExpiredMessages(matchId: string): Promise<void> {
  await chatAction('cleanup-expired', { matchId });
}

export async function getDisappearingMessages(matchId: string): Promise<DisappearingMode> {
  await cleanupExpiredMessages(matchId).catch(() => undefined);
  const data = await chatAction('disappearing', { matchId, method: 'get' });
  const duration = String(data.duration || 'off') as DisappearingMode;
  return ['off', '24h', '7d', '30d'].includes(duration) ? duration : 'off';
}

export async function setDisappearingMessages(matchId: string, duration: DisappearingMode): Promise<void> {
  await chatAction('disappearing', { matchId, duration });
}

export async function toggleMessageReaction(matchId: string, messageId: string, emoji: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const cleanEmoji = emoji.trim();
  if (!cleanEmoji || cleanEmoji.length > 16) throw new Error('Invalid reaction');

  const ref = doc(db, 'matches', matchId, 'messages', messageId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Message not found');
    const data = snap.data() as Record<string, unknown>;
    const current = data.reactions && typeof data.reactions === 'object'
      ? { ...(data.reactions as Record<string, unknown>) }
      : {};
    const users = Array.isArray(current[cleanEmoji]) ? (current[cleanEmoji] as unknown[]).map(String) : [];
    const nextUsers = users.includes(uid) ? users.filter((id) => id !== uid) : [...users, uid];
    if (nextUsers.length) current[cleanEmoji] = nextUsers;
    else delete current[cleanEmoji];
    tx.update(ref, { reactions: current });
  });
}

export async function toggleMessageStar(matchId: string, messageId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const ref = doc(db, 'matches', matchId, 'messages', messageId);
  let starred = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Message not found');
    const data = snap.data() as Record<string, unknown>;
    const users = Array.isArray(data.starredBy) ? data.starredBy.map(String) : [];
    starred = !users.includes(uid);
    tx.update(ref, { starredBy: starred ? arrayUnion(uid) : arrayRemove(uid) });
  });
  return starred;
}

export async function setChatPresence(matchId: string, uid: string, online: boolean): Promise<void> {
  if (!matchId || !uid) return;
  await setDoc(doc(db, 'matches', matchId, 'presence', uid), {
    uid,
    online,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export function listenChatPresence(
  matchId: string,
  uid: string,
  onChange: (online: boolean) => void
): () => void {
  return onSnapshot(
    doc(db, 'matches', matchId, 'presence', uid),
    (snap) => onChange(Boolean(snap.exists() && snap.data().online === true)),
    () => onChange(false)
  );
}

export async function setChatTyping(matchId: string, uid: string, typing: boolean): Promise<void> {
  if (!matchId || !uid) return;
  await setDoc(doc(db, 'matches', matchId, 'typing', uid), {
    uid,
    typing,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export function listenChatTyping(
  matchId: string,
  uid: string,
  onChange: (typing: boolean) => void
): () => void {
  return onSnapshot(
    doc(db, 'matches', matchId, 'typing', uid),
    (snap) => {
      if (!snap.exists()) return onChange(false);
      const data = snap.data() as Record<string, unknown>;
      const updatedAt = typeof data.updatedAt === 'string' ? Date.parse(data.updatedAt) : 0;
      const fresh = updatedAt > 0 && Date.now() - updatedAt < 5000;
      onChange(Boolean(data.typing === true && fresh));
    },
    () => onChange(false)
  );
}
