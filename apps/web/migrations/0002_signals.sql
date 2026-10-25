-- The site's usage signals and feedback (ADR-057): counts, never who.

-- A weekly tally per signal: `downtime:game`, `downtime:solo`, `bot:<command>`.
-- A week is keyed by its Monday 00:00 UTC.
create table usage_counts (
  key text not null,
  week_start integer not null,
  count integer not null,
  primary key (key, week_start)
);
create index usage_counts_by_week on usage_counts (week_start);

-- The Discord servers the bot has answered a command in: a server's id, never a member's.
create table bot_guilds (
  guild_id text primary key,
  first_seen_at integer not null,
  last_seen_at integer not null
);

-- One account's totals, written by its account room when they change: the
-- daily snapshot sums them, so no read walks the rooms.
create table account_totals (
  account_id text primary key,
  pilots integer not null default 0,
  mechs integer not null default 0,
  crawlers integer not null default 0,
  npcs integer not null default 0,
  patterns integer not null default 0,
  updated_at integer not null
);

-- A daily snapshot of the totals; the newest is the one read.
create table metrics_snapshots (
  taken_at integer primary key,
  counts text not null
);

-- Feedback on its way to a labelled GitHub issue. The text is cleared once
-- filed; the row stays a day so the per-sender limit can count it.
create table feedback (
  id integer primary key autoincrement,
  sender text not null,
  source text not null,
  kind text not null,
  text text,
  page text,
  created_at integer not null,
  issue integer,
  attempts integer not null default 0,
  filing_since integer
);
create index feedback_by_sender on feedback (sender, created_at);
create index feedback_by_created on feedback (created_at);
