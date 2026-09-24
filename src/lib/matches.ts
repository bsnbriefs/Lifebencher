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
import { Match, Profile } from '../types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const DEFAULT_MATCH_DAYS = 7;

export function matchIdFor(userA: string, userB: string): string {
  const [a, b] = [userA, userB].sort();
  return `m_${a}_${b}`;
}

function mapMatch(id: string, data: Record<string, unknown>, otherProfile?: Profile): Match {
  return {
    id,
    user1Id: String(data.user1Id || ''),
    user2Id: String(data.user2Id || ''),
    otherProfile,
    status: (data.status as Match['status']) || 'active',
    startedAt: String(data.startedAt || new Date().toISOString()),
    expiresAt: String(data.expiresAt || new Date().toISOString()),
    endedAt: data.endedAt ? String(data.endedAt) : undefined,
    extendedCount: typeof data.extendedCount === 'number' ? data.extendedCount : 0
  };
}

export function mapProfileDoc(profileId: string, d: Record<string, unknown>, photo?: string): Profile {
  const stored = typeof d.photoUrl === 'string' ? d.photoUrl : '';
  const resolved = stored || photo || '';
  return {
    id: String(d.id || profileId),
    userId: String(d.userId || profileId),
    displayName: String(d.displayName || 'Member'),
    age: typeof d.age === 'number' ? d.age : 28,
    gender: (d.gender as Profile['gender']) || 'other',
    location: String(d.location || ''),
    profession: String(d.profession || ''),
    education: String(d.education || ''),
    bio: String(d.bio || ''),
    photos: resolved ? [resolved] : [],
    interests: [],
    values: [],
    relationshipGoal: String(d.relationshipGoal || ''),
    lifestyle: {},
    isVerified: Boolean(d.isVerified),
    isVisible: d.isVisible !== false,
    createdAt: String(d.createdAt || ''),
    updatedAt: String(d.updatedAt || '')
  };
}

export async function fetchProfileSafe(profileId: string): Promise<Profile | undefined> {
  try {
    const snap = await getDoc(doc(db, 'profiles', profileId));
    if (!snap.exists()) return undefined;
    const d = snap.data() as Record<string, unknown>;
    const { fetchProfilePhotoUrl } = await import('./profilePhoto');
    const stored = typeof d.photoUrl === 'string' ? d.photoUrl : '';
    const photo = stored || (await fetchProfilePhotoUrl(profileId)) || undefined;
    return mapProfileDoc(profileId, d, photo);
  } catch {
    return undefined;
  }
}

export function listenVisibleProfiles(
  currentUid: string,
  onChange: (profiles: Profile[]) => void
): () => void {
  const q = query(collection(db, 'profiles'), where('isVisible', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const mapped = snap.docs
        .filter((d) => d.id !== currentUid)
        .map((d) => mapProfileDoc(d.id, d.data() as Record<string, unknown>));
      onChange(mapped);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, '/profiles')
  );
}

export function listenUserMatches(
  uid: string,
  onChange: (matches: Match[]) => void
): () => void {
  const q1 = query(collection(db, 'matches'), where('user1Id', '==', uid));
  const q2 = query(collection(db, 'matches'), where('user2Id', '==', uid));

  let a: Match[] = [];
  let b: Match[] = [];

  const publish = async () => {
    const merged = new Map<string, Match>();
    [...a, ...b].forEach((m) => merged.set(m.id, m));
    const list = Array.from(merged.values()).filter((m) => m.status !== 'ended');
    const withProfiles = await Promise.all(
      list.map(async (m) => {
        const otherId = m.user1Id === uid ? m.user2Id : m.user1Id;
        const otherProfile = await fetchProfileSafe(otherId);
        return { ...m, otherProfile };
      })
    );
    onChange(withProfiles.sort((x, y) => y.startedAt.localeCompare(x.startedAt)));
  };

  const unsub1 = onSnapshot(
    q1,
    (snap) => {
      a = snap.docs.map((d) => mapMatch(d.id, d.data() as Record<string, unknown>));
      void publish();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, '/matches')
  );

  const unsub2 = onSnapshot(
    q2,
    (snap) => {
      b = snap.docs.map((d) => mapMatch(d.id, d.data() as Record<string, unknown>));
      void publish();
    },
    (error) => handleFirestoreError(error, OperationType.LIST, '/matches')
  );

  return () => {
    unsub1();
    unsub2();
  };
}

export async function createOrGetMatch(otherUserId: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (uid === otherUserId) throw new Error('Cannot match with yourself');

  const id = matchIdFor(uid, otherUserId);
  const ref = doc(db, 'matches', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return id;
  }

  const now = new Date().toISOString();
  const payload = {
    id,
    user1Id: uid,
    user2Id: otherUserId,
    status: 'active',
    startedAt: now,
    expiresAt: new Date(Date.now() + DEFAULT_MATCH_DAYS * 86400000).toISOString(),
    extendedCount: 0
  };

  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `/matches/${id}`);
  }
  return id;
}

export async function endMatch(matchId: string, current: Match): Promise<void> {
  try {
    await updateDoc(doc(db, 'matches', matchId), {
      id: current.id,
      user1Id: current.user1Id,
      user2Id: current.user2Id,
      status: 'ended',
      startedAt: current.startedAt,
      expiresAt: current.expiresAt,
      endedAt: new Date().toISOString(),
      extendedCount: current.extendedCount
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `/matches/${matchId}`);
  }
}

export async function extendMatch(matchId: string, current: Match, days: number): Promise<void> {
  const currentExp = new Date(current.expiresAt).getTime();
  const baseTime = currentExp > Date.now() ? currentExp : Date.now();
  const newExpiresAt = new Date(baseTime + days * 86400000).toISOString();
  try {
    await updateDoc(doc(db, 'matches', matchId), {
      id: current.id,
      user1Id: current.user1Id,
      user2Id: current.user2Id,
      status: current.status === 'expired' ? 'active' : current.status,
      startedAt: current.startedAt,
      expiresAt: newExpiresAt,
      extendedCount: current.extendedCount + 1,
      ...(current.endedAt ? { endedAt: current.endedAt } : {})
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `/matches/${matchId}`);
  }
}
