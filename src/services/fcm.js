/**
 * Firebase Cloud Messaging: send push notifications to parent devices.
 *
 * Credentials (use one):
 * - FIREBASE_SERVICE_ACCOUNT_JSON: full JSON string (for hosting – no file on disk).
 * - FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS: path to JSON file (local/dev).
 * If none set, push is skipped (Socket.IO still works).
 */
import User from '../models/User.js';

let messaging = null;

async function getMessaging() {
  if (messaging != null) return messaging;
  const jsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!jsonString && !path) return null;
  try {
    const admin = await import('firebase-admin');
    let json;
    if (jsonString && jsonString.trim().startsWith('{')) {
      json = JSON.parse(jsonString.trim());
    } else if (path) {
      const { readFileSync } = await import('fs');
      const { fileURLToPath } = await import('url');
      const pathMod = await import('path');
      const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
      const resolved = pathMod.default.isAbsolute(path) || /^[A-Z]:/i.test(path)
        ? path
        : pathMod.default.join(pathMod.default.dirname(__dirname), '..', path);
      json = JSON.parse(readFileSync(resolved, 'utf8'));
    } else {
      return null;
    }
    if (!admin.default.apps.length) {
      admin.default.initializeApp({ credential: admin.default.credential.cert(json) });
    }
    messaging = admin.default.messaging();
    return messaging;
  } catch (e) {
    console.warn('[FCM] Init skipped:', e.message);
    return null;
  }
}

/**
 * Send push notification to users by their IDs.
 * @param {string[]} userIds - ObjectId strings
 * @param {string} title
 * @param {string} body
 * @param {object} [data] - optional payload (e.g. type, postId)
 */
export async function sendPushToUsers(userIds, title, body, data = {}) {
  if (!userIds?.length) return;
  const users = await User.find({ _id: { $in: userIds }, fcmToken: { $exists: true, $ne: '' } }).select('fcmToken').lean();
  const tokens = users.map(u => u.fcmToken).filter(Boolean);
  if (!tokens.length) {
    console.warn('[FCM] No FCM tokens for these users – have parents opened the app while logged in? User IDs:', userIds.slice(0, 5));
    return;
  }
  const m = await getMessaging();
  if (!m) {
    console.warn('[FCM] Push skipped: Firebase not configured (set FIREBASE_SERVICE_ACCOUNT_JSON or path).');
    return;
  }
  if (process.env.NODE_ENV !== 'production') console.log('[FCM] Sending push to', tokens.length, 'device(s):', title);
  const payload = {
    notification: { title, body },
    data: { ...Object.fromEntries(Object.entries(data).map(([k, v]) => [String(k), String(v)])), title, body },
    android: { priority: 'high', notification: { sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } }
  };
  for (const token of tokens) {
    try {
      await m.send({ ...payload, token });
    } catch (err) {
      if (err?.code === 'messaging/invalid-registration-token' || err?.code === 'messaging/registration-token-not-registered') {
        await User.updateOne({ fcmToken: token }, { $unset: { fcmToken: 1 } });
      }
    }
  }
}
