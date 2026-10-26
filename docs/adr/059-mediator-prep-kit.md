# ADR-059: The Mediator's Prep Kit, Encounters on the Shelf

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
notes. The shelf has + New encounter, Make a copy and Delete. The page is a
Live Sheet like a built NPC's (hard rule R11): the Denizens band, Read | Edit
and Delete under "⋯" in its corner. Read leaves empty sections out; a new
encounter opens in Edit.

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

### 5. Groups, waves and a briefing

Amended for the Encounters build-out (behind the `encounterSheet` flag,
ADR-060). The book rolls Reaction for a group the Pilots meet and checks a
group's Morale when half of it falls (Core Book p.267–268), and asks the
Mediator to be upfront about the situation (p.252).

- **Groups.** An encounter may split its opposition into up to 12 named
  groups; an opponent is in one group or fights alone. Removing a group keeps
  its opponents.
- **Waves.** Each group arrives in wave 1 (with the encounter) or is held back
  to wave 2 or 3. Running fields the first wave; the rest wait on the running
  encounter, and each held-back wave has Bring in on the Opposition, which
  fields it named apart. Nothing arrives on its own.
- **Groups on the tray.** A fielded opponent carries its group's id and name,
  so the group sits together on the Opposition after End too. Its Slab has one
  Reaction and one Morale roll, kept on each member still standing.
- **Morale due.** A chip, with Roll, when the book calls for a check (p.268):
  a Mech or Creature at half its SP or HP, or a group half down, with no
  Morale roll since. Never rolled for the Mediator (ADR-007).
- **Briefing.** Up to 1,000 characters of what the Pilots see, apart from the
  private notes. Running copies it to the Game's running encounter, where the
  Mediator's side column shows it with Tell the table, which sends it as an
  alert. Nothing reaches a player until the Mediator presses it.
- **Threat read.** Under the opposition, the inputs p.255 eyeballs a fight
  by, against a crew size and Tech Level the Mediator steps (remembered on the
  device, never saved to the encounter): how many meet the Pilots first, how
  many are held back, the Tech Level spread, total SP and HP, and whether
  either side is outnumbered or out-teched. No difficulty score: the book says
  fights are not balanced.
- **Spoils.** A read-only list of what could be salvaged: each Mech's Chassis
  Salvage Value and the Systems and Modules it was drawn with (its "loot
  table", p.269), and each Vehicle or Meld's Salvage Value in Scrap (p.246).
  Only what the reference data states; nothing pays out from it.
- **Additive.** `groups`, `groupId` and `briefing` are optional on
  `schemaVersion` 1, so an encounter built before them reads as ungrouped with
  no briefing. A tray NPC's `group` and the running encounter's `groups` and
  `held` are optional too; a run without waves fields everyone, ungrouped.
- **Offline.** `shelf.encounters` is saved to the device copy (ADR-058), so an
  offline reload still has the Mediator's prep, read-only.
