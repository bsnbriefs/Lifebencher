import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { MatchRequest, MatchRequestStatus, Profile } from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { createOrGetMatch, fetchProfileSafe } from './matches';

export function interestIdFor(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `r_${a}_${b}`;
}

function mapRequest(id: string, data: Record<string, unknown>, senderProfile?: Profile): MatchRequest {
  const status = (data.status as MatchRequestStatus) || 'pending';
  return {
    id,
    senderId: String(data.senderId || ''),
    receiverId: String(data.receiverId || ''),
    senderProfile,
    status,
    createdAt: String(data.createdAt || new Date().toISOString()),
    updatedAt: String(data.updatedAt || new Date().toISOString())
  };
}

export function listenIncomingInterests(
  uid: string,
  onChange: (requests: MatchRequest[]) => void
): () => void {
  const q = query(collection(db, 'matchRequests'), where('receiverId', '==', uid));
  return onSnapshot(
    q,
    async (snap) => {
      const pending = snap.docs
        .map((d) => mapRequest(d.id, d.data() as Record<string, unknown>))
        .filter((r) => r.status === 'pending');
      const withProfiles = await Promise.all(
        pending.map(async (r) => ({
          ...r,
          senderProfile: await fetchProfileSafe(r.senderId)
        }))
      );
      onChange(withProfiles.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, '/matchRequests')
  );
}

export function listenOutgoingInterestIds(
  uid: string,
  onChange: (receiverIds: string[]) => void
): () => void {
  const q = query(collection(db, 'matchRequests'), where('senderId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const ids = snap.docs
        .map((d) => d.data() as Record<string, unknown>)
        .filter((d) => d.status === 'pending' || d.status === 'matched')
        .map((d) => String(d.receiverId || ''));
      onChange(ids.filter(Boolean));
    },
    () => onChange([])
  );
}

export async function sendInterest(otherUserId: string): Promise<'sent' | 'matched'> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (uid === otherUserId) throw new Error('Cannot send interest to yourself');

  const id = interestIdFor(uid, otherUserId);
  const ref = doc(db, 'matchRequests', id);
  const now = new Date().toISOString();

  let existing: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    existing = await getDoc(ref);
  } catch {
    existing = null;
  }

  if (existing?.exists()) {
    const data = existing.data() as Record<string, unknown>;
    const status = String(data.status || 'pending');
    if (status === 'matched') return 'matched';
    if (status === 'declined') {
      throw new Error('This interest was previously declined.');
    }
    if (data.senderId === otherUserId && data.receiverId === uid && status === 'pending') {
      await acceptInterest(id, otherUserId);
      return 'matched';
    }
    if (data.senderId === uid) return 'sent';
    return 'sent';
  }

  const payload = {
    id,
    senderId: uid,
    receiverId: otherUserId,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };

  try {
    await setDoc(ref, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('permission') || message.includes('Permission')) {
      throw new Error('Could not send interest. Update Firestore rules to allow matchRequests, then try again.');
    }
    throw new Error(message);
  }
  return 'sent';
}

export async function acceptInterest(requestId: string, senderId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');

  const matchId = await createOrGetMatch(senderId);

  try {
    await updateDoc(doc(db, 'matchRequests', requestId), {
      status: 'matched',
      updatedAt: new Date().toISOString()
    });
  } catch {
    /* match is already open */
  }

  return matchId;
}

export async function declineInterest(requestId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  try {
    await updateDoc(doc(db, 'matchRequests', requestId), {
      status: 'declined',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `/matchRequests/${requestId}`);
  }
}
