# Dashboard Architecture

The **Dashboard** is ITUN's live actual-play surface: one pilot in a Game, with
their **Mech** and the crew's **Crawler**, composed into one screen that never
scrolls, where every game action is a button. Components are in
`apps/itun/src/components/dashboard/`, the remaining `.pc-*` stylesheets in
`apps/itun/src/styles/dashboard/`, and the route is
`/dashboard/$pilotId` (`apps/itun/src/routes/dashboard/$pilotId.tsx`).

The decisions are [ADR-038](../ARCHITECTURE.md#adr-038), the one Dashboard
record: Game-only, play state on a seat, Major and Minor slots, tabs, the
reused display and the fixed canvas. Code cites its §1–§9. The live-play state
model it drives is
[combat loop](../ARCHITECTURE.md#combat-loop). Section numbers below are cited
from code comments; keep them stable.

## 1. Purpose & positioning

The Roster (`/`) picks builds, the live sheets (`/sheet/$kind/$id`) edit them
(Free Edit), and the Dashboard runs them at the table (Guided Play). The
Dashboard is **not a second editor**. It reads and mutates the same persisted
entities as the sheets, through the same store and the same pure rules functions,
so a change in one is visible in the other. Where the sheet asks "what does this
pilot _have_", the Dashboard asks "what can this pilot _do right now_".

It is a curated, live game surface, so it opens only for a pilot in a Game that
has a Mediator (§8). Solo, shelf and anonymous play, and a Game with no
Mediator, use the live sheet. It is for pilots: a Mediator who plays a pilot
uses it like any player, and a Mediator Dashboard is a later plan (#1062).

## 2. Layout

A fixed **1280×800 canvas** (`DashboardCanvas`), scaled with one
`transform: scale()` and letterboxed. `MAX_SCALE` caps the upscale;
`MIN_SCALE` is not a scale floor but the width ratio below which the canvas is
abandoned for the `.pc-reflow` "rotate to landscape" notice (§7). Overlays may
scroll internally; the frame never does. `DashboardGrid` places three surfaces:

- **Rail** (`RailBar`) — Return to Roster, the stamp of the entity in the
  Major slot, whether play is saved (`SavedIndicator`, from `useConnection()`),
  and on the right the Mediator's Start or End Downtime (a player sees a
  disabled Settings placeholder); the one hard-bordered frame besides the
  display.
- **Slot row** (`SlotRow`) — one **Major** slot and two **Minors**, placed by
  the mount (`slotLayout.ts`): on foot the Pilot is Major, boarded the Mech,
  in Downtime the Crawler; nothing else moves them. A Major (`MajorFrame`) is
  the entity's responsibility **bays**, each gauges plus a button grid, with a
  narrow side column. Mech: Reactor · Chassis, side Effects · Egress. Pilot:
  Vitals · Kit · Abilities · Mount. Crawler: Hull · Stores · Bays, side
  Upkeep · Upgrade · Scrap; its verbs show to the Mediator only, and Pay
  Upkeep only in the Upkeep & Upgrade step. A Minor
  (`MinorFrame`) shows a gauge or two and turns red on an injury, a damaged
  system or a damaged bay; ⤢ opens that entity's Major over the display
  (`SlotOverlay`) without moving the slots.
- **Display** — the only element that reads "forward". The deck
  (`DeckList`: timing, range and source filters over the action tiles) sits
  beside the display's tabs (`DisplayTabs`): Resolve (the chosen action,
  `ResolvePanel`), Reference (the pilot's, mech's or crawler's card, picked by
  `DisplayPicker`), Tables, SRD, then Log (the Game's rolls and the
  Mediator's alerts, `LogTab`) and Crew (`CrewTab`: one row per crewmate,
  pilot first, with HP and AP, their mech's SP and Heat while boarded, and
  the action they are resolving; a row opens that crewmate's live sheet).
  Rows are keyed by link id, the id seats and soft links use, so a template
  pre-gen with no app id (the Starter Set's) gets a row too. A parked mech is
  one line, which names what is wrong when it draws the outline. A red
  outline marks a crewmate who is dead, injured, ejected, overheating or
  destroyed, and a ▲ on the tab says someone is. A strip along the bottom
  (`DashboardStrip`) carries the latest alert, the proposal count and the
  link to the Game, where proposals are answered.

**Mount state** is `pilot | mech | downtime`: Board takes the pilot into a
mech, Dismount or Eject (confirm-twice) takes them out, and Downtime is
crawler-dominant, with `DowntimeWizard` in place of the deck and tabs.
Downtime is the Game's `downtime` row (`useDowntime`): the Mediator starts and
ends it from the rail and moves it on with Next step, every member's Dashboard
follows, and each player marks their own step done (the wizard's step track
and ready pips). When it ends, each player is back where their seat says. On
foot or boarded, and in which mech, is the pilot's **seat** on the Game (§4.1);
a boarded pilot runs the mech the seat names, which need not be their assigned
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
| on foot or boarded (and in which mech), range band, activated effects, the action being resolved, ejected | the pilot's seat on the Game (`convex/seats.ts`, `useSeat`) |
| rolls                                                     | the Game's change log (`dashboardRolls.ts`, `changeLog.rolls`) |
| in Downtime, its step, who is done, Upkeep paid           | the Game's `downtime` row (`convex/downtime.ts`, `useDowntime`) |
| open tab, Reference entity, overlays, deck filters, a Hot X, the deck's Take Damage hand-off | component state, reset on reload |

Mount state must never reach the pilot/mech schema or a shared sheet: there is no
"pilot in mech" field, only a `mech-to-pilot` soft link and the seat, its own row
that points at both by link id (the app id, or a template pre-gen's body id).
Every member reads the crew's seats; only whoever may write the pilot writes its
seat, and boarding also needs the mech
([ADR-038](../ARCHITECTURE.md#adr-038) §2).

### 4.2 Persistence

Live-play writes to the pilot, mech and crawler go through `entityStore.update`,
exactly the sheet's path ([data flow](../ARCHITECTURE.md#data-flow)). In a Game
the crawler is the table runner's ([ADR-038](../ARCHITECTURE.md#adr-038) §5):
the Mediator, or the Organizer while the Game has none, raises, edits and
scraps it. The server refuses anyone else's crawler write
(`assertMayEditCrawler`), so the crawler sheet is read-only for players, and
the Crawler slot's verbs show to the Mediator only. The Dashboard's own server surface is the seat:
`convex/seats.ts`, written through `useSeat`'s mutations with optimistic
updates, and refused here while Disconnected rather than queued. An Eject also
marks the seat `ejected` until the pilot next boards or dismounts. The Crew tab
reads `crew.vitals`, where the server derives each crewmate's maxima and status
with the client's own rules (`src/lib/rules/crewStatus.ts`), so every client
flags the same people. Each step of a resolve is a `setResolving`, so a reload
keeps the roll and the crew watches it; a change of mount clears it. Every roll
(core, Push, Heat Check, Criticals, tables, Area Salvage) is also a Game row in
`changeLog` (`entityType 'game'`, `field 'roll'`, `source 'dashboard'`, the
bot's shape), sent through `commitChangeLog` and read back by
`changeLog.rolls`.

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
here. `DashboardGate` decides who may play (§8). `Dashboard.tsx` resolves
`{ pilot, mech, crawler }` with the sheet's own `resolveSheetComposition()`,
swaps in the mech the seat has boarded, and renders `DashboardCanvas` →
`DashboardGrid` with the three surfaces above. The store-wired containers
(`SlotRow` and its per-entity `PilotSlot` / `MechSlot` / `CrawlerSlot`,
`DisplayPanel`, `useActionsDeck`, `DowntimeWizard`) build view models their
presentational halves (`MajorFrame`, `MinorFrame`, `DeckList`, `ResolvePanel`,
`CrewTab`, `LogTab`) render. The Game comes in through four hooks: `useSeat`,
`useBoardSources` (the crew's mechs and seats), `useGameFeed` (rolls, alerts,
the inbox, `crew.vitals`) and `useDowntime`. Memoize per surface so a Heat tick
does not re-render the display's reference card.

New Dashboard UI is written to
[tailwind-removal.md](../design-system/tailwind-removal.md) §4: style objects
over `component-lib/design/tokens` plus `.su-*` classes, and no new `.pc-*`
class. The `.pc-*` rules still in use load once, from `Dashboard.tsx`, through
ITUN's `src/styles/dashboard.css`.

## 7. Mobile

There is no phone layout yet; it is #1063 (two Minors stacked above the
Major). Until then the canvas guard reads **width only**, so a short, wide
desktop window keeps the canvas and scales down to its height:

- **Portrait phone, or any host narrower than about 794 px**
  (`MIN_SCALE` 0.62 × 1280): the `.pc-reflow` notice, which asks the player to
  rotate to landscape or use a larger screen. Nothing else renders.
- **Landscape phone:** it passes the width guard, so it gets the whole
  canvas scaled to fit its height. An 852×393 phone renders it at about 0.49
  scale or less, every control present but small. The notice does not appear.

No-scroll is a landscape-desktop contract.

## 8. Launch flow

The Dashboard opens for a pilot in a Game that has a Mediator
([ADR-038](../ARCHITECTURE.md#adr-038) §1), and from one place: **Launch
Dashboard** at the top of the Game hub, the page `/` shows once a Game is
picked (`LaunchDashboard.tsx`, mounted by `GameHub.tsx`). Players and the
Mediator see it alike, only while the Game has a Mediator; without one the hub
says the Dashboard opens once it has one. It opens a dialog whose one choice is
the pilot: the Game's pilots this browser holds, yours first, with your first
one pre-selected. A viewer who owns none of them picks one, and **Launch** goes
to `/dashboard/$pilotId`. The gate reads the pilot from the local store, which
never holds a crewmate's pilot, so neither it nor a pre-gen made in another
browser is offered; a viewer holding none is told so.
No roster row, live sheet or Games-menu item launches it. The route keys on
the pilot; its mech is the one its seat has boarded (§2), or on foot the one
assigned to it (`mech-to-pilot`), and its crawler its own (`pilot-to-crawler`).
A pilot with no assigned mech plays on foot and boards from the Board menu. An
old mech-keyed URL redirects to the mech's pilot.

`DashboardGate` decides who may play, live, in the component: an anonymous
session, a shelf pilot, a non-member and a Game with no Mediator each get a
shell saying what is missing, and an open Dashboard falls back to the shell if
the Game loses its Mediator. Disconnected is not a refusal; the Dashboard stays
open read-only. The gate does not open a crewmate's pilot: it is not in this
browser, so it gets "Pilot not found". Their read-only sheet is on the roster.

## 9. Testing

Test the wiring, not the rules math: destructive outcomes surface a confirm and
never auto-write a condition, mount state never reaches `entityStore`, and the
canvas scale and threshold math holds. The gate's refusals are
`DashboardGate.connected.test.tsx`; the launcher and its picker are
`GameHub.connected.test.tsx`. The seat's permissions and cleanup are
`test/convex/seats.test.ts`, its Zod and Convex unions are kept in step by
`test/convex/seatSchemaParity.test.ts`, and the server's crew status equals the client's
(`test/convex/crewStatus.test.ts`). A roll round-trips through the log
(`test/convex/rolls.test.ts`), and the resolve survives a reload and reaches a
second client (`useSeat.connected.test.tsx`). Two clients follow one Downtime: the
Mediator's advance moves both, and a player's "I'm done" reaches the other
(`Downtime.connected.test.tsx`).

## 10. Accessibility, risks & open questions

### 10.1 CSP

No `eval` or `new Function` ([ADR-013](../ARCHITECTURE.md#adr-013)).

### 10.2 Accessibility (WCAG 2.1 AA)

A role here comes with its keyboard model; this list claims none without one.

- The slot row is plain buttons; ⤢ and ▾ say `aria-haspopup="dialog"`.
- The display's tabs are component-lib's `Tabs` (Base UI): ArrowLeft/Right
  and Home/End select, and each tab controls its panel
  (`DisplayTabs.test.tsx`).
- The deck's timing, range and source filters, the Reference entity picker
  and the Tables picker's entries are toggle buttons with `aria-pressed`, not
  tabs.
- A deck tile is a `Card` with `role="button"`: Enter and Space open it.
- The SRD tab's search is a `combobox` over a `listbox`
  (`useSearchCombobox`): ArrowUp/Down move the active option, Enter opens it.
- The ⤢ overlay (`SlotOverlay`) and the Tables picker (`TablePickerOverlay`)
  are component-lib `ModalShell`s portalled into the region they cover: each
  takes focus, keeps Tab inside, closes on Escape or a press outside it and
  returns focus to what opened it (⤢, the table title).
- A Major's prompt (a resolve, Take Damage, storage, the Board menu) is a
  non-modal `dialog` over the Major that closes on Escape. The Board menu is a
  list of buttons, not a `menu`: it focuses the first boardable mech and
  returns focus to ▾ on close, and each disabled mech's reason is visible text
  tied to it by `aria-describedby`.

Every hue pairs with a non-colour cue.

### 10.3 Scale-to-fit vs zoom

A scaled canvas fights browser zoom: a user at 200% gets a smaller canvas, not
bigger text. Open question: treat large zoom as a reflow trigger once the phone
layout exists (#1063).

### 10.4 Two gauges

The Dashboard ships its own `DashboardGauge` beside `component-lib`'s
`VitalGauge`. If revisited, consolidate; do not add a third.

### 10.5 Risks & open questions

- **Targeting** is a declared range band only; there is no entity-selection UI.
- **Two tabs** (sheet and Dashboard) write the same records through the same
  store; watch for races on item uses and conditions.
- **Contrast** of the pilot-orange ground and the Heat redline in both themes
  still wants a real screenshot check.
- **Players cannot ask for a crawler change in the app.** Proposals run from
  the Mediator to a player only; with the crawler the table runner's, players
  ask at the table.
