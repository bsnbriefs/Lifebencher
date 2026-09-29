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

async function media(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const decoded = await requireUser(req);
  const { matchId, path } = await readBody(req);

  if (!matchId || !path) {
    return json(res, 400, { error: 'Missing path' });
  }

  const mediaPath = String(path);

  if (
    !mediaPath.startsWith(`chatAudio/${matchId}/`) &&
    !mediaPath.startsWith(`chatPhotos/${matchId}/`)
  ) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const admin = getAdmin();
  const matchSnap = await admin.firestore().doc(`matches/${matchId}`).get();

  if (!matchSnap.exists) {
    return json(res, 404, { error: 'Not found' });
  }

  const match = matchSnap.data();

  if (!assertMember(decoded, match)) {
    return json(res, 403, { error: 'Not allowed' });
  }

  const { url } = await signedReadUrl(admin, mediaPath, 120);

  return json(res, 200, { url });
}

async function viewOnce(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const decoded = await requireUser(req);
  const { matchId, messageId, action } = await readBody(req);

  if (!matchId || !messageId) {
    return json(res, 400, { error: 'Missing message' });
  }

  const admin = getAdmin();
  const db = admin.firestore();

  const matchSnap = await db.doc(`matches/${matchId}`).get();

  if (!matchSnap.exists) {
    return json(res, 404, { error: 'Not found' });
  }

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
        throw Object.assign(
          new Error('Not a view-once photo'),
          { status: 400 }
        );
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

  if (!msgSnap.exists) {
    return json(res, 404, { error: 'Not found' });
  }

  const msg = msgSnap.data();

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

const handlers = {
  media,
  'view-once': viewOnce
};

export default async function handler(req, res) {
  const action = Array.isArray(req.query?.action)
    ? req.query.action[0]
    : String(req.query?.action || '');

  const fn = handlers[action];

  if (!fn) {
    return json(res, 404, { error: 'Unknown chat action' });
  }

  try {
    return await fn(req, res);
  } catch (err) {
    const status = err.status || 500;

    return json(res, status, {
      error: err.message || 'Chat request failed'
    });
  }
                }
