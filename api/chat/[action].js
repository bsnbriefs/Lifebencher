import { getAdmin, json, readBody, requireUser } from '../../server/_lib/admin.js';

function assertMember(decoded, match) {
  return decoded.uid === match.user1Id || decoded.uid === match.user2Id;
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


const DISAPPEARING_MODES = { off: 0, '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
function getDisappearingMode(value) { const mode = String(value || 'off'); return Object.prototype.hasOwnProperty.call(DISAPPEARING_MODES, mode) ? mode : 'off'; }
async function getMatchForUser(admin, decoded, matchId) { if (!matchId) throw Object.assign(new Error('Missing match'), { status: 400 }); const snap = await admin.firestore().doc(`matches/${matchId}`).get(); if (!snap.exists) throw Object.assign(new Error('Not found'), { status: 404 }); const match = snap.data(); if (!assertMember(decoded, match)) throw Object.assign(new Error('Not allowed'), { status: 403 }); if (match.status !== 'active') throw Object.assign(new Error('This connection is no longer active.'), { status: 403 }); return match; }
async function getDisappearingModeForMatch(db, matchId) { const snap = await db.doc(`matches/${matchId}/chatSettings/config`).get(); return getDisappearingMode(snap.exists ? snap.data()?.duration : 'off'); }
function makeExpiresAt(mode, createdAtMs) { const ttl = DISAPPEARING_MODES[mode] || 0; return ttl ? new Date(createdAtMs + ttl).toISOString() : undefined; }
async function disappearing(req, res) { if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }); res.setHeader('Cache-Control', 'no-store'); const decoded = await requireUser(req); const { matchId, duration, method } = await readBody(req); const admin = getAdmin(); const db = admin.firestore(); await getMatchForUser(admin, decoded, matchId); if (method === 'get') return json(res, 200, { duration: await getDisappearingModeForMatch(db, matchId) }); const mode = getDisappearingMode(duration); await db.doc(`matches/${matchId}/chatSettings/config`).set({ duration: mode, updatedBy: decoded.uid, updatedAt: new Date().toISOString() }); return json(res, 200, { ok: true, duration: mode }); }
async function send(req, res) { if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }); res.setHeader('Cache-Control', 'no-store'); const decoded = await requireUser(req); const body = await readBody(req); const { matchId, kind, content, path, viewOnce, durationMs, replyToId, replyToPreview } = body; const admin = getAdmin(); const db = admin.firestore(); await getMatchForUser(admin, decoded, matchId); if (!['text','image','viewOnce','audio'].includes(kind)) return json(res, 400, { error: 'Invalid message type' }); const cleanContent = String(content || '').trim().slice(0, 2000); if (!cleanContent) return json(res, 400, { error: 'Message cannot be empty' }); const data = { id: '', matchId, senderId: decoded.uid, content: cleanContent, createdAt: new Date().toISOString() }; if (kind !== 'text') { if (!path || typeof path !== 'string') return json(res, 400, { error: 'Missing media path' }); const prefix = kind === 'audio' ? `chatAudio/${matchId}/${decoded.uid}/` : `chatPhotos/${matchId}/${decoded.uid}/`; if (!path.startsWith(prefix)) return json(res, 403, { error: 'Invalid media path' }); data.kind = kind; if (kind === 'audio') { data.audioPath = path; data.durationMs = Math.max(1, Math.round(Number(durationMs) || 0)); } else { data.imagePath = path; data.viewOnce = kind === 'viewOnce' || viewOnce === true; } } else { data.kind = 'text'; if (replyToId) data.replyToId = String(replyToId).slice(0,128); if (replyToPreview) data.replyToPreview = String(replyToPreview).slice(0,500); } const mode = await getDisappearingModeForMatch(db, matchId); const expiresAt = makeExpiresAt(mode, Date.now()); if (expiresAt) data.expiresAt = expiresAt; const msgRef = db.doc(`matches/${matchId}/messages/${db.collection('_tmp').doc().id}`); data.id = msgRef.id; try { await msgRef.create(data); } catch (error) { if (data.audioPath || data.imagePath) { try { const { file } = await signedReadUrl(admin, String(data.audioPath || data.imagePath), 120); await file.delete(); } catch {} } throw error; } return json(res, 200, { ok: true, messageId: msgRef.id, expiresAt: expiresAt || null, duration: mode }); }
async function cleanupExpired(req, res) { if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' }); const authorization = req.headers.authorization || ''; const cronSecret = process.env.CRON_SECRET; const isCron = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`; const body = req.method === 'POST' ? await readBody(req) : {}; const requestedMatchId = body.matchId || req.query?.matchId; const admin = getAdmin(); const db = admin.firestore(); let refs = []; if (isCron) { const snap = await db.collectionGroup('messages').where('expiresAt','<=',new Date().toISOString()).limit(250).get(); refs = snap.docs; } else { const decoded = await requireUser(req); if (!requestedMatchId) return json(res,400,{error:'Missing match'}); await getMatchForUser(admin,decoded,String(requestedMatchId)); const snap = await db.collection(`matches/${requestedMatchId}/messages`).where('expiresAt','<=',new Date().toISOString()).limit(250).get(); refs=snap.docs; } let deleted=0; for (const docSnap of refs) { const data=docSnap.data(); const mediaPath=data.audioPath||data.imagePath||null; await docSnap.ref.delete(); deleted++; if(mediaPath){ try { const {file}=await signedReadUrl(admin,String(mediaPath),120); await file.delete(); } catch {} } } return json(res,200,{ok:true,deleted}); }

async function media(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const decoded = await requireUser(req);
  const { matchId, path } = await readBody(req);

  if (!matchId || !path) return json(res, 400, { error: 'Missing path' });

  const mediaPath = String(path);
  if (
    !mediaPath.startsWith(`chatAudio/${matchId}/`) &&
    !mediaPath.startsWith(`chatPhotos/${matchId}/`)
  ) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const admin = getAdmin();
  const matchSnap = await admin.firestore().doc(`matches/${matchId}`).get();

  if (!matchSnap.exists) return json(res, 404, { error: 'Not found' });

  const match = matchSnap.data();
  if (!assertMember(decoded, match)) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const imageMessageSnap = await admin.firestore().collection(`matches/${matchId}/messages`).where('imagePath', '==', mediaPath).limit(1).get();
  const mediaMessageSnap = imageMessageSnap.empty ? await admin.firestore().collection(`matches/${matchId}/messages`).where('audioPath', '==', mediaPath).limit(1).get() : imageMessageSnap;
  if (!mediaMessageSnap.empty) {
    const message = mediaMessageSnap.docs[0].data();
    const expiresAt = message.expiresAt ? new Date(String(message.expiresAt)).getTime() : 0;
    if (expiresAt && expiresAt <= Date.now()) return json(res, 410, { error: 'Message expired' });
  }
  const { url } = await signedReadUrl(admin, mediaPath, 120);
  return json(res, 200, { url });
}

async function viewOnce(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const decoded = await requireUser(req);
  const { matchId, messageId, action } = await readBody(req);

  if (!matchId || !messageId) {
    return json(res, 400, { error: 'Missing message' });
  }

  const admin = getAdmin();
  const db = admin.firestore();

  const matchSnap = await db.doc(`matches/${matchId}`).get();
  if (!matchSnap.exists) return json(res, 404, { error: 'Not found' });

  const match = matchSnap.data();
  if (!assertMember(decoded, match)) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const msgRef = db.doc(`matches/${matchId}/messages/${messageId}`);

  if (action === 'consume') {
    let pathToDelete = null;

    await db.runTransaction(async (t) => {
      const snap = await t.get(msgRef);

      if (!snap.exists) {
        throw Object.assign(new Error('Not found'), { status: 404 });
      }

      const msg = snap.data();

      if (!msg.viewOnce) {
        throw Object.assign(new Error('Not a view-once photo'), { status: 400 });
      }

      if (decoded.uid === msg.senderId) return;
      if (msg.viewedAt) return;

      if (msg.viewingBy && msg.viewingBy !== decoded.uid) {
        throw Object.assign(new Error('Not allowed'), { status: 403 });
      }

      pathToDelete = msg.imagePath || null;

      t.update(msgRef, {
        viewedAt: new Date().toISOString(),
        viewingBy: decoded.uid
      });
    });

    if (pathToDelete) {
      try {
        const got = await signedReadUrl(admin, pathToDelete);
        await got.file.delete().catch(() => null);
      } catch {
        // Already deleted or unavailable.
      }
    }

    return json(res, 200, { ok: true });
  }

  const msgSnap = await msgRef.get();

  if (!msgSnap.exists) return json(res, 404, { error: 'Not found' });

  const msg = msgSnap.data();
  const expiresAt = msg.expiresAt ? new Date(String(msg.expiresAt)).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return json(res, 410, { error: 'Message expired' });

  if (!msg.viewOnce || !msg.imagePath) {
    return json(res, 400, { error: 'Not a view-once photo' });
  }

  const isSender = decoded.uid === msg.senderId;

  if (msg.viewedAt && !isSender) {
    return json(res, 410, { error: 'Already viewed' });
  }

  await db.runTransaction(async (t) => {
    const snap = await t.get(msgRef);
    const live = snap.data();

    if (!live) {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }

    if (live.viewedAt && decoded.uid !== live.senderId) {
      throw Object.assign(new Error('Already viewed'), { status: 410 });
    }

    if (!isSender) {
      t.update(msgRef, {
        viewingBy: decoded.uid,
        viewingUntil: new Date(Date.now() + 60 * 1000).toISOString()
      });
    }
  });

  const { url } = await signedReadUrl(admin, msg.imagePath);
  return json(res, 200, { url, expiresIn: 45 });
}


async function deleteMessage(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const decoded = await requireUser(req);
  const { matchId, messageId } = await readBody(req);

  if (!matchId || !messageId) {
    return json(res, 400, { error: 'Missing message' });
  }

  const admin = getAdmin();
  const db = admin.firestore();
  const matchSnap = await db.doc(`matches/${matchId}`).get();

  if (!matchSnap.exists) return json(res, 404, { error: 'Not found' });

  const match = matchSnap.data();
  if (!assertMember(decoded, match)) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const msgRef = db.doc(`matches/${matchId}/messages/${messageId}`);
  const msgSnap = await msgRef.get();

  if (!msgSnap.exists) return json(res, 404, { error: 'Message not found' });

  const msg = msgSnap.data();
  if (msg.senderId !== decoded.uid) {
    return json(res, 403, { error: 'You can only unsend your own messages.' });
  }

  const createdAt = msg.createdAt?.toDate
    ? msg.createdAt.toDate().getTime()
    : new Date(msg.createdAt || 0).getTime();

  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60 * 1000) {
    return json(res, 403, { error: 'Messages can only be unsent within 15 minutes.' });
  }

  const mediaPath = msg.audioPath || msg.imagePath || null;
  await msgRef.delete();

  if (mediaPath) {
    try {
      const { file } = await signedReadUrl(admin, String(mediaPath), 120);
      await file.delete();
    } catch {
      // The chat message is already removed; cleanup is best-effort.
    }
  }

  return json(res, 200, { ok: true });
}

const handlers = {
  media,
  send,
  disappearing,
  'view-once': viewOnce,
  'delete-message': deleteMessage,
  'cleanup-expired': cleanupExpired
};

export default async function handler(req, res) {
  const action = Array.isArray(req.query?.action)
    ? req.query.action[0]
    : String(req.query?.action || '');

  const fn = handlers[action];

  if (!fn) return json(res, 404, { error: 'Unknown chat action' });

  try {
    return await fn(req, res);
  } catch (err) {
    const status = err.status || 500;
    return json(res, status, {
      error: err.message || 'Chat request failed'
    });
  }
}
