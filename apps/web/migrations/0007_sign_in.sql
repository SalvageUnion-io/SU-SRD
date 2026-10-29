-- Accounts and sessions, as sign-in keeps them (src/worker/auth/store.ts).
-- A database made before this migration has them already (sign-in once made
-- them on first use), so each is `if not exists`; a later column is an
-- `alter table` of its own.
--
-- An account's id is made on its first sign-in and found again by how it
-- signs in: `discord_id`, or `test_email` where `TEST_AUTH` allows the test
-- seam. `name` and `avatar_url` are Discord's, refreshed by every sign-in.
-- `display_name` is written by nothing: the player's own name and avatar
-- are their account room's (`AccountRoom.profile`).
create table if not exists accounts (
  account_id text primary key,
  discord_id text unique,
  test_email text unique,
  name text,
  display_name text,
  avatar_url text,
  email text,
  secret text,
  created_at integer not null,
  updated_at integer not null
);

-- A session is a random token in an HttpOnly cookie; this keeps only its
-- SHA-256, so a read of the database signs nobody in.
create table if not exists sessions (
  id text primary key,
  account_id text not null references accounts(account_id) on delete cascade,
  expires_at integer not null
);
create index if not exists sessions_by_account on sessions(account_id);
