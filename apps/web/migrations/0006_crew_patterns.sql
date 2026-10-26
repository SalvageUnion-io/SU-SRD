-- A pattern its maker shared with one Game's crew (ADR-032 §7), written by
-- the maker's account room. A crewmate reads the rows of the Games they are
-- in (`memberships`); sharing it more widely, or keeping it private, deletes it.
create table crew_patterns (
  app_id text primary key,
  owner_id text not null,
  game_id text not null,
  body text not null,
  made_by text not null,
  shared_at integer
);
create index crew_patterns_by_game on crew_patterns (game_id);
create index crew_patterns_by_owner on crew_patterns (owner_id);
