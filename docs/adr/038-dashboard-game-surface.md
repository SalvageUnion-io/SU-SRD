---
status: accepted
---

# ADR-038: The Dashboard Is a Game Surface with Shared Play State

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 38, which summarises it.

## Status

**Accepted; built.** Every decision below is in code; the Dashboard as built
is [dashboard.md](../architecture/dashboard.md).

**Amended by [ADR-045](045-dashboard-phone-form.md):** §3, §4 and §9 —
the phone form. Below the canvas's floor the slots become unit tabs, the
display's other tabs go behind a menu, and the rotate notice is retired.

§1's deferred Mediator Dashboard is built
([mediator-dashboard.md](../architecture/mediator-dashboard.md)): a
separate surface at `/mediator/$gameId` in ADR-021's Adjudicate mode. It
reuses §9's canvas and §7's instruments and writes nothing a player owns.

This is the one Dashboard decision record. **It supersedes [ADR-015](../ARCHITECTURE.md#decisions)**
and the five sub-decisions merged into it (ADRs 016–020): §6 to §9 restate the
ones that stand, Major and Minor slots replace the rotary Dial (§3), and play
state moves from the device onto the Game (§2).

**Also amends:**
- [ADR-030](030-accounts-games-server-of-record.md) §5: the table runner alone edits a Game's crawler.
  §6: crew status reaches the Dashboard as a Crew tab, not a dial item.
- [ADR-029](029-contribution-model.md) §4: activated
  effects resolve against the seat, not ephemeral play state.
- [ADR-034](../ARCHITECTURE.md#decisions)'s "What is not data": mount
  state is no longer a device preference.

The Dashboard is the Guided Play surface of [ADR-021](021-itun-surface-taxonomy.md)'s taxonomy, and
delivers part of its long-tail "shared, live Dashboard": each player's play
state is visible to the crew live. It does not put several players on one
screen.

## Context

ITUN's live sheet fuses two moments with opposite interaction grammars: editing
a character (inline edit and scroll) and running it at the table (one screen,
no scroll, every action a button). Forcing both into one surface produced
clutter, so the Dashboard was built as a surface of its own.

It was built for one player on one device. Its play state (boarded or not, the
range band, activated effects, the Downtime step) reset on reload and was
invisible to crewmates and to the same player's other devices. It launched
from the shelf and in anonymous play as readily as from a Game, and a rotary
Dial hid every entity but one, so a boarded player rotated it to check their
pilot's HP.

Since then, Games became the server of record (ADR-030). They have a Mediator
role, a shared Downtime row, crew vitals, proposals and alerts, and Convex as
the only persistence (ADR-034). The product owner wants the Dashboard to be a
curated, live game experience: an in-game sheet that puts every tool in reach,
reads at a glance and, eventually, syncs Mediator and player actions such as
Downtime steps.

## Decision

### 1. The Dashboard is Game-only and needs a Mediator

The Dashboard opens only for a pilot in a Game that has a Mediator. A solo
player can make themselves Mediator of their own Game. Shelf pilots, anonymous
sessions and Games with no Mediator get no Dashboard. Those players use the
live sheet, editing it by hand, including for Downtime. A disconnected session
keeps an open Dashboard read-only, as the sheets do. It launches
only from the Game hub, which asks just for the pilot.

The Dashboard is for pilots. A Mediator who plays a pilot uses it like anyone
else. A Mediator Dashboard is a separate, later decision.

### 2. Play state is a seat, saved on the Game

There is one **seat** per pilot in a Game, held in Convex. It records:

- **mount:** on foot, or boarded and in which mech;
- the **range band**;
- the **activated effects**;
- the **action being resolved**, so a reload mid-roll keeps it and the crew
  watches it step by step;
- whether the pilot **ejected**, until the next Board or Dismount.

Its rules:

- **It is keyed on the pilot, not the member.** ADR-030 §4 lets one member
  cover for an absent player, so one member can run two seats.
- **Only someone who may write the pilot writes the seat.** Boarding also
  needs write access to the mech, because playing a mech writes its Heat, EP
  and SP. The Mediator does not write seats. They propose, as everywhere else
  (ADR-030 §4).
- **Every member reads every seat.** A seat holds nothing a crewmate isn't
  entitled to see.
- **Mount never becomes a field on a pilot or mech.** It can't leak into sheets
  or public sheets. A seat is its own record that points at them.
- **"In Downtime" is not stored on the seat.** It comes from the Game's
  `downtime` row.
- **Rolls go to the Game's change log** as Game rows, the same form the Discord
  bot already writes, and the crew reads them as a log.

Only the arrangement of one player's screen stays on the device: the open tab,
deck filters, and open overlays and menus.

### 3. Major and Minor slots replace the Dial

The top of the Dashboard is one **Major** slot and two **Minor** slots. Who holds
Major follows the game, and nothing else moves the slots:

| When | Major | Minor | Minor |
| --- | --- | --- | --- |
| On foot | Pilot | Mech | Crawler |
| Boarded | Mech | Pilot | Crawler |
| Downtime | Crawler | Pilot | Mech |

- **A Major shows that entity's full controls.** Rarely used controls go in a
  narrow side column: the mech's Effects and Egress, and the crawler's Upkeep,
  Upgrade and Scrap a mech.
- **A Minor shows only what needs watching**, and more only when something is
  wrong.
- **⤢ opens any entity's full controls** without moving the slots.

Boarding is a split button: the main half boards the pilot's assigned mech, and
the menu lists every mech assigned to the pilot's crawler.

### 4. The display is tabbed, with Crew and Log

The display panel has Resolve, Reference, Tables and SRD as primary tabs, with
Log and Crew as secondary tabs.

- **Crew** shows every crewmate's pilot. It adds their mech's numbers when
  their seat says they're boarded, and it flags anyone who needs attention.
  The server derives those numbers and that status from the stored records,
  so every client agrees and nothing extra is stored.
- **Log** shows the Game's rolls and the Mediator's alerts.

### 5. Downtime follows the Game

The Mediator starts, advances and ends Downtime, as `downtime.begin`, `advance`
and `end` already allow. Every player's Dashboard follows: the Crawler takes
Major and the step guide replaces the action deck. Each player marks their own
step done. The Dashboard keeps no Downtime step of its own.

**A Game's crawler is the Mediator's.** Only the Mediator changes it, in
Downtime and out. That covers Salvage, Craft, Trade, Upkeep, Upgrade, damage
and Scrap a mech. Players see the crawler read-only and ask at the table. The
server enforces it (`assertMayEditCrawler`, `downtime.spendUpkeep`); with no
Mediator, the Organizer keeps it (`requireTableRunner`).

**Boarding never assigns.** Boarding a mech, a spare included, changes only the
seat, never the pilot's `mech-to-pilot` link.

### 6. A surface of its own, sharing the sheets' state

The Dashboard is its own surface at `/dashboard/$pilotId`, not a mode of the
live sheet. The sheets edit a character (Free Edit); the Dashboard runs it at
the table (Guided Play). Both read and write the **same** records through the
**same** store and rules engine ([ADR-006](../ARCHITECTURE.md#decisions), [ADR-003](../ARCHITECTURE.md#decisions)):
the Dashboard is a second lens, not a second source of truth. Every control
obeys [ADR-007](007-automation-boundary.md): non-destructive bookkeeping (EP, Heat, uses, SP)
auto-applies, and destructive change (destroying an item, Eject, meltdown) is
the player's confirmed act. A player never writes another player's state.

### 7. Reuse the SRD display; the instruments are bespoke

The display renders the same `component-lib` entity display the rest of the
app shows (`ReferenceEntityCard`, `RollTable`), with entity-level
interactivity passed as typed `controls`. Only the instruments (gauges, bays,
slots, buttons) are Dashboard components. One display system means one place
to fix reference rendering.

### 8. Flat and inset; only the display reads forward

Instrument surfaces read **recessed** (a mild inset shadow, soft
entity-tinted borders), and buttons are flat recessed keys. **The display is
the one element that reads forward** (a solid hard border, no inset). Hue
encodes ontology, never identity; state is a treatment overlay (hatch, strike,
redline), never a second hue.

### 9. A fixed 1280×800 canvas, scaled to fit

The Dashboard is a fixed 1280×800 design canvas scaled with one
`transform: scale(min(vw/1280, vh/800))` and letterboxed. "Always one screen,
never scrolls" is a **landscape-desktop contract**. Below a width threshold
the canvas is abandoned rather than shrunk illegibly, and that host gets the
phone form built from the same instruments ([ADR-045](045-dashboard-phone-form.md)), which
replaced the rotate-to-landscape notice.

## Alternatives rejected

- **A "play mode" toggle on the sheet.** The layouts are irreconcilable in one
  component.
- **A separate app.** It duplicates the data layer and breaks single-store
  consistency.
- **Keep play state on the device and broadcast it to the crew.** It would still
  be lost on reload and on a second device. It would also create a second source
  of truth beside Convex, which ADR-034 rules out.
- **One seat per member.** It breaks the moment a member covers a second pilot.
- **Mount as a field on the pilot or mech.** It would leak into sheets and
  public sheets.
- **Keep the Dashboard on the shelf and in solo play.** The product owner
  rejected this. The Dashboard is a curated live game, and the live sheet already
  serves solo play.
- **The Crawler always in a Minor slot.** During Downtime the crew acts through
  the crawler, so it takes Major.
- **A Dashboard-specific action renderer** that forks the display, rather than
  §7's reuse.
- **Skeuomorphic 3D dials, a CRT bend, per-source colour chips** that let hue
  mean identity, rather than §8.
- **A fluid responsive grid**, which cannot guarantee no-scroll, and scaling
  with no floor, which fights browser zoom and is illegible on phones, rather
  than §9.

## Consequences

- **Fewer people can use the Dashboard.** Anonymous visitors, shelf play and
  Games without a Mediator have none, as [data flow](../ARCHITECTURE.md#data-flow) and
  [combat loop](../ARCHITECTURE.md#combat) say.
- **There is server surface.** A `seats` table and its functions. Seats are
  cleaned up when a Game, pilot or account is deleted and when a pilot or mech
  leaves the Game. Every toggle is a mutation, so the client uses optimistic
  updates.
- **An open Dashboard subscribes to more.** It watches the seats, the Game's
  rolls and the Downtime row (ADR-030 counts an open Dashboard as a live
  subscription).
- **Styling** is style objects plus `.su-dash-*` state rules (ADR-046).
- **Players cannot edit a Game's crawler,** on the Dashboard or the sheet.
  Until players can send requests to the Mediator in the app, they ask at the
  table.
- **Convex has the rules package** for crew status. ADR-006's rule holds: the
  math stays in the package, and Convex calls it.
- **Follow-ups:** what "claiming" a crew asset means in a Game (#1064), and
  the bot reading server-derived crew status (#1068).
