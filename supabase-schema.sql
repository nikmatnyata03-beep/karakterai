-- ============================================================
-- NeuralChat — Supabase Schema v2
-- Tambahan: voice_agents table untuk menyimpan ElevenLabs Agent ID
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- (Tabel lama tetap sama)
create table if not exists followup_queue (
  id            uuid        default gen_random_uuid() primary key,
  user_id       text        not null,
  char_id       text        not null,
  char_config   jsonb       not null,
  context_msg   text        not null,
  system_prompt text        not null default '',
  scheduled_at  timestamptz not null,
  followup_index int        not null default 0,
  relationship  text        not null default 'casual',
  personality   text        not null default 'caring',
  api_key       text        not null,
  openrouter_model text     not null default 'google/gemini-2.0-flash-001',
  fired         boolean     not null default false,
  fired_by      text        default null,
  result_msg    text        default null,
  fired_at      timestamptz default null,
  created_at    timestamptz default now()
);

create index if not exists idx_followup_queue_due
  on followup_queue (fired, scheduled_at)
  where fired = false;

create index if not exists idx_followup_queue_user_char
  on followup_queue (user_id, char_id);

create table if not exists delivered_followups (
  id        uuid        default gen_random_uuid() primary key,
  user_id   text        not null,
  char_id   text        not null,
  messages  jsonb       not null,
  delivered boolean     not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_delivered_followups_pending
  on delivered_followups (user_id, char_id, delivered)
  where delivered = false;

create table if not exists push_subscriptions (
  id           uuid        default gen_random_uuid() primary key,
  user_id      text        not null unique,
  subscription jsonb       not null,
  updated_at   timestamptz default now()
);

-- ============================================================
-- BARU: voice_agents — menyimpan ElevenLabs Agent ID per user
-- Digunakan sebagai backup cloud untuk daftar agent yang
-- tersimpan di localStorage (nc-agents), sehingga sinkron
-- lintas perangkat.
-- ============================================================
create table if not exists voice_agents (
  id          uuid        default gen_random_uuid() primary key,
  user_id     text        not null,
  agent_id    text        not null,           -- ElevenLabs agent_xxx...
  agent_name  text        not null default '',
  created_at  timestamptz default now(),
  unique (user_id, agent_id)
);

create index if not exists idx_voice_agents_user
  on voice_agents (user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table followup_queue      disable row level security;
alter table delivered_followups disable row level security;
alter table push_subscriptions  disable row level security;
alter table voice_agents        disable row level security;

-- ============================================================
-- OPTIONAL: API endpoint helper view
-- Menampilkan agent list per user dengan format ringkas
-- ============================================================
create or replace view voice_agents_summary as
  select
    user_id,
    json_agg(
      json_build_object('id', agent_id, 'name', agent_name, 'savedAt', created_at)
      order by created_at desc
    ) as agents
  from voice_agents
  group by user_id;

-- ============================================================
-- Cleanup (opsional, jalankan manual atau via pg_cron):
-- DELETE FROM followup_queue WHERE fired = true AND created_at < now() - interval '7 days';
-- DELETE FROM delivered_followups WHERE delivered = true AND created_at < now() - interval '3 days';
-- ============================================================
