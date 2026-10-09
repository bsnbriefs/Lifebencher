import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type SupportStatus = 'waiting' | 'active' | 'closed';

export interface SupportConversation {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  status: SupportStatus;
  assignedAdminId: string | null;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderType: 'user' | 'admin' | 'ai';
  content: string;
  createdAt?: string;
}

export const SUPPORT_TEMPLATES = [
  'Hello, we reviewed your Lifebencher profile and have a few suggestions. Please update your details and photos. We are happy to help.',
  'Please add clearer recent photos of yourself so we can review your profile.',
  'Your onboarding is not finished yet. Complete the required fields and upload at least two photos.',
  'We are reviewing your payment evidence. Please reply if you have another receipt.',
  'Lifebencher Support is here if you need help with your account.'
];

export async function createSupportConversation(preview?: string): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'supportConversations'), {
    userId: u.uid,
    userEmail: u.email || '',
    userName: u.displayName || '',
    status: 'waiting',
    assignedAdminId: null,
    lastMessage: preview || '',
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now
  });
  return ref.id;
}

export async function openSupportWithClient(userId: string, userName = '', userEmail = ''): Promise<string> {
  const adminId = auth.currentUser?.uid;
  if (!adminId) throw new Error('Not signed in');
  const snap = await getDocs(query(collection(db, 'supportConversations'), where('userId', '==', userId)));
  const existing = snap.docs.find((d) => d.data().status !== 'closed') || snap.docs[0];
  if (existing) return existing.id;
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'supportConversations'), {
    userId,
    userEmail,
    userName,
    status: 'active',
    assignedAdminId: adminId,
    lastMessage: '',
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now
  });
  return ref.id;
}

export async function addSupportMessage(conversationId: string, senderType: 'user' | 'admin', content: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const now = new Date().toISOString();
  await addDoc(collection(db, 'supportConversations', conversationId, 'messages'), {
    senderId: uid,
    senderType,
    content: content.slice(0, 2000),
    createdAt: now
  });
  await updateDoc(doc(db, 'supportConversations', conversationId), {
    lastMessage: content.slice(0, 140),
    lastMessageAt: now,
    updatedAt: now,
    status: senderType === 'admin' ? 'active' : 'waiting'
  });
  if (senderType === 'admin') {
    const snap = await getDoc(doc(db, 'supportConversations', conversationId));
    const clientId = String(snap.data()?.userId || '');
    if (clientId) {
      await setDoc(doc(db, 'notifications', `support-${conversationId}`), {
        userId: clientId,
        title: 'Lifebencher Support',
        body: 'Lifebencher Support sent you a message.',
        href: 'messages',
        read: false,
        createdAt: now
      });
    }
  }
}

export function listenMyConversations(uid: string, onChange: (rows: SupportConversation[]) => void): () => void {
  const q = query(collection(db, 'supportConversations'), where('userId', '==', uid));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportConversation, 'id'>) })).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))));
  });
}

export function listenSupportMessages(conversationId: string, onChange: (rows: SupportMessage[]) => void): () => void {
  const q = query(collection(db, 'supportConversations', conversationId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportMessage, 'id'>) }))));
}

export function listenSupportInbox(onChange: (rows: SupportConversation[]) => void): () => void {
  return onSnapshot(collection(db, 'supportConversations'), (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportConversation, 'id'>) })).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))));
  });
}

export async function adminSetSupportStatus(id: string, status: SupportStatus, assignedAdminId?: string | null): Promise<void> {
  await updateDoc(doc(db, 'supportConversations', id), {
    status,
    ...(assignedAdminId !== undefined ? { assignedAdminId } : {}),
    updatedAt: new Date().toISOString()
  });
}

export async function userCloseConversation(id: string): Promise<void> {
  await updateDoc(doc(db, 'supportConversations', id), { status: 'closed', updatedAt: new Date().toISOString() });
}
