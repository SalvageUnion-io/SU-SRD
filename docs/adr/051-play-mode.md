# ADR-051: Play Is the Third Mode, Laid Out as a Cockpit

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 51, which summarises it.

## Status

**Accepted; built.** The work was the `dashboard-cockpit` milestone (tracker
issue #1633); Play as built is [play.md](../architecture/play.md), the
wireframes are in [`docs/wireframes/dashboard-cockpit/`](../wireframes/dashboard-cockpit/).

**Supersedes** [ADR-038](038-dashboard-game-surface.md) §1 (Game-only, needs a
Mediator) and its layout (Major and Minor slots, the display's tabs), and
[ADR-045](045-dashboard-phone-form.md)'s unit tabs. What they decided about
play state stands: the seat, the fixed scaled canvas, the rules driver and the
ADR-007 boundary.

**Amends** [ADR-030](030-accounts-games-server-of-record.md): a pilot on a
Shelf has a seat too (§4), seats carry presence (§7), and a Game can bind a
Discord channel again (§8).

In detail, from [ADR-038](038-dashboard-game-surface.md):

- **Superseded:** §1, Game-only (Play also runs solo, §4); §3, the Major and
  Minor slots (the units stand in one column, live or reference, §2 and §5);
  §4, the tabbed display (one Actions list, §6, beside Crew, Tables and Feed,
  §2); §5's layout sentence (Downtime no longer moves the crawler into Major
  or swaps the deck for the step guide); §6's route (Play replaces
  `/dashboard/$pilotId` and `/mediator/$gameId`).
- **Amended:** §2, a seat's Game is optional, a solo seat holds the solo
  Downtime, and every seat carries a presence heartbeat (§4, §7).
- **Kept:** §2, the seat as the home of play state (mount, range band,
  activated effects, the action being resolved, ejected), keyed on the pilot,
  written only by someone who may write the pilot and read by the crew, the
  Mediator proposing; §5's rules (a Game's crawler is the Mediator's, boarding
  never assigns); §6, one store and one rules engine behind the sheets and
  Play, and [ADR-007](007-automation-boundary.md)'s boundary; §7, the SRD
  display reused through typed `controls`; §8's materials (flat, hue is
  ontology, state is a treatment); §9, the fixed 1280×800 canvas, scaled and
  letterboxed.

From [ADR-045](045-dashboard-phone-form.md):

- **Superseded:** decisions 3 (unit tabs), 4 (resolving is a screen) and 5
  (the bar's menu); §10's four tabs replace them.
- **Kept:** decisions 1 (two forms over one surface, a form is only a
  renderer, the 0.62 threshold), 2 (same enforcement), 6 (Play draws its own
  bar) and 7 (browser zoom raises the floor).

## Context

The Dashboard and the Mediator dashboard grew one decision at a time: a
Game-only surface, slots placed by mount, a display of tabs, a separate phone
form, a separate Mediator canvas. The owner asked for a first-principles pass,
ignoring those layouts, against these goals:

- one view of pilot, mechs, crawler and the other players, solo and in a Game;
- a third mode beside Reference and Build;
- every action flattened into one view;
- the situation (boarded, on foot, Downtime) decides what is on hand, with the
  rest still reachable;
- tables that post their results to a Discord channel;
- one screen with no page scroll;
- stats managed for the active unit, reference for the inactive ones;
- Downtime managed in place, connection shown in a Game, and a Mediator version.

Three directions were drawn (Cockpit, Stage, Deck). The owner picked Cockpit
on 2026-10-17.

## Decision

### 1. Play is a mode

The site header offers Reference (the SRD), Build (the Cantina) and Play. Play
lands on `/build/play`: the player's Games (play or mediate), their pilots to
play solo, and each Game's Discord channel.

### 2. The Cockpit frame

One frame on the existing fixed, scaled canvas, never scrolling as a page: a
Play bar (back, the Game or "Solo", connection, the Situation switch, the
channel), then three columns: Units, Actions, and Crew, Tables and Feed. The
Situation changes what the middle column holds, never the frame.

### 3. Situation

On foot, Boarded (choosing among the pilot's mechs) or Downtime. On foot and
Boarded are the seat's mount. Downtime in a Game is the Game's `downtime` row,
started and ended by the Mediator only; solo, the player runs it.

### 4. Solo play has a seat

Play opens for any pilot its owner holds, in a Game or on the Shelf. A Shelf
pilot gets a solo seat keyed by the pilot (`seats.gameId` becomes optional),
holding the same mount, range, effects and resolve, plus its own Downtime step.
ADR-038 §1's requirement of a Game with a Mediator is lifted.

### 5. Live and reference units

A live unit shows − / + on every vital; a reference unit is read-only and
drawn dashed, with the one control that makes it live (Board). The pilot is
always live, a mech only while Boarded, the crawler in solo Downtime and always
for the Mediator. Sheets open as an overlay over Play; Build stays where
loadouts are edited.

### 6. One Actions list

Every action from pilot, mech and crawler is one list of Rows, sorted by action
type and filtered by type. What the Situation allows is On hand; the rest is a
collapsed Not on hand group that names what each needs. Boarded keeps the
pilot's own abilities and equipment on hand, as the deck already does. Using an
action resolves it inline in its Row (Activate, Roll, Push, Apply) on the
seat's `resolving`, replacing the Resolve tab.

### 7. Crew and presence

In a Game, the right column lists the other seats: presence, mount and the
vital that needs attention, each opening its sheet read-only. Presence is a
heartbeat on the seat (`lastSeenAt`), not a new table. The trade-off: each
beat re-runs the Game's seat queries (`seats.forGame`, `crew.vitals`), which
the server throttles to one write per 20 s per player. Disconnected and
Outdated keep their read-only behaviour.

### 8. Tables post to Discord

`/su bind`, run in a channel, binds it to a Game (by its Mediator or
Organizer) or to the caller for solo play, stored in `channelBindings`, which
is kept rather than emptied by `invites.dropRetired`. Rolls made in Play post
there as the bot's table card, with one toggle per screen and a per-roll
override; the Mediator's default is private.

### 9. The Mediator uses the same frame

The Mediator's Play turns the frame to the table: seats in the left column,
Opposition and the chosen NPC's flattened actions in the middle (the Downtime
step track in Downtime), Tables, Feed and the propose dock on the right, and a
Scene / Downtime switch in the Play bar.

### 10. Phones get tabs, not a second layout

Below the canvas's floor, Play is four tabs (Act, Units, Tables, Crew) under
pinned live vitals and the Situation switch; the Mediator's are Table,
Opposition, Tables and Propose. Only the open tab's list scrolls.

### 11. Play follows the Nested Frames Audit

The audit, decided on 2026-10-17, sets how deep boxes may nest; Play is the
first surface built to it from the start. Its rules are now the canon's
nesting rules N1–N7 (ruleset §5, the entity display language's E3, E6 and
E18), with their gates; Play adds only where its own frames sit in them:

1. **Level 0 is the Play canvas**, a dialog or an overlay (N1). What sits
   directly in a column is level 1: a compact Row or Card, or a unit
   `TitledBox`; what is inside one of those is level 2 (Tokens, N3–N4, or
   plain content).
2. **Column headings are plain titles or Slabs** (stamp and leader rule), not
   TitledBoxes, so what a column holds stays at level 1.
3. **A section inside an entity box is a Slab over plain content** (N5): a
   step's "Will apply" list, the resolve steps inside an action Row.

## Consequences

- `/build/dashboard/$pilotId` and `/build/mediator/$gameId` redirect into
  Play once it covers them, and their slot, frame and tab components go.
- The seat schema changes (optional `gameId`, solo Downtime, `lastSeenAt`), and
  the bot gains a write path to Discord channels.
- Downtime has one surface for players and Mediators instead of the wizard and
  the Mediator's minor.
