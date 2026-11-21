-- What a Game says of itself, written with its row by its room's publish and
-- shown on its invite (ADR-067 §3). Null until its Organiser writes one.
alter table games add column description text;
