import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  limit,
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

export function pickProfileName(d: Record<string, unknown>, fallback = ''): string {
  const candidates = [
    d.displayName,
    d.name,
    d.fullName,
    d.firstName,
    d.surname
  ].map((v) => String(v ?? '').trim());

  const real = candidates.find(
    (s) => s && !['member', 'profile'].includes(s.toLowerCase())
  );
  return real || fallback;
}

export function mapProfileDoc(profileId: string, d: Record<string, unknown>, photo?: string): Profile {
  const stored = typeof d.photoUrl === 'string' ? d.photoUrl : '';
  const resolved = stored || photo || '';
  return {
    id: String(d.id || profileId),
    userId: String(d.userId || profileId),
    displayName: pickProfileName(d, ''),
    age: typeof d.age === 'number' ? d.age : 28,
    gender: (d.gender as Profile['gender']) || 'other',
    location: String(d.location || ''),
    profession: String(d.profession || ''),
    education: String(d.education || ''),
    bio: String(d.bio || ''),
    photos: Array.isArray(d.photoUrls) && d.photoUrls.length ? (d.photoUrls as string[]) : resolved ? [resolved] : [],
    interests: Array.isArray(d.interests) ? (d.interests as string[]) : [],
    values: Array.isArray(d.values) ? (d.values as string[]) : [],
    relationshipGoal: String(d.relationshipGoal || ''),
    lifestyle: d.lifestyle && typeof d.lifestyle === 'object' ? (d.lifestyle as Profile['lifestyle']) : {},
    isVerified: Boolean(d.isVerified),
    isVisible: d.isVisible === true,
    isAdminProfile: d.isAdminProfile === true,
    matchType: d.matchType === 'local' || d.matchType === 'international' || d.matchType === 'both' ? d.matchType : null,
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
  const q = query(collection(db, 'profiles'), where('isVisible', '==', true), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      const mapped = snap.docs
        .filter((d) => d.id !== currentUid)
        .map((d) => mapProfileDoc(d.id, d.data() as Record<string, unknown>))
        .filter((p) => p.isAdminProfile !== true)
        .filter((p) => p.displayName.toLowerCase() !== 'profile');
      onChange(mapped);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, '/profiles')
  );
}

export async function createOrGetMatch(
  otherUserId: string,
  otherProfile?: Profile
): Promise<Match> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  const id = matchIdFor(uid, otherUserId);
  const ref = doc(db, 'matches', id);
  const snap = await getDoc(ref);
  if (snap.exists()) return mapMatch(id, snap.data() as Record<string, unknown>, otherProfile);

  const now = Date.now();
  const payload = {
    id,
    user1Id: uid,
    user2Id: otherUserId,
    status: 'active',
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEFAULT_MATCH_DAYS * 86400000).toISOString(),
    extendedCount: 0
  };
  await setDoc(ref, payload);
  return mapMatch(id, payload, otherProfile);
}

export async function endMatch(matchId: string): Promise<void> {
  await updateDoc(doc(db, 'matches', matchId), {
    status: 'ended',
    endedAt: new Date().toISOString()
  });
}

export async function extendMatch(matchId: string): Promise<void> {
  const ref = doc(db, 'matches', matchId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Match not found');
  const data = snap.data() as Record<string, unknown>;
  const currentExpiry = new Date(String(data.expiresAt || new Date().toISOString()));
  const base = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
  await updateDoc(ref, {
    expiresAt: new Date(base.getTime() + DEFAULT_MATCH_DAYS * 86400000).toISOString(),
    extendedCount: Number(data.extendedCount || 0) + 1
  });
}
