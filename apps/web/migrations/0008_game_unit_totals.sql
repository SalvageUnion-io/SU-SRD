-- How many of each unit a Game holds, written with its row by its room's
-- publish: the daily snapshot sums them beside `account_totals`, so a unit
-- moved into a Game is still counted (ADR-057 §1).
alter table games add column pilots integer not null default 0;
alter table games add column mechs integer not null default 0;
alter table games add column crawlers integer not null default 0;
alter table games add column npcs integer not null default 0;
