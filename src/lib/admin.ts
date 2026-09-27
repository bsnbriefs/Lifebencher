import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Profile } from '../types';
import { auth, db } from './firebase';
import { mapProfileDoc } from './matches';

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

export async function setProfileVerified(profile: Profile, isVerified: boolean): Promise<void> {
  const id = profile.id || profile.userId;
  await updateDoc(doc(db, 'profiles', id), {
    isVerified,
    isVisible: isVerified && profile.isAdminProfile !== true,
    updatedAt: new Date().toISOString()
  });
}
