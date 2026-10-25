# ADR-038: The Dashboard Is a Game Surface with Shared Play State

Partly superseded by [ADR-051](051-play-mode.md): Play
([play.md](../architecture/play.md)) is [ADR-021](021-cantina-surface-taxonomy.md)'s
Guided Play surface, replacing the Dashboard and the Mediator Dashboard (now
Play's Mediator screen, `/play/game/$gameId`). ADR-051 supersedes §1
(Game-only), §3 (the Major and Minor slots), §4 (the tabbed display), §5's
layout sentence and §6's route, and amends §2 (solo seats, solo Downtime,
presence). §2's seat, §3's boarding menu, §4's server-derived crew numbers and
status, §5's crawler and boarding rules and §6 to §8 stand. §9's fixed scaled
canvas, and the phone form under it (ADR-045, retired), gave way in 4.5.0 to
Play's one layout, phone first (ADR-051 §2, §10).

### 1. The Dashboard is Game-only and needs a Mediator

It opens only for a pilot in a Game with a Mediator (a solo player can mediate
their own Game), launched from the Game hub. Shelf pilots, anonymous sessions
and Mediator-less Games use the live sheet, Downtime included. A disconnected
session keeps an open Dashboard read-only. The Mediator's own surface is
separate (Play's Mediator screen: [play.md](../architecture/play.md) §10).

### 2. Play state is a seat, saved on the Game

One **seat** per pilot in a Game, in Convex, recording the **mount** (on foot,
or boarded and in which mech), the **range band**, the **activated effects**,
the **action being resolved** (a reload mid-roll keeps it; the crew watches it)
and whether the pilot **ejected** (until the next Board or Dismount).

- **Keyed on the pilot, not the member**: one member may cover two seats.
- **Only someone who may write the pilot writes the seat**; boarding also needs
  write access to the mech. The Mediator proposes (ADR-030 §4), never writes seats.
- **Every member reads every seat.**
- **Mount never becomes a field on a pilot or mech**, so it cannot leak into
  sheets or public sheets.
- **"In Downtime" is not on the seat**: it is the Game's `downtime` row.
- **Rolls go to the Game's change log** as Game rows, the form the bot writes.

Only one screen's arrangement stays on the device: the open tab, deck filters,
open overlays and menus.

### 3. Major and Minor slots

One **Major** and two **Minor** slots; who holds Major follows the game, and
nothing else moves them:

| When | Major | Minor | Minor |
| --- | --- | --- | --- |
| On foot | Pilot | Mech | Crawler |
| Boarded | Mech | Pilot | Crawler |
| Downtime | Crawler | Pilot | Mech |

- **A Major shows full controls**; rare ones sit in a side column (the mech's
  Effects and Egress; the crawler's Upkeep, Upgrade and Scrap a mech).
- **A Minor shows only what needs watching**, and more only when something is wrong.
- **⤢ opens any entity's full controls** without moving the slots.

Boarding is a split button: the main half boards the pilot's assigned mech; the
menu lists every mech assigned to the pilot's crawler.

### 4. The display is tabbed, with Crew and Log

Primary tabs Resolve, Reference, Tables and SRD; secondary Log and Crew.
**Crew** shows every crewmate's pilot, their mech's numbers when boarded, and
who needs attention, all derived by the server from stored records. **Log**
shows the Game's rolls and the Mediator's alerts.

### 5. Downtime follows the Game

The Mediator starts, advances and ends Downtime (`downtime.begin`, `advance`,
`end`); every Dashboard follows (the Crawler takes Major, the step guide
replaces the deck), and each player marks their own step done.

**A Game's crawler is the Mediator's:** only the table runner changes it
(Salvage, Craft, Trade, Upkeep, Upgrade, damage, Scrap a mech), in Downtime and
out; players see it read-only. Enforced by `assertMayEditCrawler` and
`downtime.spendUpkeep`.

**Boarding never assigns:** it changes the seat, never the `mech-to-pilot` link.

### 6. A surface of its own, sharing the sheets' state

`/dashboard/$pilotId`, not a mode of the live sheet. Both read and write the
same records through the same store and rules engine. Bookkeeping auto-applies
and destruction is the player's confirmed act (ADR-007); a player never writes
another player's state.

### 7. Reuse the SRD display; the instruments are bespoke

The display renders the app's entity display (`ReferenceEntityCard`,
`RollTableInstrument`) with typed `controls`; only the instruments (gauges,
bays, slots, buttons) are Dashboard components.

### 8. Flat and inset; only the display reads forward

Instruments read **recessed** (mild inset shadow, soft entity-tinted borders);
buttons are flat recessed keys. **The display alone reads forward** (solid hard
border, no inset). Hue encodes ontology, never identity; state is a treatment
(hatch, strike, redline), never a second hue.

### 9. A fixed 1280×800 canvas, scaled to fit

Superseded by ADR-051 §2 and §10 (4.5.0): one layout that fills the window,
phone first. As decided: one `transform: scale(min(vw/1280, vh/800))`, the
canvas widened or lengthened to fill the other axis; "one screen, never
scrolls" a landscape-desktop contract, a phone form below the floor.

## Consequences

- A `seats` table, cleaned up when a Game, pilot or account is deleted and when
  a pilot or mech leaves the Game; every toggle is a mutation, applied optimistically.
- An open Dashboard subscribes to the seats, the Game's rolls and the Downtime row.
- Styling is style objects plus `.su-dash-*` state rules (ADR-046).
- Convex calls the rules package for crew status; the math stays in the package.
