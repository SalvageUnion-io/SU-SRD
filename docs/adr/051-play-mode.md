# ADR-051: Play Is the Third Mode, Laid Out as a Cockpit

Built: the `dashboard-cockpit` milestone (tracker #1633); Play as built is
[play.md](../architecture/play.md), wireframes
[`docs/wireframes/dashboard-cockpit/`](../wireframes/dashboard-cockpit/).

- **Supersedes** [ADR-038](038-dashboard-game-surface.md) §1 (Game-only; Play
  also runs solo, §4), §3's Major and Minor slots (one Units column, §2, §5),
  §4's tabbed display (one Actions list, §6), §5's layout sentence and §6's
  route (Play replaces `/dashboard/$pilotId` and `/mediator/$gameId`), and
  amends its §2: a seat's Game is optional, a solo seat holds the solo
  Downtime, and every seat carries a presence heartbeat (§4, §7). ADR-038's
  seat (§2), boarding menu (§3), server-derived crew data (§4), crawler and
  boarding rules (§5), one store and rules engine under the ADR-007 boundary
  (§6), reused SRD display (§7), materials (§8) and fixed scaled canvas (§9)
  stand.
- **Supersedes** [ADR-045](045-dashboard-phone-form.md)'s decisions 3, 4 and 5
  (§10's tabs replace them); decisions 1, 2, 6 and 7 stand.
- **Amends** [ADR-030](030-accounts-games-server-of-record.md) (§4, §7, §8 below).
- **Amended by** [ADR-052](052-build-assets-play-games.md): the landing is the
  hub for Games (§1).

### 1. Play is a mode

The site header offers Reference, Build and Play. Play lands on `/build/play`,
the hub for Games ([ADR-052](052-build-assets-play-games.md) §4): the player's
Games (play or mediate) and New Game and Join, their pilots to play solo, and
each Game's Discord channel; each Game's page is Play's too. Players know Play
as **The Cantina**, the crawler's social hub, and Build as the **Training
Bay**: the tabs keep the verbs, the names go on the pages, and the bar wears the page's
band, or, with none, its area's (Build pilot orange, Play the deep crawler pink). "The Cantina" names Play alone, never the whole app.

### 2. The Cockpit frame

One frame on the fixed, scaled canvas, never scrolling as a page: a Play bar
(back, the Game or "Solo", connection, the Situation switch, the channel), then
three columns: Units, Actions, and Crew, Tables and Feed. The Situation changes
what the middle column holds, never the frame.

### 3. Situation

On foot, Boarded (choosing among the pilot's mechs) or Downtime. On foot and
Boarded are the seat's mount. Downtime in a Game is the Game's `downtime` row,
Mediator-only; solo, the player runs it.

### 4. Solo play has a seat

Play opens for any pilot its owner holds. A Shelf pilot gets a solo seat keyed
by the pilot (`seats.gameId` optional), with the same mount, range, effects and
resolve, plus its own Downtime step.

### 5. Live and reference units

A live unit shows − / + on every vital; a reference unit is read-only, dashed,
with the one control that makes it live (Board). The pilot is always live, a
mech only while Boarded, the crawler in solo Downtime and always for the
Mediator. Sheets open as an overlay; Build stays where loadouts are edited.

### 6. One Actions list

Every action from pilot, mech and crawler is one list of Rows, sorted and
filtered by action type. What the Situation allows is On hand; the rest is a
collapsed Not on hand group naming what each needs. Boarded keeps the pilot's
own abilities and equipment on hand. An action resolves inline in its Row
(Activate, Roll, Push, Apply) on the seat's `resolving`.

### 7. Crew and presence

In a Game the right column lists the other seats: presence, mount and the vital
needing attention, each opening its sheet read-only. Presence is a heartbeat on
the seat (`lastSeenAt`); each beat re-runs the Game's seat queries
(`seats.forGame`, `crew.vitals`), so the server takes one write per 20 s per
player. Disconnected and Outdated stay read-only.

### 8. Tables post to Discord

`/su bind` binds a channel to a Game (by its Mediator or Organizer) or to the
caller for solo play, in `channelBindings` (kept by `invites.dropRetired`).
Rolls made in Play post there as the bot's table card: one toggle per screen, a
per-roll override, the Mediator private by default.

### 9. The Mediator uses the same frame

Seats left; Opposition and the chosen NPC's actions centre (the Downtime step
track in Downtime); Tables, Feed and the propose dock right; a Scene / Downtime
switch in the Play bar.

### 10. Phones get tabs, not a second layout

Below the canvas's floor, its 1280 × 800 design size on either axis (the
canvas never scales down, so no text draws under 11px: ADR-045 decision 1 as
tracker #1700 decision 6 amends it), Play is four tabs (Act, Units, Tables,
Crew; the Mediator's Table, Opposition, Tables, Propose) under pinned live
vitals and the Situation switch. Only the open tab's list scrolls.

### 11. Play follows the nesting rules

Play sits in the canon's nesting rules N1–N7 (ruleset §5; the entity display
language's E3, E6 and E18) and their gates. Its own frames place as follows:

1. **Level 0 is the Play canvas**, a dialog or an overlay (N1). What sits
   directly in a column is level 1: a compact Row or Card, or a unit
   `TitledBox`; what is inside one of those is level 2 (Tokens, N3–N4, or
   plain content).
2. **Column headings are plain titles or Slabs** (stamp and leader rule), not
   TitledBoxes, so what a column holds stays at level 1.
3. **A section inside an entity box is a Slab over plain content** (N5): a
   step's "Will apply" list, the resolve steps inside an action Row.

## Consequences

- `/build/dashboard/$pilotId` and `/build/mediator/$gameId` redirect into Play.
- A seat has an optional `gameId`, solo Downtime and `lastSeenAt`; the bot has a
  write path to Discord channels.
- Downtime has one surface for players and Mediators.
