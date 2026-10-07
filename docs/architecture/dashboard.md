# Dashboard Architecture

> **Changing.** [ADR-038](../adrs/ADR-038-dashboard-game-surface-shared-play-state.md)
> (accepted) makes the Dashboard Game-only and saves its play state on the
> Game, and replaces the Dial with Major and Minor slots. The plan is
> [dashboard-redesign.md](dashboard-redesign.md). This doc describes what is
> built until the plan's last layer rewrites it.

The **Dashboard** is ITUN's live actual-play surface: a player's **Pilot + Mech +
Crawler** composed into one screen that never scrolls, where every game action is
a button. It is built — components in `apps/itun/src/components/dashboard/`,
stylesheets in `packages/component-lib/src/styles/dashboard/`, route
`/dashboard/$id` (`apps/itun/src/routes/dashboard/$id.tsx`).

The decisions are [ADR-015](../adrs/ADR-015-dashboard-distinct-play-surface.md)
and its merged Dashboard decisions (formerly ADRs 016–020). The live-play state
model it drives is [combat-loop.md](combat-loop.md). Section numbers below are
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
scroll internally; the frame never does. `DashboardGrid` places four surfaces:

- **Rail** (`RailBar`) — exit, context stamp, settings; the one hard-bordered
  frame besides the display.
- **Active Item band** (`ActiveItemBand`) — the 2/3-width viewfinder: the active
  entity's responsibility **bays**, each a gauge plus a button grid. Mech:
  Reactor · Chassis · Loadout. Pilot: Vitals · Re-roll · Kit. Crawler: Stores ·
  Upkeep · Downtime.
- **Dial** (`Dial`) — the 260px right-edge rotary selector. The active item
  overhangs to ~1/3 of the row; inactive items sit in the track below. Steps
  snap to items (arrow buttons, click-to-jump, drag with inertia).
- **Display** (`DisplayPanel`) — the only element that reads "forward". It
  follows dial focus: the Actions deck, an entity's reference card, the tables
  roller, or the SRD explorer; a deck action enters its resolve flow.

**Mount state** is `pilot | mech | downtime`: Board takes the pilot into the
mech, Dismount or Eject (confirm-twice) takes them out, and Downtime is
crawler-dominant, with `DowntimeWizard` in place of the display. The active
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
| maxima                                                    | derived (`lib/rules/derivedStats.ts`), never stored     |
| mount state, range band, turn flags, dial focus           | `playStateStore` — ephemeral, resets on reload          |
| dial show/hide and order                                  | `cockpitPrefsStore` — `localStorage`, per container     |
| overlays, filters, resolve progress                       | component state                                         |

Mount state must never reach the pilot/mech schema or a shared sheet: there is no
"pilot in mech" field, only a `mech-to-pilot` soft link.

### 4.2 Persistence

Live-play writes go through `entityStore.update`, exactly the sheet's path
([data-flow.md](data-flow.md)). The Dashboard never introduces a second write
path, and adds no server surface of its own.

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
Push reroll → Apply; pure-effect actions skip to Apply.

### 5.3 Damage → Critical

SP 0 rolls Critical Damage; HP 0 rolls Critical Injury. One damage event can
queue both. Results that destroy items are never auto-applied (§4.3).

## 6. Component architecture

`apps/itun/src/components/dashboard/` is the roster — read it rather than a tree
here. `Dashboard.tsx` resolves `{ pilot, mech, crawler }` with the sheet's own
`resolveSheetComposition()` and renders `DashboardCanvas` → `DashboardGrid` with
the four surfaces above. The store-wired containers (`ActiveItemBand` and its
per-mount `MechBand` / `PilotBand` / `CrawlerBand`, `DisplayPanel`,
`ActionsDeck`, `DowntimeWizard`, `DialConfig`) build view models their
presentational halves render. Memoize per surface so a Heat tick does not
re-render the display's reference card.

## 7. Mobile

Below the width threshold there is only the `.pc-reflow` notice. The planned
phone layout — a stacked, scrolling column built from the same instruments — is
not built. No-scroll is a landscape-desktop contract.

## 8. Launch flow

`DashboardChooser` is a pilot → mech → crawler wizard, mounted from the Roster,
a Game's roster and the pilot and mech sheets. On confirm it ensures the soft
links the composition needs and routes to `/dashboard/$id`. `dashboardLaunch.ts` can instantiate a stand-in
mech from a saved pattern and a default crawler of a chosen Tech Level; both are
real, deletable records.

## 9. Testing

Test the wiring, not the rules math: destructive outcomes surface a confirm and
never auto-write a condition, mount state never reaches `entityStore`, and the
canvas scale and threshold math holds.

## 10. Accessibility, risks & open questions

### 10.1 CSP

No `eval` or `new Function` ([ADR-013](../adrs/ADR-013-csp-zod-jitless.md)).

### 10.2 Accessibility (WCAG 2.1 AA)

The dial is a `role="listbox"` whose cells are `option`s with `aria-selected`.
Its step controls and clickable cells are buttons, so it works without drag;
arrow-key stepping on the focused listbox is not built. `prefers-reduced-motion`
gets instant snaps. Every hue pairs with a non-colour cue.

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
