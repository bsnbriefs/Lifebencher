import {
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type CallType = 'voice' | 'video';
export type CallStatus = 'initiating' | 'ringing' | 'accepted' | 'connecting' | 'declined' | 'cancelled' | 'missed' | 'ended' | 'failed';

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
    status: 'initiating',
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

export async function ackRinging(matchId: string) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'ringing',
    deliveredAt: new Date().toISOString()
  });
}

export async function cancelCall(matchId: string) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'cancelled'
  }).catch(() => undefined);
}

export async function declineCall(matchId: string) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'declined'
  }).catch(() => undefined);
}

export async function markMissed(matchId: string) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'missed'
  }).catch(() => undefined);
}

export function iceConfig(): RTCConfiguration {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined
    });
  }
  return { iceServers: servers };
}

export async function endCall(matchId: string) {
  await updateDoc(doc(db, 'matches', matchId, 'signaling', 'current'), {
    status: 'ended',
    offer: deleteField(),
    answer: deleteField()
  }).catch(() => undefined);
}
