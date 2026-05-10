// api/followups/schedule.js
// Called by browser after each AI reply to persist follow-up schedule to Supabase

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    charId,
    charConfig,
    contextMsg,
    systemPrompt,
    delayMs,
    followupIndex,
    relationship,
    personality,
    apiKey,
    model,
  } = req.body || {};

  if (!userId || !charId || !apiKey || !contextMsg) {
    return res.status(400).json({ error: 'Missing required fields: userId, charId, apiKey, contextMsg' });
  }

  if (typeof delayMs !== 'number' || delayMs <= 0) {
    return res.status(400).json({ error: 'Invalid delayMs' });
  }

  const scheduledAt = new Date(Date.now() + delayMs).toISOString();

  // Cancel any existing unfired follow-ups for this user+char
  // (user sent a new message or AI replied again)
  await supabase
    .from('followup_queue')
    .update({ fired: true, fired_by: 'cancelled', fired_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('char_id', charId)
    .eq('fired', false);

  // Insert new follow-up job
  const { data, error } = await supabase
    .from('followup_queue')
    .insert({
      user_id: userId,
      char_id: charId,
      char_config: charConfig || {},
      context_msg: contextMsg,
      system_prompt: systemPrompt || '',
      scheduled_at: scheduledAt,
      followup_index: followupIndex || 0,
      relationship: relationship || 'casual',
      personality: personality || 'caring',
      api_key: apiKey,
      openrouter_model: model || 'google/gemini-2.0-flash-001',
    })
    .select('id, scheduled_at')
    .single();

  if (error) {
    console.error('[schedule] Supabase insert error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ id: data.id, scheduledAt: data.scheduled_at });
}
