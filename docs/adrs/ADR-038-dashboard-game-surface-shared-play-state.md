# ADR-038: The Dashboard Is a Game Surface with Shared Play State

## Status

**Accepted; partly built.** Decision 1, the Game-only gate, is built. The plan
that delivers the rest, layer by layer, is
[dashboard-redesign.md](../architecture/dashboard-redesign.md), tracked in the
[Dashboard Redesign milestone](https://github.com/SalvageUnion-io/SU-SRD/milestone/7). Until its layers
land, the rest of the Dashboard in code is the one [ADR-015](ADR-015-dashboard-distinct-play-surface.md)
and [dashboard.md](../architecture/dashboard.md) describe.

**Amends [ADR-015](ADR-015-dashboard-distinct-play-surface.md):**
- It replaces Dashboard decision 1 (the rotary Dial).
- It reverses decision 4's ephemeral play state. The other half of decision 4
  stands: mount state never becomes a field on a pilot or mech record.
- Decisions 2, 3 and 5 are unchanged.

**Also amends:**
- [ADR-030](ADR-030-accounts-games-server-of-record.md) §6: crew status
  reaches the Dashboard as a Crew tab, not a dial item.
- [ADR-029](ADR-029-contribution-model-and-stat-provenance.md) §4: activated
  effects resolve against the seat, not ephemeral play state.
- [ADR-034](ADR-034-account-required-persistence.md)'s "What is not data": mount
  state is no longer a device preference.

It delivers part of [ADR-021](ADR-021-itun-surface-taxonomy.md)'s long-tail
"shared, live Dashboard": each player's play state is visible to the crew live.
It does not put several players on one screen.

## Context

The Dashboard (ADR-015) was built for one player on one device:

- Its play state lives in `playStateStore`, which is not persisted and resets
  on reload. That covers whether the pilot is boarded, the range band, activated
  effects and the Downtime wizard's step. A player's crewmates can't see any of
  it, and neither can the same player on another device.
- It launches from the shelf and in anonymous play as readily as from a Game.
  Its Downtime wizard keeps its own step, unrelated to the Game's `downtime`
  row that the Mediator advances.
- The rotary Dial puts one entity in front and hides the others behind a
  rotation. During combat, a player has to rotate the Dial to check their
  pilot's HP while boarded.

Since then, Games became the server of record (ADR-030). They have a Mediator
role, a shared Downtime row, crew vitals, proposals and alerts, and Convex as
the only persistence (ADR-034). The product owner wants the Dashboard to be a
curated, live game experience: an in-game sheet that puts every tool in reach,
reads at a glance and, eventually, syncs Mediator and player actions such as
Downtime steps. Wireframes for this were reviewed on 2026-10-06; the plan links
them.

## Decision

### 1. The Dashboard is Game-only and needs a Mediator

The Dashboard opens only for a pilot in a Game that has a Mediator. A solo
player can make themselves Mediator of their own Game. Shelf pilots, anonymous
sessions and Games with no Mediator get no Dashboard. Those players use the
live sheet, editing it by hand, including for Downtime. A disconnected session
keeps an open Dashboard read-only, as the sheets do.

The Dashboard is for pilots. A Mediator who plays a pilot uses it like anyone
else. A Mediator Dashboard is a separate, later decision.

### 2. Play state is a seat, saved on the Game

There is one **seat** per pilot in a Game, held in Convex. It records:

- **mount:** on foot, or boarded and in which mech;
- the **range band**;
- the **activated effects**;
- the **action being resolved**, so a reload mid-roll keeps it.

The rules for a seat:

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
Major follows the game:

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
step done. The Dashboard no longer keeps a Downtime step of its own.

**A Game's crawler is the Mediator's.** Only the Mediator changes it, in
Downtime and out. That covers Salvage, Craft, Trade, Upkeep, Upgrade, damage
and Scrap a mech. Players see the crawler read-only and ask at the table. The
server enforces it. Today `assertMayEditCrawler` (`convex/entities.ts`) lets
any member edit a Game's communal crawler; it tightens to the Mediator.

**Boarding never assigns.** Boarding a mech, a spare included, changes only the
seat, never the pilot's `mech-to-pilot` link.

### 6. What stands

- [ADR-007](ADR-007-automation-boundary.md)'s automation boundary, on every
  control. Eject still confirms twice, and destruction is still the player's act.
- [ADR-006](ADR-006-pure-rules-logic.md)'s pure rules.
- ADR-015's reuse of the SRD display (decision 2), its flat-and-inset treatment
  (decision 3) and the fixed 1280×800 canvas (decision 5).
- A player never writes another player's state.

## Alternatives rejected

- **Keep play state on the device and broadcast it to the crew.** It would still
  be lost on reload and on a second device. It would also create a second source
  of truth beside Convex, which ADR-034 rules out.
- **One seat per member.** It breaks the moment a member covers a second pilot.
- **Mount as a field on the pilot or mech.** It would leak into sheets and
  public sheets. ADR-015 decision 4 rejected this, and that half of the decision
  stands.
- **Keep the Dashboard on the shelf and in solo play.** The product owner
  rejected this. The Dashboard is a curated live game, and the live sheet already
  serves solo play.
- **The Crawler always in a Minor slot.** During Downtime the crew acts through
  the crawler, so it takes Major.

## Consequences

- **Fewer people can use the Dashboard.** Anonymous visitors, shelf play and
  Games without a Mediator lose it. The Solo rows in
  [data-flow.md](../architecture/data-flow.md) and
  [combat-loop.md](../architecture/combat-loop.md) change when that layer
  lands.
- **There is new server surface.** A `seats` table and its functions are added.
  Seats are cleaned up when a Game, pilot or account is deleted and when a pilot
  or mech leaves the Game. Every toggle is a mutation, so the client uses
  optimistic updates.
- **An open Dashboard subscribes to more.** It now also watches the seats,
  the Game's rolls and the Downtime row (ADR-030 already counts an open
  Dashboard as a live subscription).
- **Code is deleted.** The Dial, its settings overlay, `cockpitPrefsStore`,
  `playStateStore`, the launch chooser and stand-in mechs all go.
  `games.cockpitPrefs` stays unused until a separate change drops it.
- **The Dashboard's Tailwind-removal phase is absorbed.** The rewrite uses
  `.su-*` classes and style objects, which completes
  [tailwind-removal.md](../design-system/tailwind-removal.md) P5 for the
  Dashboard.
- **Players can no longer edit a Game's crawler,** on the Dashboard or the
  sheet. Until players can send requests to the Mediator in the app, they ask
  at the table.
- **Convex gains the rules package** for crew status. That reverses a
  convention recorded in code comments (Convex "should not grow" it), not an
  ADR. ADR-006's rule holds: the math stays in the package, and Convex calls
  it.
- **Some work moves to follow-ups:** a Mediator Dashboard, the phone layout,
  and what "claiming" a crew asset means in a Game.
