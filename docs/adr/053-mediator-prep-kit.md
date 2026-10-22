# ADR-053: The Mediator's Prep Kit, Encounters on the Shelf

Decided and built for 4.1.0. Jrvs chose encounters on the Mediator's own shelf
over a session plan per Game. Play's side is [play.md](../architecture/play.md) §10.

- **Amends** [ADR-052](052-build-assets-play-games.md) §1: the Training Bay
  gains an Encounters shelf, owned like Patterns and NPCs.

### 1. An encounter is its maker's

An encounter is a name, an opposition (up to 40 NPCs, Mechs, Squads and
Creatures drawn with the Opposition's own picker), up to 12 roll tables by name
and private notes. It lives in `encounters`, keyed by owner and app id, and is
never shared: no Game, no player and no other Mediator reads it. Export takes it
and account deletion deletes it.

### 2. Built in the Training Bay

`/build/encounters/$id` edits one: name, opposition (+ Add, Rename, Remove),
tables to hand (pin from the core tables; the site has no custom ones) and
notes. The shelf has + New encounter, Make a copy and Delete.

### 3. Run from a Game's Play

The Mediator's Opposition has Run an encounter: pick one of yours, then add to
the tray or clear it first (the dialog counts what clearing removes, ADR-007).
`mediator.runEncounter` copies the opposition onto the tray at full HP or SP,
named apart, and writes the Game's one `runningEncounters` row: name, tables
and notes. The saved encounter never changes. One runs at a time; running
another replaces it. End stops it and leaves the Opposition where it is.

### 4. Running is as secret as the tray

The running row is read only through `requireMediator`. Its notes show beside
the Mediator's Tables, its tables lead the Tables list, and nothing reaches the
players unless the Mediator posts a roll. Deleting the Game deletes it.
