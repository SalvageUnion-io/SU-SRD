# ADR-051: Play Is the Third Mode, Laid Out as a Cockpit

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 51, which summarises it.

## Status

**Accepted; not built.** The work is the `dashboard-cockpit` milestone (tracker
issue #1633); the design is [play.md](../architecture/play.md), the
wireframes are in [`docs/wireframes/dashboard-cockpit/`](../wireframes/dashboard-cockpit/).

**Supersedes** [ADR-038](038-dashboard-game-surface.md) §1 (Game-only, needs a
Mediator) and its layout (Major and Minor slots, the display's tabs), and
[ADR-045](045-dashboard-phone-form.md)'s unit tabs. What they decided about
play state stands: the seat, the fixed scaled canvas, the rules driver and the
ADR-007 boundary.

**Amends** [ADR-030](030-accounts-games-server-of-record.md): a pilot on a
Shelf has a seat too (§4), seats carry presence (§7), and a Game can bind a
Discord channel again (§8).

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
heartbeat on the seat (`lastSeenAt`), not a new table. Disconnected and
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

## Consequences

- `/build/dashboard/$pilotId` and `/build/mediator/$gameId` redirect into
  Play once it covers them, and their slot, frame and tab components go.
- The seat schema changes (optional `gameId`, solo Downtime, `lastSeenAt`), and
  the bot gains a write path to Discord channels.
- Downtime has one surface for players and Mediators instead of the wizard and
  the Mediator's minor.
