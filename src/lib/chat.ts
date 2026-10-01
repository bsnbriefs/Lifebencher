import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  where
} from 'firebase/firestore';
import { uploadBytes, ref as storageRef } from 'firebase/storage';
import { Message } from '../types';
import { auth, db, storage, handleFirestoreError, OperationType } from './firebase';

export type DisappearingMode = 'off' | '24h' | '7d' | '30d';

async function chatAction(action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const uid = auth.currentUser;
  if (!uid) throw new Error('Not signed in');
  const token = await uid.getIdToken();
  const res = await fetch(`/api/chat/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let payload: Record<string, unknown> = {};
  try { payload = (await res.json()) as Record<string, unknown>; } catch { /* empty */ }
  if (!res.ok) throw new Error(String(payload.error || 'Chat request failed'));
  return payload;
}

export async function getDisappearingMessages(matchId: string): Promise<DisappearingMode> {
  await chatAction('cleanup-expired', { matchId }).catch(() => undefined);
  const result = await chatAction('disappearing', { matchId, method: 'get' });
  const mode = result.duration;
  return mode === '24h' || mode === '7d' || mode === '30d' ? mode : 'off';
}

export async function setDisappearingMessages(matchId: string, duration: DisappearingMode): Promise<void> {
  await chatAction('disappearing', { matchId, duration });
}

export function listenUnreadCount(
  matchId: string,
  uid: string,
  onChange: (count: number) => void
): () => void {
  const q = query(
    collection(db, 'matches', matchId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    const count = snap.docs.reduce((total, d) => {
      const data = d.data() as Record<string, unknown>;
      const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : 0;
      if (expiresAt && expiresAt <= Date.now()) return total;
      return total + (data.senderId !== uid && !data.readAt ? 1 : 0);
    }, 0);
    onChange(count);
  }, () => onChange(0));
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
        .map((d) => ({ d, data: d.data() as Record<string, unknown> }))
        .filter(({ data }) => {
          const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : 0;
          return !expiresAt || expiresAt > now;
        })
        .map(({ d, data }) => {
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
          reactions: data.reactions && typeof data.reactions === 'object' ? (data.reactions as Record<string, string[]>) : undefined,
          starredBy: Array.isArray(data.starredBy) ? data.starredBy.map(String) : undefined,
          editedAt: data.editedAt ? toIso(data.editedAt) : undefined,
          expiresAt: data.expiresAt ? toIso(data.expiresAt) : undefined
        } as Message;
      });
      onChange(messages);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `/matches/${matchId}/messages`)
  );
}

export function listenLatestMessage(
  matchId: string,
  onChange: (preview: { text: string; at: string; senderId: string; messageId: string } | null) => void
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
      const expiresAt = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : 0;
      if (expiresAt && expiresAt <= Date.now()) { onChange(null); return; }
      const kind = String(data.kind || 'text');
      const text = data.viewOnce ? 'View once photo' : kind === 'image' ? 'Photo' : kind === 'audio' ? 'Voice message' : String(data.content || '');
      onChange({
        text,
        at: toIso(data.createdAt),
        senderId: String(data.senderId || ''),
        messageId: d.id
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
  const path = `chatPhotos/${matchId}/${uid}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '')}`;
  await uploadBytes(storageRef(storage, path), file, { contentType: type });
  try {
    await chatAction('send', { matchId, kind: viewOnce ? 'viewOnce' : 'image', content: viewOnce ? 'View once photo' : 'Photo', imagePath: path, viewOnce });
  } catch (error) {
    try { await (await import('firebase/storage')).deleteObject(storageRef(storage, path)); } catch { /* orphan cleanup best effort */ }
    throw error;
  }
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
  try {
    await chatAction('send', { matchId, kind: 'audio', content: 'Voice message', audioPath: path, durationMs: Math.max(1, Math.round(durationMs)) });
  } catch (error) {
    try { await (await import('firebase/storage')).deleteObject(storageRef(storage, path)); } catch { /* orphan cleanup best effort */ }
    throw error;
  }
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


export async function reportUser(targetUserId: string, reason: string, matchId?: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!targetUserId || targetUserId === uid) throw new Error('Invalid report target');
  const reportRef = doc(collection(db, 'reports'));
  await setDoc(reportRef, {
    id: reportRef.id,
    reportType: 'profile',
    reporterId: uid,
    reportedUserId: targetUserId,
    matchId: matchId || '',
    messageId: '',
    reason: reason.trim().slice(0, 500),
    status: 'open',
    createdAt: new Date().toISOString()
  });
}

export async function reportMessage(
  targetUserId: string,
  reason: string,
  matchId: string,
  messageId: string,
  messagePreview?: string
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!targetUserId || targetUserId === uid) throw new Error('Invalid report target');
  if (!matchId || !messageId) throw new Error('Missing message');
  const reportRef = doc(collection(db, 'reports'));
  await setDoc(reportRef, {
    id: reportRef.id,
    reportType: 'message',
    reporterId: uid,
    reportedUserId: targetUserId,
    matchId,
    messageId,
    messagePreview: String(messagePreview || '').slice(0, 240),
    reason: reason.trim().slice(0, 500),
    status: 'open',
    createdAt: new Date().toISOString()
  });
}

export async function blockUser(
  targetUserId: string,
  snapshot?: { displayName?: string; photoUrl?: string }
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!targetUserId || targetUserId === uid) throw new Error('Invalid block target');
  const blockId = `${uid}_${targetUserId}`;
  await setDoc(doc(db, 'blocks', blockId), {
    id: blockId,
    blockerId: uid,
    blockedUserId: targetUserId,
    targetId: targetUserId,
    displayName: String(snapshot?.displayName || '').slice(0, 80),
    photoUrl: String(snapshot?.photoUrl || '').slice(0, 500),
    createdAt: new Date().toISOString()
  });
}

export async function isUserBlocked(targetUserId: string): Promise<boolean> {
  const uid = auth.currentUser?.uid;
  if (!uid || !targetUserId) return false;
  const snap = await getDoc(doc(db, 'blocks', `${uid}_${targetUserId}`));
  if (!snap.exists()) return false;
  const data = snap.data() as Record<string, unknown>;
  return data.blockerId === uid && String(data.blockedUserId || data.targetId || '') === targetUserId;
}

export async function unblockUser(targetUserId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (!targetUserId) throw new Error('Invalid unblock target');
  await deleteDoc(doc(db, 'blocks', `${uid}_${targetUserId}`));
}

export async function listBlockedUserIds(): Promise<string[]> {
  const rows = await listBlockedProfiles();
  return rows.map((row) => row.userId);
}

export type BlockedProfilePreview = {
  userId: string;
  displayName: string;
  photoUrl: string;
};

export async function listBlockedProfiles(): Promise<BlockedProfilePreview[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const snap = await getDocs(query(collection(db, 'blocks'), where('blockerId', '==', uid)));
  const rows: BlockedProfilePreview[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const userId = String(data.blockedUserId || data.targetId || '');
    if (!userId) continue;
    let displayName = String(data.displayName || '').trim();
    let photoUrl = String(data.photoUrl || '').trim();
    if (!displayName || !photoUrl) {
      try {
        const profileSnap = await getDoc(doc(db, 'profiles', userId));
        if (profileSnap.exists()) {
          const pd = profileSnap.data() as Record<string, unknown>;
          if (!displayName) displayName = String(pd.displayName || '').trim();
          const photos = Array.isArray(pd.photos) ? pd.photos.map(String) : [];
          const urls = Array.isArray(pd.photoUrls) ? pd.photoUrls.map(String) : [];
          if (!photoUrl) photoUrl = String(pd.photoUrl || photos[0] || urls[0] || '');
        }
      } catch {
        // Hidden/unreadable profiles still stay identifiable via the block snapshot.
      }
    }
    rows.push({
      userId,
      displayName: displayName || 'Blocked member',
      photoUrl
    });
  }
  return rows;
}

export async function sendMatchMessage(matchId: string, content: string, replyTo?: { id: string; preview: string }): Promise<void> {
  const text = content.trim();
  if (!text) return;
  if (text.length > 2000) throw new Error('Message is too long');
  await chatAction('send', {
    matchId, kind: 'text', content: text.slice(0, 2000),
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
