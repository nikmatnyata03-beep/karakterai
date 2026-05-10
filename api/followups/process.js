// api/followups/process.js
// CRON JOB — runs every minute via Vercel Cron
// Checks for due follow-ups → generates message → saves to DB → sends push notification

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configure web-push VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@neuralchat.app'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─── Helpers ────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

const PERSONALITY_MAP = {
  curious: 'Kamu sangat penasaran dengan jawaban user. Kirim follow-up singkat yang penuh rasa ingin tahu, mungkin ulangi pertanyaan dengan cara berbeda atau tunjukkan keingintahuan.',
  caring:  'Kamu peduli dan khawatir karena user belum balas. Kirim pesan perhatian yang warm dan genuine, tanya kabarnya atau apakah baik-baik saja.',
  clingy:  'Kamu kangen dan tidak sabar menunggu. Kirim pesan yang sedikit manja, antusias, mungkin kirim 2 pesan pendek berturut-turut dipisah dengan [SPLIT].',
  chill:   'Kamu santai tapi tetap mau follow-up. Kirim pesan ringan, casual, mungkin ganti topik atau bercanda.',
};

const RELATIONSHIP_MAP = {
  pacar:   'Kamu adalah pacar user. Gunakan bahasa intim, sayang, penuh kasih sayang tapi tetap natural.',
  sahabat: 'Kamu sahabat dekat user. Bahasa santai, akrab, seperti teman lama.',
  casual:  'Kamu kenalan/teman biasa user. Bahasa sopan tapi tetap friendly.',
};

const FOLLOWUP_ORDER = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima'];

async function generateFollowUpMessage(item) {
  const {
    char_config,
    context_msg,
    system_prompt,
    followup_index,
    relationship,
    personality,
    api_key,
    openrouter_model,
  } = item;

  const orderStr = FOLLOWUP_ORDER[followup_index] || 'lanjutan';
  const relText  = RELATIONSHIP_MAP[relationship] || RELATIONSHIP_MAP.casual;
  const persText = PERSONALITY_MAP[personality]   || PERSONALITY_MAP.caring;

  const sysPrompt = `${system_prompt || 'Kamu adalah AI yang ramah.'}

SITUASI: Ini adalah follow-up ${orderStr}mu. User sudah beberapa waktu tidak membalas pesanmu.
${relText}
${persText}

ATURAN PENTING:
- Pesan HARUS pendek (1-3 kalimat maksimal)
- Jangan spam atau terkesan desperado
- Tetap dalam karakter, natural, seperti chat manusia asli
- Jangan menyebut dirimu AI
- Variasikan gaya dengan follow-up sebelumnya
- Gunakan bahasa Indonesia casual (atau sesuai karakter)
- Jika mau kirim 2 pesan, pisahkan dengan [SPLIT]
- Contoh split: "Eh kamu kemana?" [SPLIT] "Kangen tau 🥺"`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${api_key}`,
      'Content-Type': 'application/json',
      'X-Title': 'NeuralChat',
      'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://neuralchat.app',
    },
    body: JSON.stringify({
      model: openrouter_model || 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system',    content: sysPrompt },
        { role: 'assistant', content: context_msg },
        { role: 'user',      content: `[SYSTEM: Saatnya kirim follow-up ${orderStr}. Generate pesan follow-up sekarang dalam karakter.]` },
      ],
      temperature: 0.9,
      max_tokens: 200,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function sendPushNotification(userId, charName, firstLine) {
  const { data: subRow } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single();

  if (!subRow?.subscription) return false;

  const preview = firstLine.length > 70 ? firstLine.slice(0, 70) + '…' : firstLine;

  try {
    await webpush.sendNotification(
      subRow.subscription,
      JSON.stringify({
        title: `${charName} mengirim pesan 💬`,
        body: preview,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: `followup-${userId}`,
        renotify: true,
        data: { charId: subRow.char_id },
      })
    );
    return true;
  } catch (err) {
    console.warn('[push] Send failed for user', userId, err.statusCode || err.message);
    // Remove stale/expired subscription (410 = Gone)
    if (err.statusCode === 410 || err.statusCode === 404) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    }
    return false;
  }
}

// ─── Main handler ────────────────────────────────────────────

export default async function handler(req, res) {
  // Vercel automatically sets CRON_SECRET and passes it as Bearer token
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date().toISOString();

  // Fetch all due, unfired follow-ups (max 20 per run to stay within timeout)
  const { data: items, error: fetchError } = await supabase
    .from('followup_queue')
    .select('*')
    .eq('fired', false)
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (fetchError) {
    console.error('[cron] Supabase fetch error:', fetchError);
    return res.status(500).json({ error: fetchError.message });
  }

  if (!items?.length) {
    return res.status(200).json({ processed: 0, message: 'No follow-ups due' });
  }

  const results = [];

  for (const item of items) {
    const itemId = item.id;
    const userId = item.user_id;
    const charId = item.char_id;
    const charName = item.char_config?.name || 'Karakter';

    try {
      // ── Step 1: Atomically claim the item ──────────────────
      // Only proceed if we successfully mark it (prevents race conditions)
      const { data: claimed, error: claimError } = await supabase
        .from('followup_queue')
        .update({
          fired: true,
          fired_by: 'cron',
          fired_at: now,
        })
        .eq('id', itemId)
        .eq('fired', false)   // conditional update — only if still unfired
        .select('id')
        .single();

      if (claimError || !claimed) {
        // Already fired by browser — skip
        results.push({ id: itemId, skipped: true, reason: 'already_fired' });
        continue;
      }

      // ── Step 2: Generate follow-up message ─────────────────
      const rawContent = await generateFollowUpMessage(item);
      if (!rawContent) {
        results.push({ id: itemId, ok: false, reason: 'empty_response' });
        continue;
      }

      // ── Step 3: Split into multiple bubbles if [SPLIT] ─────
      const parts = rawContent.split('[SPLIT]').map(p => p.trim()).filter(Boolean);
      const messages = parts.map(p => ({
        id: generateId(),
        role: 'ai',
        content: p,
        timestamp: Date.now(),
        isFollowUp: true,
        fromCron: true,
      }));

      // ── Step 4: Save to delivered_followups ────────────────
      const { error: deliverError } = await supabase
        .from('delivered_followups')
        .insert({ user_id: userId, char_id: charId, messages });

      if (deliverError) {
        console.error('[cron] delivered_followups insert error:', deliverError);
      }

      // ── Step 5: Save result_msg back to queue ──────────────
      await supabase
        .from('followup_queue')
        .update({ result_msg: rawContent })
        .eq('id', itemId);

      // ── Step 6: Send push notification ─────────────────────
      const pushSent = await sendPushNotification(userId, charName, parts[0]);

      results.push({ id: itemId, charId, ok: true, parts: parts.length, pushSent });

    } catch (err) {
      console.error('[cron] Error processing item', itemId, err);
      results.push({ id: itemId, ok: false, error: err.message });
    }
  }

  return res.status(200).json({
    processed: results.length,
    ok:        results.filter(r => r.ok).length,
    skipped:   results.filter(r => r.skipped).length,
    results,
  });
}
