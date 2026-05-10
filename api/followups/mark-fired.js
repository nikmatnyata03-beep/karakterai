// api/followups/mark-fired.js
// Called by browser when it handles the follow-up itself (tab was open)
// Prevents cron job from double-firing the same follow-up

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, charId } = req.body || {};

  if (!userId || !charId) {
    return res.status(400).json({ error: 'Missing userId or charId' });
  }

  const { error } = await supabase
    .from('followup_queue')
    .update({
      fired: true,
      fired_by: 'browser',
      fired_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('char_id', charId)
    .eq('fired', false);

  if (error) {
    console.error('[mark-fired] Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
