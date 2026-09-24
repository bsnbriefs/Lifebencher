import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { ContactExchangeRequest, ContactExchangeStatus } from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export function contactDocRef(matchId: string) {
  return doc(db, 'matches', matchId, 'contact', 'state');
}

export function contactSecretRef(matchId: string, uid: string) {
  return doc(db, 'matches', matchId, 'contactSecrets', uid);
}

function emptyState(matchId: string, user1Id: string, user2Id: string): ContactExchangeRequest {
  return {
    id: 'state',
    matchId,
    initiatorId: '',
    user1Id,
    user2Id,
    user1Consented: false,
    user2Consented: false,
    status: 'pending'
  };
}

export function mapContactState(
  matchId: string,
  user1Id: string,
  user2Id: string,
  data?: Record<string, unknown>,
  otherContact?: ContactExchangeRequest['user1Contact']
): ContactExchangeRequest {
  if (!data) return emptyState(matchId, user1Id, user2Id);
  const uid = auth.currentUser?.uid;
  const state: ContactExchangeRequest = {
    id: 'state',
    matchId,
    initiatorId: String(data.initiatorId || ''),
    user1Id: String(data.user1Id || user1Id),
    user2Id: String(data.user2Id || user2Id),
    user1Consented: Boolean(data.user1Consented),
    user2Consented: Boolean(data.user2Consented),
    status: (data.status as ContactExchangeStatus) || 'pending',
    consentedAt: data.consentedAt ? String(data.consentedAt) : undefined
  };
  const complete = state.status === 'completed' && state.user1Consented && state.user2Consented;
  if (complete && otherContact && uid) {
    if (uid === state.user1Id) state.user2Contact = otherContact;
    else state.user1Contact = otherContact;
  }
  return state;
}

export function listenContactExchange(
  matchId: string,
  user1Id: string,
  user2Id: string,
  onChange: (state: ContactExchangeRequest) => void
): () => void {
  let latest: ContactExchangeRequest = emptyState(matchId, user1Id, user2Id);
  let otherContact: ContactExchangeRequest['user1Contact'] | undefined;
  let unsubSecret: (() => void) | undefined;

  const publish = () => onChange({ ...latest, ...(otherContact ? mapContactState(matchId, user1Id, user2Id, {
    initiatorId: latest.initiatorId,
    user1Id: latest.user1Id,
    user2Id: latest.user2Id,
    user1Consented: latest.user1Consented,
    user2Consented: latest.user2Consented,
    status: latest.status,
    consentedAt: latest.consentedAt
  }, otherContact) : latest) });

  const attachSecretIfNeeded = () => {
    unsubSecret?.();
    unsubSecret = undefined;
    otherContact = undefined;
    const uid = auth.currentUser?.uid;
    const complete = latest.status === 'completed' && latest.user1Consented && latest.user2Consented;
    if (!complete || !uid) {
      publish();
      return;
    }
    const otherId = uid === latest.user1Id ? latest.user2Id : latest.user1Id;
    unsubSecret = onSnapshot(
      contactSecretRef(matchId, otherId),
      (snap) => {
        const d = snap.data() as Record<string, unknown> | undefined;
        otherContact = d
          ? { phone: String(d.phone || ''), email: String(d.email || ''), whatsapp: d.whatsapp ? String(d.whatsapp) : undefined }
          : undefined;
        latest = mapContactState(matchId, user1Id, user2Id, {
          initiatorId: latest.initiatorId,
          user1Id: latest.user1Id,
          user2Id: latest.user2Id,
          user1Consented: latest.user1Consented,
          user2Consented: latest.user2Consented,
          status: latest.status,
          consentedAt: latest.consentedAt
        }, otherContact);
        onChange(latest);
      },
      () => {
        otherContact = undefined;
        onChange(latest);
      }
    );
  };

  const unsubState = onSnapshot(
    contactDocRef(matchId),
    (snap) => {
      latest = mapContactState(matchId, user1Id, user2Id, snap.data() as Record<string, unknown> | undefined);
      attachSecretIfNeeded();
    },
    (error) => handleFirestoreError(error, OperationType.GET, `/matches/${matchId}/contact/state`)
  );

  return () => {
    unsubState();
    unsubSecret?.();
  };
}

export async function requestOrApproveContact(opts: {
  matchId: string;
  user1Id: string;
  user2Id: string;
  myContact: { phone: string; email: string; whatsapp?: string };
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const { matchId, user1Id, user2Id, myContact } = opts;
  const isUser1 = uid === user1Id;
  const now = new Date().toISOString();

  try {
    await setDoc(contactSecretRef(matchId, uid), {
      phone: (myContact.phone || '').slice(0, 32),
      email: (myContact.email || '').slice(0, 254),
      ...(myContact.whatsapp ? { whatsapp: myContact.whatsapp.slice(0, 32) } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `/matches/${matchId}/contactSecrets/${uid}`);
  }

  const ref = contactDocRef(matchId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        id: 'state',
        matchId,
        initiatorId: uid,
        user1Id,
        user2Id,
        user1Consented: isUser1,
        user2Consented: !isUser1,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `/matches/${matchId}/contact/state`);
    }
    return;
  }

  const data = snap.data() as Record<string, unknown>;
  const user1Consented = isUser1 ? true : Boolean(data.user1Consented);
  const user2Consented = !isUser1 ? true : Boolean(data.user2Consented);
  const both = user1Consented && user2Consented;
  try {
    await updateDoc(ref, {
      id: 'state',
      matchId,
      initiatorId: String(data.initiatorId || uid),
      user1Id,
      user2Id,
      user1Consented,
      user2Consented,
      status: both ? 'completed' : 'pending',
      updatedAt: now,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      ...(both ? { consentedAt: now } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `/matches/${matchId}/contact/state`);
  }
}

export async function declineContactExchange(opts: {
  matchId: string;
  user1Id: string;
  user2Id: string;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const ref = contactDocRef(opts.matchId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Record<string, unknown>;
  try {
    await updateDoc(ref, {
      id: 'state',
      matchId: opts.matchId,
      initiatorId: String(data.initiatorId || ''),
      user1Id: opts.user1Id,
      user2Id: opts.user2Id,
      user1Consented: Boolean(data.user1Consented),
      user2Consented: Boolean(data.user2Consented),
      status: 'declined',
      updatedAt: new Date().toISOString(),
      ...(data.createdAt ? { createdAt: data.createdAt } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `/matches/${opts.matchId}/contact/state`);
  }
}

export function exchangeUiState(
  state: ContactExchangeRequest | null,
  myId: string
): 'none' | 'pending_me' | 'pending_them' | 'unlocked' | 'declined' {
  if (!state || (!state.user1Consented && !state.user2Consented && state.status !== 'declined')) {
    return 'none';
  }
  if (state.status === 'declined') return 'declined';
  if (state.status === 'completed' && state.user1Consented && state.user2Consented) return 'unlocked';
  const iAmUser1 = myId === state.user1Id;
  const mine = iAmUser1 ? state.user1Consented : state.user2Consented;
  const theirs = iAmUser1 ? state.user2Consented : state.user1Consented;
  if (mine && !theirs) return 'pending_me';
  if (!mine && theirs) return 'pending_them';
  return 'none';
}
