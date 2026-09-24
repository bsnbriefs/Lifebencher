import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from './firebase';

export function profilePhotoPath(uid: string) {
  return `profilePhotos/${uid}/avatar`;
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
  onProgress?: (pct: number) => void
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('Not signed in'));
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return Promise.reject(new Error('Please choose a JPG, PNG or WebP image'));
  }
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Image must be under 5MB'));

  const storageRef = ref(storage, profilePhotoPath(uid));
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        if (!onProgress || !snap.totalBytes) return;
        onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
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
