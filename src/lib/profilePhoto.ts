import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from './firebase';

export function profilePhotoPath(uid: string, slot = 0) {
  return slot === 0 ? `profilePhotos/${uid}/avatar` : `profilePhotos/${uid}/gallery_${slot}`;
}

export async function fetchProfilePhotoUrl(uid: string): Promise<string | null> {
  try {
    return await getDownloadURL(ref(storage, profilePhotoPath(uid)));
  } catch {
    return null;
  }
}

export function uploadProfilePhoto(
  file: File,
  onProgress?: (pct: number) => void,
  slot = 0
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Not signed in'));
  const name = (file.name || '').toLowerCase();
  let contentType = file.type || '';
  if (!contentType) {
    if (name.endsWith('.png')) contentType = 'image/png';
    else if (name.endsWith('.webp')) contentType = 'image/webp';
    else contentType = 'image/jpeg';
  }
  if (contentType === 'image/jpg') contentType = 'image/jpeg';
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(contentType)) {
    return Promise.reject(new Error('Use a JPG, PNG or WebP from your camera or gallery. HEIC must be saved as JPG first.'));
  }
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Image must be under 5MB'));

  const storageRef = ref(storage, profilePhotoPath(uid, slot));
  const task = uploadBytesResumable(storageRef, file, { contentType });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (!onProgress || !snap.totalBytes) return;
        onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('permission')) {
          reject(new Error('Photo storage is not open yet. Publish Storage rules for profilePhotos/{userId}.'));
          return;
        }
        reject(new Error('Could not upload that photo. Try another JPG or PNG under 5MB.'));
      },
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
