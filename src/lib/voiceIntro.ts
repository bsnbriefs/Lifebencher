import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';
import { pickRecorderMime } from './chat';

export const VOICE_INTRO_MAX_MS = 30_000;

export function voiceIntroPath(uid: string, ext = 'webm'): string {
  return `voiceIntros/${uid}/intro-${Date.now()}.${ext}`;
}

export async function resolveVoiceIntroUrl(path: string): Promise<string> {
  if (!path || !path.startsWith('voiceIntros/')) throw new Error('Voice introduction is unavailable.');
  return getDownloadURL(ref(storage, path));
}

export async function uploadVoiceIntro(blob: Blob, durationMs: number): Promise<{ path: string; durationMs: number }> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not signed in');
  if (durationMs < 400) throw new Error('Record a little longer so matches can hear you.');
  if (durationMs > VOICE_INTRO_MAX_MS + 400) throw new Error('Voice introductions can be up to 30 seconds.');
  if (blob.size > 4 * 1024 * 1024) throw new Error('That recording is too large.');
  const type = blob.type || pickRecorderMime() || 'audio/webm';
  const ext = type.includes('mp4') || type.includes('aac') ? 'm4a' : 'webm';
  const path = voiceIntroPath(uid, ext);
  await uploadBytes(ref(storage, path), blob, { contentType: type.split(';')[0] });
  return { path, durationMs: Math.min(VOICE_INTRO_MAX_MS, Math.max(1, Math.round(durationMs))) };
}

export async function deleteVoiceIntroFile(path?: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !path || !path.startsWith(`voiceIntros/${uid}/`)) return;
  await deleteObject(ref(storage, path)).catch(() => undefined);
}
