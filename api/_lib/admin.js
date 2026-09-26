import admin from "firebase-admin";

function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server");
  }
  const cred = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(cred),
  });
  return admin;
}

export function getAdmin() {
  return initAdmin();
}

export async function requireUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const err = new Error("Not signed in");
    err.status = 401;
    throw err;
  }
  const decoded = await getAdmin().auth().verifyIdToken(token);
  return decoded;
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
