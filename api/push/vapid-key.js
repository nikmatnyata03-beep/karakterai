// api/push/vapid-key.js
// Returns the VAPID public key so the browser can subscribe to push notifications

export default function handler(req, res) {
  const key = process.env.VAPID_PUBLIC_KEY;

  if (!key) {
    return res.status(503).json({ error: 'Push notifications not configured (missing VAPID_PUBLIC_KEY)' });
  }

  // Cache for 24h — key rarely changes
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json({ publicKey: key });
}
