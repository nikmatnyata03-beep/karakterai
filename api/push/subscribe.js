// api/push/subscribe.js
// Saves the browser's Web Push subscription object to Supabase
// Called once after the user grants notification permission

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, subscription } = req.body || {};

  if (!userId || !subscription?.endpoint) {
    return res.status(400).json({ error: 'Missing userId or subscription.endpoint' });
  }

  // Upsert: one row per user, update if they re-subscribe (e.g. after clearing browser data)
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        subscription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[push/subscribe] Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
