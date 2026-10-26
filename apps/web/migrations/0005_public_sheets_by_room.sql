-- Which room wrote each public sheet: `account:<discord id>` or `game:<game id>`.
-- A room rewrites all of its rows at once and deletes the ones it no longer
-- holds by this column, so a unit that moved rooms keeps the row its new room wrote.
alter table public_sheets add column room text;
create index public_sheets_by_room on public_sheets (room);
