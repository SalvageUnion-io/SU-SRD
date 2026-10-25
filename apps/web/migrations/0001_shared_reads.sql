-- What crosses rooms: the reads no one room can answer. Rooms write
-- these rows when the thing changes (src/worker/shared/); the Worker only
-- reads them. A body here is a copy of a room's snapshot, never the record.

-- One row per thing shared by link (ADR-032): a pilot, mech, crawler, NPC or
-- mech pattern. Unsharing deletes the row, so a private thing reads as a
-- missing one. `page` is what its /p/ page serves a stranger, `preview` what
-- its link preview says.
create table public_sheets (
  kind text not null,
  app_id text not null,
  owner_id text,
  page text not null,
  preview text not null,
  created_at integer not null,
  updated_at integer not null,
  primary key (kind, app_id)
);
create index public_sheets_by_owner on public_sheets (owner_id);

-- Homebrew (ADR-061): a pattern shared by link and on the Reference.
create table homebrew_patterns (
  app_id text primary key,
  owner_id text not null,
  chassis_ref text,
  name text not null,
  body text not null,
  made_by text not null,
  shared_at integer
);
create index homebrew_patterns_by_shared on homebrew_patterns (shared_at desc);
create index homebrew_patterns_by_chassis on homebrew_patterns (chassis_ref, shared_at desc);

-- A pattern's moderation, kept when it is unshared: hiding outlives sharing again.
create table homebrew_moderation (
  app_id text primary key,
  hidden integer not null default 0,
  hidden_at integer
);
create index homebrew_moderation_by_hidden on homebrew_moderation (hidden, hidden_at desc);

-- One report per reader per pattern; reporting again replaces the reason.
create table homebrew_reports (
  app_id text not null,
  reporter_id text not null,
  reason text not null,
  at integer not null,
  primary key (app_id, reporter_id)
);
create index homebrew_reports_by_reporter on homebrew_reports (reporter_id);

-- A Game as other rooms and the Worker see it: its name and who mediates.
create table games (
  game_id text primary key,
  name text not null,
  mediated_by text,
  updated_at integer not null
);

-- Who is in which Game: an account room lists its Games from here.
create table memberships (
  game_id text not null,
  account_id text not null,
  mediator integer not null default 0,
  organizer integer not null default 0,
  primary key (game_id, account_id)
);
create index memberships_by_account on memberships (account_id);

-- A Game's current invite code; resetting it replaces the row.
create table invites (
  code text primary key,
  game_id text not null unique,
  created_at integer not null
);
