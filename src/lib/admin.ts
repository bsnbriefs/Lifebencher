import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Profile } from '../types';
import { auth, db } from './firebase';
import { mapProfileDoc } from './matches';
import { grantPendingMatchmakingForUser } from './billing';

async function fetchProfilesViaAdminApi(): Promise<Profile[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json()) as { profiles?: Record<string, unknown>[]; error?: string };
  if (!res.ok) throw new Error(body.error || 'Admin list failed');
  return (body.profiles || []).map((d) => mapProfileDoc(String(d.id), d));
}

export function listenAllProfiles(
  onChange: (profiles: Profile[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    collection(db, 'profiles'),
    (snap) => {
      const list = snap.docs.map((d) => mapProfileDoc(d.id, d.data() as Record<string, unknown>));
      onChange(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    (err) => {
      console.error('Admin profile list', err);
      void fetchProfilesViaAdminApi()
        .then((list) => {
          onChange(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
          onError?.('');
        })
        .catch((apiErr) => {
          console.error('Admin profile API', apiErr);
          onChange([]);
          onError?.('Unable to load verification requests. Please try again.');
        });
    }
  );
}

export function profileReadyForReview(profile: Profile): boolean {
  const photos = [...new Set((profile.photos || []).filter((url) => url.startsWith('https://')))];
  return Boolean(
    profile.displayName?.trim()
    && profile.location?.trim()
    && profile.profession?.trim()
    && (profile.bio || '').trim().length >= 15
    && photos.length >= 2
  );
}

export async function setProfileVerified(profile: Profile, isVerified: boolean): Promise<void> {
  if (isVerified && !profileReadyForReview(profile)) {
    throw new Error('This profile is incomplete. Two photos and the required fields are needed before approval.');
  }
  const id = profile.id || profile.userId;
  let matchType = profile.matchType === 'local' || profile.matchType === 'international' ? profile.matchType : null;
  if (!matchType) {
    try {
      const ent = await getDoc(doc(db, 'entitlements', id));
      const pack = ent.data()?.matchType || ent.data()?.matchmakingPackage;
      if (pack === 'local' || pack === 'international') matchType = pack;
    } catch {
      /* keep existing */
    }
  }
  await updateDoc(doc(db, 'profiles', id), {
    isVerified,
    isVisible: isVerified && profile.isAdminProfile !== true,
    isAdminProfile: profile.isAdminProfile === true,
    updatedAt: new Date().toISOString(),
    ...(matchType ? { matchType } : {})
  });
  if (isVerified && profile.isAdminProfile !== true) {
    await setDoc(doc(db, 'notifications', `approved-${id}`), {
      userId: id,
      title: 'Profile approved',
      body: 'Your profile is approved. Open Discover to see your matches.',
      href: 'discover',
      read: false,
      createdAt: new Date().toISOString()
    });
    await grantPendingMatchmakingForUser(id);
  }
}
