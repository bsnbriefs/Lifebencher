import {
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'ended';

export interface CallState {
  matchId: string;
  callerId: string;
  calleeId: string;
  type: CallType;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit | null;
  answer?: RTCSessionDescriptionInit | null;
  callerIce?: RTCIceCandidateInit[];
  calleeIce?: RTCIceCandidateInit[];
}

export function listenCall(matchId: string, onChange: (call: CallState | null) => void): () => void {
  return onSnapshot(doc(db, 'matches', matchId, 'signaling', 'current'), (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange(snap.data() as CallState);
  });
}

export async function startCall(matchId: string, calleeId: string, type: CallType, offer: RTCSessionDescriptionInit) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  await setDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    matchId,
    callerId: uid,
    calleeId,
    type,
    status: 'ringing',
    offer,
    answer: null,
    callerIce: [],
    calleeIce: []
  });
}

export async function acceptCall(matchId: string, answer: RTCSessionDescriptionInit) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'accepted',
    answer
  });
}

export async function addIce(matchId: string, role: 'caller' | 'callee', candidate: RTCIceCandidateInit) {
  const { arrayUnion } = await import('firebase/firestore');
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    [role === 'caller' ? 'callerIce' : 'calleeIce']: arrayUnion(candidate)
  });
}

export async function endCall(matchId: string) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'ended',
    offer: deleteField(),
    answer: deleteField()
  }).catch(() => undefined);
}
