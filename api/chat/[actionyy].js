import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';

const DISAPPEARING_MODES = new Set(['off', '24h', '7d', '30d']);

function assertMember(decoded, match) {
  return decoded.uid === match.user1Id || decoded.uid === match.user2Id;
}

function otherUserId(uid, match) {
  return uid === match.user1Id ? match.user2Id : match.user1Id;
}

async function isBlocked(db, uid, targetUid) {
  const [a, b] = await Promise.all([
    db.doc(`blocks/${uid}_${targetUid}`).get(),
    db.doc(`blocks/${targetUid}_${uid}`).get()
  ]);
  return a.exists || b.exists;
}

function parseTime(value) {
  if (!value) return NaN;
  if (typeof value === 'string') return Date.parse(value);
  if (value.toDate) return value.toDate().getTime();
  return new Date(value).getTime();
}

async function signedReadUrl(admin, path, expiresSeconds = 45) {
  const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
  const names = [
    process.env.FIREBASE_STORAGE_BUCKET,
    cred.project_id ? `${cred.project_id}.firebasestorage.app` : null,
    cred.project_id ? `${cred.project_id}.appspot.com` : null
  ].filter(Boolean);

  let lastErr;
  for (const name of names) {
    try {
      const file = admin.storage().bucket(name).file(path);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresSeconds * 1000,
        version: 'v4'
      });
      return { url, file };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Storage bucket not configured');
}

async function getMatchForUser(db, decoded, matchId) {
  const snap = await db.doc(`matches/${matchId}`).get();
  if (!snap.exists) throw Object.assign(new Error('Match not found'), { status: 404 });
  const match = snap.data();
  if (!assertMember(decoded, match)) throw Object.assign(new Error('Not allowed'), { status: 403 });
  return match;
}

async function getDisappearingMode(db, matchId) {
  const snap = await db.doc(`chatSettings/${matchId}`).get();
  const duration = snap.exists ? snap.data()?.duration : 'off';
  return DISAPPEARING_MODES.has(duration) ? duration : 'off';
}

function expirationForMode(mode, now = Date.now()) {
  if (mode === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (mode === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (mode === '30d') return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

async function media(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const decoded = await requireUser(req);
  const { matchId, path } = await readBody(req);
  if (!matchId || !path) return json(res, 400, { error: 'Missing path' });

  const admin = getAdmin();
  const db = admin.firestore();
  const match = await getMatchForUser(db, decoded, matchId);
  if (await isBlocked(db, decoded.uid, otherUserId(decoded.uid, match))) return json(res, 403, { error: 'Chat unavailable' });

  const mediaPath = String(path);
  if (!mediaPath.startsWith(`chatAudio/${matchId}/${decoded.uid}/`) &&
      !mediaPath.startsWith(`chatAudio/${matchId}/`) &&
      !mediaPath.startsWith(`chatPhotos/${matchId}/${decoded.uid}/`) &&
      !mediaPath.startsWith(`chatPhotos/${matchId}/`)) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const snaps = await db.collection(`matches/${matchId}/messages`)
    .where('imagePath', '==', mediaPath).limit(1).get();
  const audioSnaps = snaps.empty
    ? await db.collection(`matches/${matchId}/messages`).where('audioPath', '==', mediaPath).limit(1).get()
    : snaps;
  if (!audioSnaps.empty) {
    const msg = audioSnaps.docs[0].data();
    const expiresAt = parseTime(msg.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return json(res, 410, { error: 'Message expired' });
    if (msg.viewOnce && msg.viewedAt && msg.senderId !== decoded.uid) return json(res, 410, { error: 'Already viewed' });
  }

  const { url } = await signedReadUrl(admin, mediaPath, 120);
  return json(res, 200, { url });
}

async function send(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const decoded = await requireUser(req);
  const body = await readBody(req);
  const { matchId, kind = 'text', content = '', imagePath, audioPath, viewOnce, durationMs, replyToId, replyToPreview } = body;
  if (!matchId) return json(res, 400, { error: 'Missing match' });
  if (!['text', 'image', 'viewOnce', 'audio'].includes(kind)) return json(res, 400, { error: 'Invalid message type' });

  const admin = getAdmin();
  const db = admin.firestore();
  const match = await getMatchForUser(db, decoded, matchId);
  if (match.status !== 'active') return json(res, 403, { error: 'This match is no longer active.' });
  const otherId = otherUserId(decoded.uid, match);
  if (await isBlocked(db, decoded.uid, otherId)) return json(res, 403, { error: 'You cannot message this user.' });

  const text = String(content || '').trim();
  if (!text || text.length > 2000) return json(res, 400, { error: 'Invalid message content' });

  if (kind === 'image' || kind === 'viewOnce') {
    if (typeof imagePath !== 'string' || !imagePath.startsWith(`chatPhotos/${matchId}/${decoded.uid}/`)) {
      return json(res, 400, { error: 'Invalid image' });
    }
  }
  if (kind === 'audio') {
    if (typeof audioPath !== 'string' || !audioPath.startsWith(`chatAudio/${matchId}/${decoded.uid}/`)) {
      return json(res, 400, { error: 'Invalid voice message' });
    }
    if (!Number.isFinite(Number(durationMs)) || Number(durationMs) < 1 || Number(durationMs) > 10 * 60 * 1000) {
      return json(res, 400, { error: 'Invalid voice duration' });
    }
  }
  if (replyToId && (typeof replyToId !== 'string' || replyToId.length > 128)) return json(res, 400, { error: 'Invalid reply' });

  const mode = await getDisappearingMode(db, matchId);
  const createdAt = new Date().toISOString();
  const expiresAt = expirationForMode(mode);
  const ref = db.collection(`matches/${matchId}/messages`).doc();
  const message = {
    id: ref.id,
    matchId,
    senderId: decoded.uid,
    content: text,
    createdAt,
    ...(kind !== 'text' ? { kind } : {}),
    ...(imagePath ? { imagePath: String(imagePath) } : {}),
    ...(audioPath ? { audioPath: String(audioPath), durationMs: Math.round(Number(durationMs)) } : {}),
    ...(viewOnce ? { viewOnce: true } : {}),
    ...(replyToId ? { replyToId, replyToPreview: String(replyToPreview || '').slice(0, 240) } : {}),
    ...(expiresAt ? { expiresAt } : {})
  };
  await ref.set(message);
  return json(res, 200, { ok: true, messageId: ref.id, expiresAt: expiresAt || null });
}

async function disappearing(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const decoded = await requireUser(req);
  const body = await readBody(req);
  const matchId = String(body.matchId || '');
  if (!matchId) return json(res, 400, { error: 'Missing match' });
  const admin = getAdmin();
  const db = admin.firestore();
  const match = await getMatchForUser(db, decoded, matchId);
  if (await isBlocked(db, decoded.uid, otherUserId(decoded.uid, match))) return json(res, 403, { error: 'Chat unavailable' });

  if (body.method === 'get') return json(res, 200, { duration: await getDisappearingMode(db, matchId) });
  const duration = String(body.duration || 'off');
  if (!DISAPPEARING_MODES.has(duration)) return json(res, 400, { error: 'Invalid disappearing duration' });
  await db.doc(`chatSettings/${matchId}`).set({ duration, updatedBy: decoded.uid, updatedAt: new Date().toISOString() }, { merge: true });
  return json(res, 200, { ok: true, duration });
}

async function cleanupExpired(req, res) {
  const authHeader = String(req.headers.authorization || '');
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
  let matchId = null;
  let decoded = null;
  if (!cronAuthorized) {
    decoded = await requireUser(req);
    const body = await readBody(req);
    matchId = String(body.matchId || '');
    if (!matchId) return json(res, 400, { error: 'Missing match' });
  }

  const admin = getAdmin();
  const db = admin.firestore();
  const now = new Date().toISOString();
  let query = db.collectionGroup('messages').where('expiresAt', '<=', now).limit(250);
  if (!cronAuthorized) {
    const match = await getMatchForUser(db, decoded, matchId);
    if (await isBlocked(db, decoded.uid, otherUserId(decoded.uid, match))) return json(res, 403, { error: 'Chat unavailable' });
    query = db.collection(`matches/${matchId}/messages`).where('expiresAt', '<=', now).limit(250);
  }
  const snap = await query.get();
  let deleted = 0;
  for (const docSnap of snap.docs) {
    const msg = docSnap.data();
    await docSnap.ref.delete();
    deleted += 1;
    for (const path of [msg.imagePath, msg.audioPath]) {
      if (!path) continue;
      try {
        const { file } = await signedReadUrl(admin, String(path), 60);
        await file.delete();
      } catch { /* best effort */ }
    }
  }
  return json(res, 200, { ok: true, deleted });
}

async function viewOnce(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const decoded = await requireUser(req);
  const { matchId, messageId, action } = await readBody(req);
  if (!matchId || !messageId) return json(res, 400, { error: 'Missing message' });
  const admin = getAdmin();
  const db = admin.firestore();
  const match = await getMatchForUser(db, decoded, matchId);
  if (await isBlocked(db, decoded.uid, otherUserId(decoded.uid, match))) return json(res, 403, { error: 'Chat unavailable' });
  const msgRef = db.doc(`matches/${matchId}/messages/${messageId}`);

  if (action === 'consume') {
    let pathToDelete = null;
    await db.runTransaction(async (t) => {
      const snap = await t.get(msgRef);
      if (!snap.exists) throw Object.assign(new Error('Not found'), { status: 404 });
      const msg = snap.data();
      if (!msg.viewOnce) throw Object.assign(new Error('Not a view-once photo'), { status: 400 });
      const expiresAt = parseTime(msg.expiresAt);
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) throw Object.assign(new Error('Message expired'), { status: 410 });
      if (decoded.uid === msg.senderId || msg.viewedAt) return;
      if (msg.viewingBy && msg.viewingBy !== decoded.uid) throw Object.assign(new Error('Not allowed'), { status: 403 });
      pathToDelete = msg.imagePath || null;
      t.update(msgRef, { viewedAt: new Date().toISOString(), viewingBy: decoded.uid });
    });
    if (pathToDelete) {
      try { const got = await signedReadUrl(admin, pathToDelete); await got.file.delete().catch(() => null); } catch { /* best effort */ }
    }
    return json(res, 200, { ok: true });
  }

  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return json(res, 404, { error: 'Not found' });
  const msg = msgSnap.data();
  const expiresAt = parseTime(msg.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return json(res, 410, { error: 'Message expired' });
  if (!msg.viewOnce || !msg.imagePath) return json(res, 400, { error: 'Not a view-once photo' });
  const isSender = decoded.uid === msg.senderId;
  if (msg.viewedAt && !isSender) return json(res, 410, { error: 'Already viewed' });
  await db.runTransaction(async (t) => {
    const snap = await t.get(msgRef);
    const live = snap.data();
    if (!live) throw Object.assign(new Error('Not found'), { status: 404 });
    const liveExpires = parseTime(live.expiresAt);
    if (Number.isFinite(liveExpires) && liveExpires <= Date.now()) throw Object.assign(new Error('Message expired'), { status: 410 });
    if (live.viewedAt && decoded.uid !== live.senderId) throw Object.assign(new Error('Already viewed'), { status: 410 });
    if (!isSender) t.update(msgRef, { viewingBy: decoded.uid, viewingUntil: new Date(Date.now() + 60 * 1000).toISOString() });
  });
  const { url } = await signedReadUrl(admin, msg.imagePath);
  return json(res, 200, { url, expiresIn: 45 });
}

async function editMessage(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const decoded = await requireUser(req);
  const { matchId, messageId, content } = await readBody(req);
  if (!matchId || !messageId) return json(res, 400, { error: 'Missing message' });
  const text = String(content || '').trim();
  if (!text || text.length > 2000) return json(res, 400, { error: 'Invalid message content' });

  const admin = getAdmin();
  const db = admin.firestore();
  await getMatchForUser(db, decoded, matchId);
  const msgRef = db.doc(`matches/${matchId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return json(res, 404, { error: 'Message not found' });

  const msg = msgSnap.data();
  if (msg.senderId !== decoded.uid) return json(res, 403, { error: 'You can only edit your own messages.' });
  if (msg.kind && msg.kind !== 'text') return json(res, 400, { error: 'Only text messages can be edited.' });

  const createdAt = parseTime(msg.createdAt);
  if (!Number.isFinite(createdAt)) return json(res, 400, { error: 'Invalid message timestamp.' });
  if (Date.now() - createdAt > 10 * 60 * 1000) {
    return json(res, 403, { error: 'Messages can only be edited within 10 minutes.' });
  }

  await msgRef.update({ content: text, editedAt: new Date().toISOString() });
  return json(res, 200, { ok: true });
}

async function deleteMessage(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const decoded = await requireUser(req);
  const { matchId, messageId } = await readBody(req);
  if (!matchId || !messageId) return json(res, 400, { error: 'Missing message' });
  const admin = getAdmin();
  const db = admin.firestore();
  const match = await getMatchForUser(db, decoded, matchId);
  const msgRef = db.doc(`matches/${matchId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) return json(res, 404, { error: 'Message not found' });
  const msg = msgSnap.data();
  if (msg.senderId !== decoded.uid) return json(res, 403, { error: 'You can only delete your own messages.' });
  const mediaPath = msg.audioPath || msg.imagePath || null;
  await msgRef.delete();
  if (mediaPath) {
    try { const { file } = await signedReadUrl(admin, String(mediaPath), 60); await file.delete(); } catch { /* best effort */ }
  }
  return json(res, 200, { ok: true });
}


const handlers = { media, send, disappearing, 'view-once': viewOnce, 'delete-message': deleteMessage, edit: editMessage, 'cleanup-expired': cleanupExpired };

export default async function handler(req, res) {
  const action = Array.isArray(req.query?.action) ? req.query.action[0] : String(req.query?.action || '');
  const fn = handlers[action];
  if (!fn) return json(res, 404, { error: 'Unknown chat action' });
  try { return await fn(req, res); }
  catch (err) { return json(res, err.status || 500, { error: err.message || 'Chat request failed' }); }
}
