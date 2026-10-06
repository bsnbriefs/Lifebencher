import { json } from '../../server/_lib/admin.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  const url = process.env.TURN_URL || process.env.VITE_TURN_URL;
  const username = process.env.TURN_USERNAME || process.env.VITE_TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL;
  if (url && username && credential) {
    const urls = url.split(',').map((item) => item.trim()).filter(Boolean);
    servers.push({ urls, username, credential });
  }
  return json(res, 200, { iceServers: servers, turn: Boolean(url && username && credential) });
}
