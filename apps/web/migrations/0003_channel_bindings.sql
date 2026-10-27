-- Discord channel bindings (`/su bind`): the channel Play's rolls post to.
-- A binding names a Game, or no Game for one account's solo play. A channel
-- holds one binding, a Game is bound to one channel, and an account's solo
-- play to one.
create table channel_bindings (
  channel_id text primary key,
  game_id text unique,
  bound_by text not null,
  channel_name text,
  bound_at integer not null
);
create unique index channel_bindings_solo on channel_bindings (bound_by) where game_id is null;
