import webpush from 'web-push';
import { getAdmin } from './admin.js';

export async function pushToUser(userId, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { sent: 0, reason: 'vapid_missing' };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@barristerstreet.org', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const db = getAdmin().firestore();
  const subs = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
  let sent = 0;
  for (const doc of subs.docs) {
    try {
      await webpush.sendNotification(doc.data().subscription, JSON.stringify(payload));
      sent += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await doc.ref.delete();
    }
  }
  return { sent };
}
