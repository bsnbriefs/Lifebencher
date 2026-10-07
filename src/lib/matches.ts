import {
  collection,
  doc,
  getDoc,
  getDocs,
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

export async function countUserMatches(uid: string): Promise<number> {
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('user1Id', '==', uid))),
    getDocs(query(collection(db, 'matches'), where('user2Id', '==', uid)))
  ]);
  const ids = new Set<string>();
  a.docs.forEach((d) => ids.add(d.id));
  b.docs.forEach((d) => ids.add(d.id));
  return ids.size;
}

async function assertMatchAllowance(uid: string): Promise<{ used: number; cap: number }> {
  const used = await countUserMatches(uid);
  const snap = await getDoc(doc(db, 'entitlements', uid));
  const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
  const extra = Number(data.extraMatches || 0);
  const cap = 3 + Math.max(0, extra);
  if (used >= cap) {
    throw new Error('Your 3-match allowance has been used. Existing chats stay open. Buy an extra introduction if you want another match.');
  }
  return { used, cap };
}

async function recordMatchAllowance(uid: string, usedBefore: number, cap: number): Promise<void> {
  const nextUsed = usedBefore + 1;
  await setDoc(
    doc(db, 'entitlements', uid),
    {
      matchmakingRemaining: Math.max(0, 3 - nextUsed),
      extraMatches: Math.max(0, cap - Math.max(nextUsed, 3)),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
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
  const raw = [d.displayName, d.name, d.fullName, d.firstName].map((v) => String(v ?? '').trim());
  return raw.find((s) => s && s.toLowerCase() !== 'member') || fallback;
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
    relationshipIntent: Array.isArray(d.relationshipIntent) ? (d.relationshipIntent as string[]) : [],
    voiceIntroPath: typeof d.voiceIntroPath === 'string' ? d.voiceIntroPath : '',
    voiceIntroDurationMs: typeof d.voiceIntroDurationMs === 'number' ? d.voiceIntroDurationMs : 0,
    lifestyle: d.lifestyle && typeof d.lifestyle === 'object' ? (d.lifestyle as Profile['lifestyle']) : {},
    isVerified: Boolean(d.isVerified),
    isVisible: d.isVisible === true,
    isAdminProfile: d.isAdminProfile === true,
    matchType: d.matchType === 'local' || d.matchType === 'international' || d.matchType === 'both' ? d.matchType : null,
    createdAt: String(d.createdAt || ''),
    updatedAt: String(d.updatedAt || ''),
    lastActiveAt: typeof d.lastActiveAt === 'string' ? d.lastActiveAt : ''
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
export async function fetchApprovedDiscoverProfiles(): Promise<Profile[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return [];
  const res = await fetch('/api/discover/profiles', { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { profiles?: Record<string, unknown>[] };
  if (!res.ok) return [];
  return (body.profiles || []).map((d) => mapProfileDoc(String(d.id), d));
}
export function listenVisibleProfiles(
  currentUid: string,
  onChange: (profiles: Profile[]) => void
): () => void {
  const visibleQ = query(collection(db, 'profiles'), where('isVisible', '==', true), limit(200));
  const verifiedQ = query(collection(db, 'profiles'), where('isVerified', '==', true), limit(200));
  let visible: Profile[] = [];
  let verified: Profile[] = [];
  const publish = () => {
    const merged = new Map<string, Profile>();
    [...visible, ...verified].forEach((p) => {
      if (p.id !== currentUid && p.userId !== currentUid && p.isAdminProfile !== true) merged.set(p.id, p);
    });
    onChange(Array.from(merged.values()));
  };
  const unsubVisible = onSnapshot(visibleQ, (snap) => {
    visible = snap.docs.map((d) => mapProfileDoc(d.id, d.data() as Record<string, unknown>));
    publish();
  }, () => publish());
  const unsubVerified = onSnapshot(verifiedQ, (snap) => {
    verified = snap.docs.map((d) => mapProfileDoc(d.id, d.data() as Record<string, unknown>));
    publish();
  }, () => publish());
  return () => {
    unsubVisible();
    unsubVerified();
  };
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
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return id;
  } catch {
    /* missing docs can deny get; create instead */
  }

  const allowance = await assertMatchAllowance(uid);
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch('/api/matches/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ otherUserId })
  });
  const body = await res.json().catch(() => ({})) as { id?: string; error?: string };
  if (!res.ok || !body.id) throw new Error(body.error || 'Could not open the match.');
  void allowance;
  return body.id;
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
