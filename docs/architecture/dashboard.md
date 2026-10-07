# Dashboard Architecture

> **Changing.** [ADR-038](../ARCHITECTURE.md#adr-038)
> (accepted) makes the Dashboard Game-only and saves its play state on the
> Game, and has replaced the Dial with Major and Minor slots and the display
> picker with tabs. The plan is
> [dashboard-redesign.md](dashboard-redesign.md). This doc describes what is
> built until the plan's last layer rewrites it.

The **Dashboard** is ITUN's live actual-play surface: a player's **Pilot + Mech +
Crawler** composed into one screen that never scrolls, where every game action is
a button. It is built — components in `apps/itun/src/components/dashboard/`,
stylesheets in `packages/component-lib/src/styles/dashboard/`, route
`/dashboard/$pilotId` (`apps/itun/src/routes/dashboard/$pilotId.tsx`).

The decisions are [ADR-015](../ARCHITECTURE.md#adr-015)
and its merged Dashboard decisions (formerly ADRs 016–020). The live-play state
model it drives is [combat loop](../ARCHITECTURE.md#combat-loop). Section numbers below are
cited from code comments; keep them stable.

## 1. Purpose & positioning

The Roster (`/`) picks builds, the live sheets (`/sheet/$kind/$id`) edit them
(Free Edit), and the Dashboard runs them at the table (Guided Play). The
Dashboard is **not a second editor**. It reads and mutates the same persisted
entities as the sheets, through the same store and the same pure rules functions,
so a change in one is visible in the other. Where the sheet asks "what does this
pilot _have_", the Dashboard asks "what can this pilot _do right now_".

## 2. Layout

A fixed **1280×800 canvas** (`DashboardCanvas`), scaled with one
`transform: scale()` and letterboxed. `MAX_SCALE` caps the upscale;
`MIN_SCALE` is not a scale floor but the width ratio below which the canvas is
abandoned for the `.pc-reflow` "rotate to landscape" notice. Overlays may
scroll internally; the frame never does. `DashboardGrid` places three surfaces:

- **Rail** (`RailBar`) — exit, context stamp, whether play is saved
  (`SavedIndicator`, from `useConnection()`), settings; the one hard-bordered
  frame besides the display.
- **Slot row** (`SlotRow`) — one **Major** slot and two **Minors**, placed by
  the mount (`slotLayout.ts`). A Major (`MajorFrame`) is the entity's
  responsibility **bays**, each gauges plus a button grid, with a narrow side
  column. Mech: Reactor · Chassis, side Effects · Egress. Pilot: Vitals · Kit ·
  Abilities · Mount. Crawler: Hull · Stores · Bays, side Upkeep · Upgrade ·
  Scrap; its verbs show to the Mediator only. A Minor (`MinorFrame`) shows a
  gauge or two and turns red on an injury, a damaged system or a damaged bay;
  ⤢ opens that entity's Major over the display (`SlotOverlay`).
- **Display** — the only element that reads "forward". The deck
  (`DeckList`: timing, range and source filters over the action tiles) sits
  beside the display's tabs (`DisplayTabs`): Resolve (the chosen action,
  `ResolvePanel`), Reference (the pilot's, mech's or crawler's card, picked by
  `DisplayPicker`), Tables, SRD, then Log (the Game's rolls and the
  Mediator's alerts, `LogTab`) and Crew (`CrewTab`: one row per crewmate,
  pilot first, with HP and AP, their mech's SP and Heat while boarded, and
  the action they are resolving; a row opens that crewmate's live sheet). A
  red outline marks a crewmate who is dead, injured, ejected, overheating or
  destroyed, and a ▲ on the tab says someone is. A strip along the bottom
  (`DashboardStrip`) carries the latest alert and the proposal count.

**Mount state** is `pilot | mech | downtime`: Board takes the pilot into a
mech, Dismount or Eject (confirm-twice) takes them out, and Downtime is
crawler-dominant, with `DowntimeWizard` in place of the deck and tabs.
Downtime is the Game's `downtime` row (`useDowntime`): the Mediator starts and
ends it from the rail and moves it on with Next step, every member's Dashboard
follows, and each player marks their own step done (the wizard's step track
and ready pips). When it ends, each player is back where their seat says. On foot or
boarded, and in which mech, is the pilot's **seat** on the Game (§4.1); a
boarded pilot runs the mech the seat names, which need not be their assigned
one. Board is a split button in the Mount bay (`BoardControl`, over
`boardMenu.ts`): the main half boards the assigned mech, and ▾ lists every
mech on the pilot's crawler (only the viewer's own with no crawler), with
another player's, destroyed and taken mechs disabled with the reason. An
unclaimed spare is "Claim and board", confirmed first: `ownership.claim`, then
the seat. Boarding never draws a `mech-to-pilot` link. The active
family tints the whole canvas; hue means ontology, and state is a treatment
(hatch, strike, redline), never a second hue.

## 3. Reuse contract

**The display reuses the shared entity-display system; the instruments are
new.** `ReferenceEntityCard` is the renderer for any SRD entity in the display
and `RollTable` for any roll table, with entity-level buttons and drill-in links
passed as typed `controls`. `DisplayPanel` is the reference wiring — read it
rather than a description. Do not fork the display for the Dashboard.

## 4. Data & state

### 4.1 Ephemeral vs persisted

| State                                                     | Home                                                    |
| --------------------------------------------------------- | ------------------------------------------------------- |
| HP / SP / EP / Heat, conditions, item uses, cargo         | the pilot / mech records (persisted)                    |
| maxima, and the crew's status                             | derived (`lib/rules/derivedStats.ts`, `src/lib/rules/crewStatus.ts`), never stored |
| on foot or boarded (and in which mech), range band, activated effects, the action being resolved | the pilot's seat on the Game (`convex/seats.ts`, `useSeat`) |
| rolls                                                     | the Game's change log (`dashboardRolls.ts`, `changeLog.rolls`) |
| in Downtime, its step, who is done, Upkeep paid           | the Game's `downtime` row (`convex/downtime.ts`, `useDowntime`) |
| open tab, Reference entity, overlays, deck filters, a Hot X, the deck's Take Damage hand-off | component state |

Mount state must never reach the pilot/mech schema or a shared sheet: there is no
"pilot in mech" field, only a `mech-to-pilot` soft link and the seat, its own row
that points at both by app id. Every member reads the crew's seats; only whoever
may write the pilot writes its seat, and boarding also needs the mech
([ADR-038](../ARCHITECTURE.md#adr-038) §2).

### 4.2 Persistence

Live-play writes to the pilot, mech and crawler go through `entityStore.update`,
exactly the sheet's path ([data flow](../ARCHITECTURE.md#data-flow)). The
Dashboard's own server surface is the seat: `convex/seats.ts`, written through
`useSeat`'s mutations with optimistic updates, and refused here while
Disconnected rather than queued. An Eject also marks the seat `ejected` until
the pilot next boards or dismounts. The Crew tab reads `crew.vitals`, where
the server derives each crewmate's maxima and status with the client's own
rules (`src/lib/rules/crewStatus.ts`), so every client flags the same people.
Each step of a resolve is a `setResolving`,
so a reload keeps the roll and the crew watches it; a change of mount clears
it. Every roll (core, Push, Heat Check, Criticals, tables, Area Salvage) is
also a Game row in `changeLog` (`entityType 'game'`, `field 'roll'`,
`source 'dashboard'`, the bot's shape), sent through `commitChangeLog` and
read back by `changeLog.rolls`.

### 4.3 The ADR-007 boundary on every control

Non-destructive bookkeeping auto-applies: activation costs, Hot heat, uses,
Vent, heat clamp, overheat SP damage, the shutdown/vulnerable flags. Destructive
change is always the player's act: destroying a system or module (a rules result
sets `requiresPlayerChoice`, never the condition), Eject, and meltdown.

## 5. Rules interactions

The Dashboard is a thin driver over the pure rules in
`packages/salvageunion-reference/lib/rules/` (ITUN's `src/lib/rules/*` wrap them
into patches); `dashboardRules.ts` holds the Dashboard's own glue. It never
reimplements the math.

### 5.1 Heat / Push / Overload

Push is a reroll plus 2 Heat and forces a Heat Check (`performPush`); the button
is greyed by `canActivateAction`. Heat Check: d20 ≤ Heat → Reactor Overload.
**Overload is d20 low = worse**, the opposite of the core 2d6 mechanic, so the UI
frames it as "d20 vs Heat", never "roll high". Vent sets Heat to 0 and
Vulnerable; it is not Shutdown.

### 5.2 Action activation

Actions resolve from the composed entities (`SalvageUnionReference.resolveActions`).
Hot and Uses are traits, not costs, and the Dashboard derives economy **per
action** rather than per item. The resolve flow is Activate → Roll → optional
Push reroll → Apply; pure-effect actions skip to Apply. `useActionsDeck` drives
it and hands `DeckList` and `ResolvePanel` their models.

### 5.3 Damage → Critical

SP 0 rolls Critical Damage; HP 0 rolls Critical Injury. One damage event can
queue both. Results that destroy items are never auto-applied (§4.3).

## 6. Component architecture

`apps/itun/src/components/dashboard/` is the roster — read it rather than a tree
here. `Dashboard.tsx` resolves `{ pilot, mech, crawler }` with the sheet's own
`resolveSheetComposition()` and renders `DashboardCanvas` → `DashboardGrid` with
the three surfaces above. The store-wired containers (`SlotRow` and its
per-entity `PilotSlot` / `MechSlot` / `CrawlerSlot`, `DisplayPanel`,
`useActionsDeck`, `DowntimeWizard`) build view models their presentational
halves render; `useGameFeed` reads the rest of the table. Memoize per surface so a Heat tick does not
re-render the display's reference card.

## 7. Mobile

Below the width threshold there is only the `.pc-reflow` notice. The planned
phone layout — a stacked, scrolling column built from the same instruments — is
not built. No-scroll is a landscape-desktop contract.

## 8. Launch flow

The Dashboard opens for a pilot in a Game that has a Mediator
([ADR-038](../ARCHITECTURE.md#adr-038) §1),
from the Play button on your own pilot rows in the Game roster
(`GameRoster.tsx`), shown only while the Game has a Mediator. The route keys on
the pilot; its mech is the one its seat has boarded (§2), or on foot the one
assigned to it (`mech-to-pilot`), and its crawler its own (`pilot-to-crawler`).
A pilot with no assigned mech plays on foot and boards from the Board menu. An
old mech-keyed URL redirects to the mech's pilot.

`DashboardGate` decides who may play, live, in the component: an anonymous
session, a shelf pilot, a non-member and a Game with no Mediator each get a
shell saying what is missing, and an open Dashboard falls back to the shell if
the Game loses its Mediator. Disconnected is not a refusal; the Dashboard stays
open read-only. Shelf sheets show a "Play in a Game" hint instead of a launcher.

## 9. Testing

Test the wiring, not the rules math: destructive outcomes surface a confirm and
never auto-write a condition, mount state never reaches `entityStore`, and the
canvas scale and threshold math holds. A roll round-trips through the log
(`test/convex/rolls.test.ts`), and the resolve survives a reload and reaches a
second client (`useSeat.connected.test.tsx`). Two clients follow one Downtime: the
Mediator's advance moves both, and a player's "I'm done" reaches the other
(`Downtime.connected.test.tsx`).

## 10. Accessibility, risks & open questions

### 10.1 CSP

No `eval` or `new Function` ([ADR-013](../ARCHITECTURE.md#adr-013)).

### 10.2 Accessibility (WCAG 2.1 AA)

The slot row is plain buttons. The display's tabs are component-lib's `Tabs`
(Base UI): ArrowLeft/Right and Home/End select, and each tab controls its
panel. The deck's timing, range and source filters and the Reference entity
picker are toggle buttons with `aria-pressed`, not tabs.
The ⤢ overlay is a modal dialog: it takes focus, keeps Tab inside, closes on
Escape and returns focus to ⤢. The Board menu is a list of buttons in the
Major's overlay, not a `menu`: it focuses the first boardable mech, closes on
Escape and returns focus to ▾, and each disabled mech's reason is visible text
tied to it by `aria-describedby`. Every hue pairs with a non-colour cue.

### 10.3 Scale-to-fit vs zoom

A scaled canvas fights browser zoom: a user at 200% gets a smaller canvas, not
bigger text. Open question: treat large zoom as a reflow trigger once the phone
layout exists.

### 10.4 Two gauges

The Dashboard ships its own `DashboardGauge` beside `component-lib`'s
`VitalGauge`. If revisited, consolidate; do not add a third.

### 10.5 Risks & open questions

- **Targeting** is a declared range band only; there is no entity-selection UI.
- **Two tabs** (sheet and Dashboard) write the same records through the same
  store; watch for races on item uses and conditions.
- **Contrast** of the pilot-orange ground and the Heat redline in both themes
  still wants a real screenshot check.
