# Dashboard Architecture

> **Status:** Planning / design record. This document is the implementation plan
> for the **Dashboard** — the live actual-play surface for
> `apps/itun` (ITUN), composing a player's **Pilot + Mech + Crawler**
> into one screen. (Named the "Play Cockpit" / "Pit HUD" in earlier design passes;
> renamed to **Dashboard** — the former build-list home is now the **Roster**.)
> **Built and shipped** — realized in `src/components/play/` (16 components + tests)
> and routed at `/play/$id`. The design was explored turn-by-turn (v18→v62), the
> **layout locked at v52**, prototyped as self-contained HTML, then implemented
> across Phases 1–7. This document is the design record for that shipped surface.
>
> Read alongside: [combat-loop.md](combat-loop.md) (the authoritative live-play
> state model this HUD drives), [display-system.md](display-system.md),
> [data-flow.md](data-flow.md), [package-contracts.md](package-contracts.md),
> and ADRs [007](../adrs/ADR-007-automation-boundary.md),
> [004](../adrs/ADR-004-snapshot-netlify-functions.md),
> [010](../adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md),
> [013](../adrs/ADR-013-csp-zod-jitless.md).

---

## 1. Purpose & positioning

ITUN has three player-facing surfaces once the Dashboard lands. They are
**different tools for different moments**, and the split is deliberate: live sheets
= character **editing** (the _Free Edit_ mode); the Dashboard = actual **play**
(the _Guided Play_ mode). This is the surface taxonomy in
[ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md); the Dashboard-is-a-distinct-surface
decision is [ADR-015](../adrs/ADR-015-dashboard-distinct-play-surface.md).

| Surface         | Route                                          | Job                                                                    | Interaction grammar                             |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| **Roster**      | `/` (`src/components/dashboard/Dashboard.tsx`) | Pick / manage saved builds                                             | Cards → open                                    |
| **Live sheets** | `/sheet/$kind/$id` (`src/components/sheet/*`)  | Build & edit a pilot / mech / crawler                                  | Poster layout, inline edit, scrollable          |
| **Dashboard**   | `/dashboard/$id` (**new**)                     | Run your Pilot + Mech + Crawler at the table, one screen, no scrolling | Instrument panel: every game action is a button |

The Dashboard is a **screen-wide, video-game-style HUD** that fits one screen
with no page scroll and turns every game action (Push, Vent, use a system,
take damage, roll a table) into a button. It is **not** a second editor. It reads
and mutates the _same_ persisted entities as the live sheets (`Mech`, `Pilot`,
`Crawler` — see §5), through the _same_ rules engine and store, but it never
opens the inline-edit affordances of the sheet. Where the sheet asks "what does
this pilot _have_", the Dashboard asks "what can this pilot _do right now_".

The two surfaces coexist by sharing state, not chrome: a change made in the
Dashboard (spend EP, take SP damage) is immediately visible on the live sheet in
another tab (the multi-tab broadcast in `src/lib/db/broadcast.ts`), and vice
versa. **There is one source of truth; the Dashboard is a second lens on it.**

Local-first is preserved end to end ([ADR-001], [ADR-003]): the Dashboard adds no
backend, no auth, no RPC. It is a client of `entityStore`/`workspaceStore` and
the pure rules functions, exactly like the sheet.

---

## 2. The locked design (from the mockup)

The mockup source embodies the **v52 locked layout** plus the v53→v60 instrument
passes. The arrangement of surfaces is **done — do not restructure it.** What
follows is the spec engineers build against.

### 2.1 The fixed canvas & scale-to-fit

- The Dashboard is a **fixed 1280×800 design canvas**. It never reflows within
  that box and never scrolls the page.
- It is placed inside a viewport and scaled with a single
  `transform: scale(min(vw/1280, vh/800))`, letterboxed, **clamped** to roughly
  `[0.62, 1.3]` (`MINSCALE`/`MAXSCALE` in the mockup).
- **Below the clamp floor (~0.62×) it hard-reflows** to a native, scrolling
  phone layout. No-scroll is a **landscape-desktop contract only**; on a phone we
  drop the fixed-canvas conceit entirely and render a stacked, scrollable variant
  (see §7 mobile).
- Overlays (dial config, storage, table picker) may scroll _internally_; the
  frame itself never scrolls. The single sanctioned internal scroll in the main
  body is a large-entity drill-in.

Reference: `buildCanvas()` sets `grid-template-columns: 1fr 260px`,
`grid-template-rows: 40px 168px 1fr`, areas `"rail rail" / "primary wheel" /
"display wheel"`; `mountCanvas()` computes the scale and the reflow decision.

### 2.2 The four surfaces

```
┌──────────────────────────────────────────────────────────────┐
│  RAIL  (40px, solid 2.5px border)   Exit · context · Settings │  ← rail
├───────────────────────────────────────────┬──────────────────┤
│  ACTIVE ITEM BAND (2/3, soft tinted border)│  ACTIVE DIAL ITEM│  ← primary row
│  responsibility "bays": gauge + button grid│  (1/3 overhang,   │
│  ───────────────────────────────────────── │   right-connected,│
│                                             │   elevated)       │
│  MAIN DISPLAY (the only "forward" element,  ├──────────────────┤
│  solid hard 2.5px border) — SRD card +      │  DIAL TRACK       │  ← display row
│  grouped actions + roll tables + overlays   │  (shrunk inactive │
│                                             │   items + ▲▼⚙)    │
└───────────────────────────────────────────┴──────────────────┘
```

**A. Top rail** (`railBar()`) — a 40px horizontal bar with a **solid 2.5px
border** (the one hard-bordered frame besides the display). Holds: `◄ Return to
Workspace` (exit), a context stamp, and `⚙ Settings` (Rules & Sources, Dashboard
settings, Downtime entry). In Downtime it swaps to `◄ Leave Downtime` + a
"Downtime" stamp.

**B. Active Item band** (`primaryBand()`) — the 2/3-width "viewfinder". It shows
the **active entity** (mech when boarded / pilot on foot / crawler in downtime)
as a row of **responsibility "bays"** (`ibay()`). Each bay is: a stamped bay
label + its **vital gauge(s)** + a dense **2-column button grid** of the controls
that act on _that_ responsibility. Locked rules from v54→v60:

- **Cross-bay grid alignment:** gauges are top-anchored, button grids are
  bottom-anchored (`margin-top:auto`) with a **uniform 30px button height**, so
  the button baseline is shared across every bay.
- Bays `flex:1` to fill the band width; gauge pips stretch across the bay
  (`.hg-track` flex, `hseg{flex:1}`) — "better use of space, not smaller
  elements."
- **Entity-tinted soft _inset_ border** (v55/v57): the band frame is
  `1.5px var(--line-soft)`, tinted to the active family (mech green / pilot
  orange / crawler pink via `.canvas[data-state] .primeband`), and reads
  _recessed_ (mild `inset` box-shadow) — flat, not 3D.
- Mech bays (v60): **Reactor** (Heat + EP gauges · Push / Heat Chk / Vent /
  Shutdn) · **Chassis** (SP + Cargo gauges · Take Dmg / Storage) · **Loadout**
  (Sys + Mod gauges · Dismount / Eject). Pilot bays: **Vitals** (HP · Take Dmg /
  Crit Inj) · **Re-roll** (AP · Motto / Keepsake) · **Kit** (Inv · Board).
  Crawler bays: **Stores** · **Upkeep** · **Downtime**.

**C. The rotary Dial** (`wheel()`) — a fixed **260px right-edge sidebar** that is
the entity/view selector, styled as a mechanical rotary dial.

- The **Active Dial Item** (`wheel-slot`) sits in line with the Active Item
  band and **overhangs the column to ~1/3 of the row width (420px)**,
  right-edge flush with the dial ("connected"), elevated above its neighbours
  with `z-index`. The Active Item band reserves ~168px padding-right so the
  overhang never covers its controls — leaving the band at ~2/3.
- The **dial track** (`wheel-track`) below it holds the shrunk, uniform-width
  inactive items; `▲▼` step controls + a `⚙` gear span the full column width
  (`wheel-ctl`).
- **Incremental (detented), not free-scroll.** You step with `▲▼`,
  click-to-jump (`data-wheelsel`, shortest direction), or **drag** (pointer drag
  accumulates dy, steps ±1 every 30px, `document`-level move/up so it survives
  the per-step rebuild, `touch-action:none`). Each step plays a direction-aware
  roll animation (`@keyframes wheelroll`, 200–240ms, gated by
  `prefers-reduced-motion`).
- **Statful vs statless dial items** (v55): entity items (Pilot / Mech / Drone
  / Ally / Crawler) render label-stamp + gauges (`wheelMini()`); "verb" items
  (Actions / Tables / SRD Explorer) render a big centered title, no gauges.
- **Dial config** (⚙, v59): overlay to **show/hide** (`S.dialHidden`, Actions
  locked-on) and **reorder** (`S.dialOrder`) dial items.
- **Soft border** (v52): `1.5px var(--line-soft)` on the active dial item and
  track cells — distinct from the display's hard border.

**D. The main display** (`centerMeta()` / `dtDeck()`) — fills the freed left area
below the band. It is the **only element that reads "forward"** (solid hard 2.5px
border, no inset). It is a **META window** that follows dial focus:

- At rest it shows the selected dial item's content (`resourceContent(sel)`):
  the **Actions deck** (default), or an entity's **faithful SRD reference card**
  - its grouped actions, or the **Tables roller**.
- On a deck action press it enters **resolve mode** (`metaBody()`): "resolving
  <action>" → the load→act flow (Activate → Roll → Push-reroll → Apply).
- Roll tables render as SRD roll-table cards (`srdRollTable()`); `[[links]]`
  drill into an entity card (the one sanctioned internal scroll).

### 2.3 Aesthetic — the "workshop manual" instrument

Flat & inset, **not** 3D (v57 lock). The metaphor is an instrument panel /
viewfinder. No drop shadows — nothing floats. Viewfinder frames read _recessed_
(mild inset shadow); instrument buttons are flat recessed keys (`.ibtn`). The
**display is the single "forward" element** (solid border). No CRT bend.

The display renders the **faithful LIGHT SRD entity card** (white body, colored
header, black ink — `srdCard()`/`srdActionCard()`) — a piece of "workshop
paperwork" inset in the dark Dashboard. This is the deliberate contrast: the
instruments are dark and dense; the reference document is light and canonical.

### 2.4 Color ontology (locked color laws)

Hue encodes **ontology, never identity**. State is an _overlay_ carried by
treatment (fill / hatch / strike / redline / stamp), never a second hue.

- **Pilot / ally = orange** (`--pilot #ef894f`, deep `--pilot-deep #a85222`).
- **Mech = green** (`--mech #7a978a`, deep `--mech-deep #2f4338`).
- **Drone identity = TL-blue** (`--drone`), **but its vitals gauge reads
  machine-green** (v20b: gauge instrument is uniformly green for any machine;
  identity chrome stays blue).
- **Crawler = pink** (`--crawler #ce5898`, deep `#7e2a5b`).
- **Tables / dice / system-voice = rust** (`--rust #a85222`) — "the single action
  color."
- **Cargo = ochre material tint** (`--cargo #9c7a3e`).
- **State overlays:** Heat escalates `--warn`→`--bad` (redline) with a ⚠ and a
  pulse near cap; damaged = hatched; destroyed = struck-in-place; roll bands use
  `--cascade/--failure/--tough/--success/--nailed`.

These map to the real repo tokens in `packages/component-lib/src/styles/theme.css`
(`--color-sheet-pilot/-mech/-crawler`, `--color-cargo`, `--color-rust`,
`--color-tl-1..6`, `--color-roll-*`). Fonts are the repo's **Barlow** (body) +
**Barlow Semi Condensed** (stamps/labels), both already embedded via
`@fontsource`. `tabular-nums`/`tnum` is load-bearing on every live numeral.

### 2.5 The state machine

`S.state ∈ { 'pilot', 'mech', 'downtime' }` — three modes, diegetic transitions:

```
        Board Mech (Load Into Mech)
  PILOT ─────────────────────────────►  MECH
 (on foot)  ◄─────────────────────────  (boarded)
        Dismount (calm) / Eject (emergency, confirm-twice)

  PILOT ──── Enter Downtime ────►  DOWNTIME  ──── Leave Downtime ───► (prior state)
                                 (crawler-dominant; S.preDt restores)
```

- **On foot (`pilot`):** pilot is the active entity (orange screen tint). The
  parked mech is reachable via a dial item and is **read-only reference** ("goes
  live when you Load In") with a Load CTA. Pilot abilities/equipment live in the
  Actions deck.
- **Boarded (`mech`):** mech is the active entity (green screen tint), pilot
  demotes to a status card nested in the mech band (HP/AP + Dismount/Eject).
  Pilot-sourced actions keep orange source-spines inside the green world.
- **Downtime (`downtime`):** crawler-dominant (pink), the dial becomes the
  **10 Downtime steps**, the band is a crawler card with the pilot nested; the
  display is the current step's detail + Mark Complete.

Transitions set `S.state`, reset `S.meta` to empty, and re-seed the dial focus
(`data-mount` handler: boarding focuses Pilot idx 1, dismounting focuses Actions
idx 0). The active family drives the whole-screen background tint
(`.canvas[data-state]`).

---

## 3. Reuse contract — `component-lib` vs new Dashboard components

The governing rule (design record v53, user's explicit ask): **the display
reuses the faithful entity-display system; the instruments are new.** Do not fork
the display system for the Dashboard.

### 3.1 Reused verbatim from `component-lib`

| Component (barrel export)             | Path                                                                      | Role in Dashboard                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ReferenceEntityDisplay`              | `components/referenceEntity/ReferenceEntityDisplay/index.tsx`             | The display's entity view — full SRD card for the focused mech/pilot/drone/crawler/ally                        |
| `DisplayCard`                         | `components/shared/DisplayCard.tsx`                                       | The card primitive under it; `footActions`/`footMeta` are the economy injection points (§3.3)                  |
| `ActionCard`                          | `components/referenceEntity/ActionCard.tsx`                               | Each resolvable action in the grouped actions section                                                          |
| `NestedActionDisplay`                 | `components/referenceEntity/NestedActionDisplay.tsx`                      | Lighter action variant where an ActionCard is too heavy                                                        |
| `ReferenceEntityActions`              | `.../ReferenceEntityDisplay/ReferenceEntityActions.tsx`                   | Renders the grouped `SURefMetaAction[]` list (Chassis / Systems / Modules; Abilities / Equipment)              |
| `RollTable`                           | `components/shared/RollTable.tsx`                                         | SRD roll-table rendering (Core Mechanic, Reactor Overload, Critical, Trading, Deterioration, Salvage, Cantina) |
| `StatBlock`, `VitalGauge`, `MiniStat` | `components/stat/*`                                                       | HUD-flavored stat primitives — candidates for the bay gauges (see §3.4)                                        |
| `StatsBar` / `Stat` / `ValueDisplay`  | `components/shared/*`                                                     | Stat readouts inside entity cards                                                                              |
| `ActivationCostBox`                   | `components/shared/ActivationCostBox.tsx` (internal, not barrel-exported) | The AP/EP cost pennant on actions — the Dashboard's `costPennant()` in the mockup                              |

The mockup's `srdCard()`, `srdActionCard()`, `actionsSection()`, `srdBox()`,
`srdPill()`, `costPennant()`, `srdRollTable()` are **hand-rolled facsimiles** of
these components. In the real build they are **replaced by the actual
`ReferenceEntityDisplay` + `ActionCard` + `RollTable`**, so the display is
byte-for-byte the same reference document the rest of the app renders. The
facsimiles exist only because the mockup is a standalone artifact with no access
to the package.

### 3.2 New Dashboard-specific components

Everything that is _instrument_, not _document_, is new and lives under
`apps/itun/src/components/Dashboard/`:

- `DashboardCanvas`, `RailBar`, `ActiveItemBand`, `InstrumentBay`, `VitalGauge`
  (Dashboard variant / or reuse), `InstrumentButtonGrid`, `Dial`, `DialCell`
  (statful/statless), `DialConfig`, and the overlays (`StorageOverlay`,
  `TablePickerOverlay`, `DowntimeWizard`). Full tree in §6.
- The segmented "instrument gauge" (`vbar`/`segGauge`/`gcells` in the mockup) is
  a Dashboard primitive. **Decision point:** evaluate `component-lib`'s `VitalGauge`
  first — if it can express the segmented-pip + redline + projection needle
  (Push +2) look, reuse/extend it rather than adding a parallel gauge. The
  mockup's gauge and `VitalGauge.tsx` are close cousins; do not ship two.

### 3.3 The action-economy injection point (the "foot-meta / rail" pattern)

ITUN already has the exact mechanism the Dashboard extends. There is **no
render-prop** for action economy; instead:

- `DisplayCard` exposes `footActions?: ReactNode` and
  `footMeta?: CardFootMeta[]` (`type CardFootMeta = { label: string; value:
ReactNode }`). `ReferenceEntityDisplay` forwards them. These render the
  economy row in the card foot.
- `Erow` (`src/components/sheet/Erow.tsx`, exports `Erow` + `Ecflow`):
  - `mode='card'` clones the child card to inject `footActions`/`footMeta` into
    its foot (used by `MechItemCard.tsx`).
  - `mode='rail'` renders a 152px right-side callout beside a card that _can't_
    take foot props.
- `ActionCardErow` (`src/components/sheet/ActionCardErow.tsx`) wraps `ActionCard`
  in `Erow mode='rail'` **because `ActionCard` does not accept
  `footActions`/`footMeta`** (it is not an entity card).

**Dashboard contract:** the display's grouped actions section renders each action
as `ActionCard` and injects the Dashboard's `Use ▸` / `Repair` buttons + economy
`footMeta` (`EP Cost`, `Heat`, `Uses`) via the **same `ActionCardErow`
mechanism** (or a Dashboard sibling of it). Entity-level buttons (Load Into Mech,
Enter Downtime, Hand re-roll) go through `DisplayCard.footActions` on the entity
card. We reuse the vocabulary (`CardFootMeta` + `footActions`), never a new
schema-specific renderer.

### 3.4 Render-prop / slot injection points

`ReferenceEntityDisplay` uses **generic slot props**, computed by
`useReferenceEntityDisplayState` and consumer hooks like `useChassisPatternConfig`
(the task's "`classAbilitiesRenderer`" is actually the `abilitiesSection?:
ReactNode` slot prop; there is no prop literally so named). Dashboard injection
points:

- `abilitiesSection` — inject the Dashboard's action-economy-wrapped actions list
  (each action `ActionCardErow`-wrapped with `Use`/`Repair`).
- `statsOverride` — feed live-play values (`currentHP`, `currentSP`, …) so the
  card header reflects table state, not base stats.
- `footerOverride` / `afterExtraContent` — entity-level Dashboard buttons.
- `EntityHrefProvider` (`entityHrefContext.ts`) — route-agnostic links; the
  Dashboard provides an href builder that drills `[[links]]` into the in-display
  entity view rather than navigating away.
- Display-state context (`displayStateContext.ts`) — set `compact`/spacing so
  the reference card fits the display area.

---

## 4. Data & state model

### 4.1 Ephemeral Dashboard state vs persisted entity state

The mockup's `S` object conflates two very different kinds of state. The build
must split them:

| `S` field (mockup)                                                                                                                 | Real home                                                                                                        | Kind                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `heat`, `sp`, `ep`, `hp`, `ap`, `cargo`, `pHP`, `pAP`                                                                              | `Mech.currentHeat/currentSP/currentEP`, `Pilot.currentHP/currentAP`, cargo lots                                  | **Persisted** (mech/pilot records) |
| `heatCap`, `spMax`, `epMax`, `hpMax`, `apMax`, `cargoMax`                                                                          | Derived (`derivedStats.ts`: `mechMaxHeat`, `mechMaxSP`, `mechMaxEP`, `pilotMaxHP`, `pilotMaxAP`, `mechMaxCargo`) | **Derived**                        |
| `shutdown`, `vulnerable`, item `cond`                                                                                              | `Mech.shutdown`, `Mech.vulnerable`, `Mech.systemConditions`/`moduleConditions`, `Pilot.equipmentConditions`      | **Persisted**                      |
| item uses                                                                                                                          | `Mech.itemUses` (`Record<string,number>`)                                                                        | **Persisted**                      |
| `state` (pilot/mech/downtime), `range`, `moveUsed`, `actionUsed`                                                                   | **Dashboard play-state** — NOT on the mech/pilot schema                                                          | **Ephemeral**                      |
| `sel`, `wheel`, `wheelDir`, `meta`, `overlay`, `menu`, `deckFilter`, `srcFilter`, `grouping`, `costChoice`, `hotX`, `confirmEject` | Pure UI / view state                                                                                             | **Transient** (component state)    |
| `dialHidden`, `dialOrder`                                                                                                          | **Per-Dashboard prefs**                                                                                          | **Persisted (prefs)**              |
| `dtStep`, `dtDone`                                                                                                                 | Downtime progress                                                                                                | **Ephemeral or per-run prefs**     |

**Critical boundary (from the design record):** the mount state machine
(pilot↔mech↔downtime, range band, move/action-used) is **Dashboard-only play-state
and must not leak into the mech/pilot schema or snapshots.** There is no hard
"pilot in mech" field in the data model — the pilot↔mech link is a
`mech-to-pilot` SoftLink. So mount state is _derived at Dashboard boot_ (default:
on foot) and held in a **small dedicated `playStateStore`** (Zustand,
non-persisted or session-scoped), never written to `entityStore`.

### 4.2 Persistence & prefs

- **Live-play mutations** go through `entityStore.update('mechs'|'pilots'|
'crawlers', id, patch)` → `crud.ts` (Zod validate-on-write) → IndexedDB → in-
  memory `set()` → broadcast. Exactly the sheet's path (see data-flow.md's HP-edit
  trace). The Dashboard never introduces a second write path.
- **Reference data** resolves by slug through `SalvageUnionReference` after
  `preload()`. **Hazard:** never call ORM accessors at module scope (before
  preload) — wrap in `useMemo`/functions (package-contracts.md).
- **Per-Dashboard prefs** (`dialHidden`, `dialOrder`, chosen table, grouping) are
  **local-first** ([ADR-010] boundary: the shared library never persists —
  ownership lives in ITUN). Store them on the `workspace` record (Rules & Sources
  already live at workspace level per the design record) or a dedicated prefs
  store; do **not** round-trip them through Netlify ([ADR-004]: snapshots are the
  _only_ server surface, immutable, read-only — Dashboard prefs are not snapshot
  data).
- **Snapshots** ([ADR-004]) are unaffected: the Dashboard shares the _same_ entity
  records the sheet publishes; mount/dial/view state is excluded by construction
  (it isn't on the schema).

### 4.3 The ADR-007 automation boundary on every control

Every Dashboard control must be classified. **Auto-apply non-destructive
bookkeeping; require explicit player confirmation for destructive/irreversible
change** ([ADR-007]):

| Control                                                 | Class              | Behavior                                                                                                                                              |
| ------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activate action (EP/AP spend, Hot→Heat, Uses decrement) | Auto               | Apply immediately; block if insufficient (`canActivateAction`)                                                                                        |
| Vent Heat, heat clamp                                   | Auto               | Apply (`clampHeat`)                                                                                                                                   |
| SP damage from overheat                                 | Auto               | Apply (`applySpDamage`)                                                                                                                               |
| `shutdown` / `vulnerable` flags                         | Auto               | Set by overload outcome                                                                                                                               |
| Take SP / HP damage (self-declared)                     | Auto value, but... | Apply the number; the _resulting_ critical table is a roll (below)                                                                                    |
| Push                                                    | Player-confirm-ish | Reversible resource change (+2 Heat) but arms a Heat Check; single click, clearly labeled                                                             |
| **Destroy a System/Module** (overload/critical result)  | **Player-confirm** | Never auto-marked; sets `requiresPlayerChoice` (advisory), player toggles condition via `ConditionToggle`; offer Undo toast (`destroyedUndoToast.ts`) |
| **Eject**                                               | **Player-confirm** | Click-twice confirm (`S.confirmEject`)                                                                                                                |
| **Meltdown**                                            | **Player-confirm** | Sets mech `destroyed`; the most destructive outcome, always explicit                                                                                  |

The rules functions **return** outcomes; the Dashboard decides what crosses into
durable destructive state. Reversible destructive writes get a visible reversal
(inline Clear strip or Undo toast), matching the sheet.

---

## 5. Rules interactions

The Dashboard is a thin driver over the existing pure rules engine. **It calls
these functions; it never reimplements the math.**

### 5.1 Heat / Push / Overload (the signature drama)

- **Push** (`performPush({heat, heatCap, currentSP, roll})` in
  `src/lib/rules/heatCheck.ts`): reroll + 2 Heat, then forces a **Heat Check**.
  Gate on `canPush(currentHeat, heatCap)` (`combatUtils.ts`). The Reactor bay's
  Push button shows a **+2 projection** on the Heat gauge on hover
  (`S.pushArmed`).
- **Heat Check** (`performHeatCheck({heat, currentSP, roll})`): d20 ≤ Heat →
  Reactor Overload.
- **Reactor Overload** (`reactorOverloadOutcome(roll)`): bands a **d20** —
  `1` meltdown, `2–5` system-destroyed, `6–10` module-destroyed, `11–19`
  overheat, `20` safe. **⚠ Caveat (combat-loop.md):** low roll = worse, the
  _opposite_ of the core 2d6 mechanic. The Dashboard UI must present this
  unambiguously (it's a d20-vs-Heat check, not "roll high") — see open questions.
- **Overheat** effect: mech shuts down (`shutdown`), gains `vulnerable`,
  re-activates next turn, takes SP = current Heat (auto-applied SP damage).
- **Vent Heat** / **Shutdown** are Reactor-bay buttons; Vent sets Heat→0 (+
  `vulnerable`), Shutdown toggles the flag.
- `heatCheckPatch(effect, currentHeat)` produces the `Partial<Mech>` to write.

### 5.2 Action activation

- Actions attach to entities as **arrays of action names** (`actions:
string[]`), resolved by `SalvageUnionReference.resolveActions(entity)` →
  `SURefMetaAction[]` (delegates to `getChassisAbilities ?? extractActions`).
- **Currency:** `resolveActivationCurrency(schemaName, variable)` → `'AP' | 'EP'
| 'XP'` (chassis/systems/modules → EP; else AP; variable → XP). The action's
  own `activationCurrency` data field is the enum `'EP or AP' | 'SP or HP' |
'Variable'` — when it's `'EP or AP'` the Dashboard offers the EP/AP choice
  (mockup `S.costChoice`), matching the pilot-ability-through-mech case.
- **Hot** and **Uses** are **traits**, not costs: `Hot (X)` → heat gained on
  activation, `Uses (X)` → `maxUses`. ITUN's `itemEconomy()`
  (`src/components/sheet/mechItemRules.ts`) computes `{ epCost, heat, maxUses }`
  from the primary action; the Dashboard uses the same helper.
- Activation flow in the display: **Activate** (pay cost + Hot heat, decrement
  Uses, mark action used) → if the action deals damage / is contested, **Roll**
  (Core Mechanic) → optional **Push** reroll → **Apply**. Pure-effect actions
  (Vent/Brace) skip straight to Apply.
- Blocking: `canActivateAction` greys chips that would exceed Heat Cap; range
  band dims out-of-reach chips in place; damaged/destroyed items render
  struck/hatched (never hidden).

### 5.3 Damage → Critical tables

- **Take SP damage:** `applyMechDamage` / `mechEffectiveDamage`; at SP 0 →
  **Critical Damage** table (`criticalDamageOutcome` / `performCriticalDamage`).
- **Take HP damage:** `applyPilotDamage` / `pilotEffectiveDamage`; at HP 0 →
  **Critical Injury** table (`criticalInjuryOutcome` / `performCriticalInjury`).
- A single damage event can queue two rolls (SP-0 Critical Damage, HP-0 Critical
  Injury). Critical results that destroy items set `requiresPlayerChoice` — never
  auto-destroyed (ADR-007).

### 5.4 Cargo / storage

- Mech cargo tracked as cargo lots; capacity via `cargo.ts`
  (`computeCargoCapacity`) / `capacity.ts`. The **Storage** button opens the cargo
  hold overlay (manifest + Jettison decrements a slot).

### 5.5 Downtime loop

- The 10-step downtime sequence maps to `src/lib/rules/downtime.ts`
  (`allDowntimeSteps`, `DOWNTIME_STEP_KEYS`, `resolveDowntimeScope`,
  `downtimeMechPatch`, `downtimePilotPatch`, `medBayStatus`/`mechBayStatus`,
  `repairableItems`, `healableInjuries`) plus `crawlerEconomy.ts` (`payUpkeep`,
  `upkeepShortfall`, `deteriorationOutcome`/`performDeterioration`,
  `tradingAvailability`/`performTradingRoll`, `bayGate`) and `crafting.ts`
  (`craftableAtTl`, `craftQuote`).
- Two phases: **Post-Session** 1–8 (Tally Salvage → Upkeep & Upgrade → Restore
  Mech & Pilot → Trade → Craft → Customise → Train → Obtain Equipment),
  **Pre-Session** 9–10 (Cantina Rumours → Prepare Run). Each step is gated on its
  bay being intact + fronted by its lead NPC.
- **Restore** (SP/EP/Heat→0, HP/AP) is **auto but bay-gated**; only **unpaid
  Upkeep** forces a roll (Deterioration). The mockup's `DOWNTIME` array and step
  gating are the faithful shape — the real build drives the step gates from
  `downtime.ts` scope resolution, not hard-coded data.

### 5.6 Roll tables generally

- `SalvageUnionReference.RollTables.all()` supplies ~96 d20 tables; rows are keyed
  bands. Both Core Mechanic and Reactor Overload are `standard` tables. The
  picker groups them by **app-side categories** (there is no category field in the
  data). Roll-first UX: show the hit row + neighbors, full table on demand,
  `[[Name]]` links drill into the entity card.

---

## 6. Component architecture

New tree under `apps/itun/src/components/Dashboard/`. Naming follows
the mockup's function names so the two can be cross-referenced.

```
DashboardCanvas                      ← fixed 1280×800 grid; scale-to-fit + reflow decision
├── RailBar                        ← rail: exit · context stamp · Settings menu
├── ActiveItemBand                 ← 2/3 viewfinder; per-state (mech/pilot/crawler)
│   └── InstrumentBay  (× N)       ← responsibility cluster: label + gauges + button grid
│       ├── VitalGauge  (× 1–2)    ← segmented pip gauge (Heat redline / SP / EP / HP / AP / Cargo)
│       └── InstrumentButtonGrid   ← dense 2-col grid, uniform 30px keys (Push/Vent/Take Dmg/…)
├── Dial                           ← 260px right sidebar (rotary selector)
│   ├── DialCell (active)          ← Active Dial Item: overhangs to ~1/3, elevated, statful/statless
│   ├── DialCell (track × N)       ← shrunk inactive items
│   ├── DialControls               ← ▲ ▼ ⚙ (step / config)
│   └── DialConfig (overlay)       ← show/hide + reorder
├── Display                        ← the one "forward" surface
│   ├── AtRest:
│   │   ├── ActionsDeck            ← default: cross-source action grid (acell / deckInner)
│   │   ├── EntityView             ← ReferenceEntityDisplay + grouped ReferenceEntityActions
│   │   │                            + entity-level footActions (Load/Downtime/Hand re-roll)
│   │   └── TablesRoller           ← RollTable + picker + Roll
│   ├── ResolveMode:
│   │   └── ActionResolver         ← Activate → Roll → Push → Apply (metaBody / metaButtons)
│   └── Overlays:
│       ├── StorageOverlay         ← cargo hold manifest + Jettison
│       ├── TablePickerOverlay     ← 5-col grouped picker
│       └── DowntimeWizard         ← 10-step guided sequence (in downtime state)
└── (state) playStateStore         ← mount state, range, dial focus (ephemeral)
```

**Data resolution:** a `useDashboardComposition(id)` hook wraps the existing
`resolveSheetComposition()` (`src/components/sheet/composition.ts`) → `{ pilot,
mech, crawler }`, plus SoftLinks (drones/allies). This is the same data spine the
live sheet uses; the Dashboard does not introduce a new loader.

**Render strategy / performance:** the mockup rebuilds the entire canvas on every
interaction (`mountCanvas()`). In React that becomes a single `<DashboardCanvas>`
subscribing to `entityStore`/`playStateStore` selectors, with **memoized
sub-trees** per surface so a dial step doesn't re-render the display's SRD card
and a Heat change doesn't rebuild the dial. Do not port the full-rebuild pattern
— it is a prototype artifact (see open questions on perf).

**Scale-to-fit:** a `useScaleToFit(1280, 800)` hook measures the viewport,
computes `scale`, decides `reflow` below the floor. The scaler wraps the fixed
canvas in `transform: scale()`; below floor it renders `<DashboardPhone>` instead.

---

## 7. Mobile / reflow behavior

- No-scroll is a **landscape-desktop contract**. Below ~0.62× scale the fixed
  canvas is abandoned for a **native stacked, scrolling phone layout**
  (`DashboardPhone`): rail → active item bays (stacked) → dial as a horizontal
  strip or a bottom sheet → display. Scrolling _is_ allowed there.
- The phone layout reuses the same instrument components in a single column; the
  dial degrades to a horizontal chip strip. This keeps one component set, two
  layouts (mirrors the sheet's "one shell, three variants" `LiveSheet.tsx`).

---

## 8. The launch flow (deferred — plan only)

Deferred per the design record ("one new view for the NEXT iteration"), but the
plan is:

1. **Workspace "Launch Dashboard" entry** — a button on the Roster / workspace
   (`workspaceStore`).
2. **Chooser** (a small wizard):
   - **Pick a pilot** (from `entityStore` pilots).
   - **Pick a mech** — either one of that pilot's linked mechs (via SoftLink) or a
     **stand-in pattern** (`mechPatterns` store) instantiated as an ephemeral mech
     for the session.
   - **Pick a crawler** — a saved crawler, or a **default base crawler of a chosen
     Tech Level** (built from `crawler-tech-levels` reference data).
3. **Boot** — resolve composition, seed `playStateStore` (default on foot), route
   to `/dashboard/$id`.

The route (`/dashboard/$id`) is modeled on `/encounter` (full-screen, no sheet chrome)
and reuses the `/sheet/$kind/$id` loader + `resolveSheetComposition()`. The stand-
in/default-crawler instantiation must **not** silently persist new records — a
session stand-in is ephemeral unless the player saves it (mirrors "loadout savable
as a new pattern", memory note _su-mech-name-is-pattern_).

---

## 9. Phasing / milestones

Each phase is independently shippable and testable.

1. **Read-only shell.** `/dashboard/$id` route, `DashboardCanvas` grid, scale-to-fit +
   reflow, rail, static bays/dial/display reading live values via composition.
   No mutations. Ships as a "play view" of a mech.
2. **Gauges + state wiring.** Bind gauges to `currentHP/SP/EP/Heat` + derived
   maxima. Wire the mount state machine (`playStateStore`): Board / Dismount /
   Eject transitions + screen tint. Still read-mostly (transitions only).
3. **Dial.** Rotary selector: `▲▼`, drag, click-to-jump, animation, statful/
   statless cells, focus→display sync.
4. **Display entity cards.** Swap facsimiles for real `ReferenceEntityDisplay` +
   `ReferenceEntityActions` + `RollTable`; entity-level `footActions`.
5. **Actions & rules.** Actions deck, `ActionCardErow`-wrapped resolve flow
   (Activate/Roll/Push/Apply), heat/push/overload, damage→critical, all through
   the pure rules functions with the ADR-007 boundary enforced.
6. **Downtime.** Downtime state, 10-step wizard driven by `downtime.ts` +
   `crawlerEconomy.ts` + `crafting.ts`.
7. **Dial config & storage.** Show/hide + reorder prefs (persisted to workspace),
   cargo-hold overlay + Jettison, table picker.
8. **Launch chooser.** The workspace entry + chooser wizard (§8).

---

## 10. Testing, a11y, CSP, risks & open questions

### 10.1 Testing

- Bun test per workspace — **never raw `bun test` at root** (skips workspace
  bunfig preloads). Use `bun --filter itun test`.
- **Rules functions are already unit-tested** in `salvageunion-reference` and
  `src/lib/rules/__tests__`; the Dashboard adds no rules math to test, only the
  wiring. Test the **classification boundary** (ADR-007): assert destructive
  outcomes surface a confirm/undo and never auto-write a condition.
- Test the ephemeral/persisted split: mount state changes must **not** write to
  `entityStore` / appear in a snapshot.
- Test scale-to-fit math + the reflow threshold (pure function
  `useScaleToFit`).

### 10.2 Accessibility (WCAG 2.1 AA)

- The dial is a `role="listbox"` with `option` cells and `aria-selected`
  (already in the mockup). `▲▼` must be keyboard-operable; drag needs a keyboard
  equivalent (arrow keys when focused).
- `:focus-visible` outlines (`--focus`: rust light / pilot-orange dark).
- `prefers-reduced-motion` gates the wheel animation and heat pulse (already
  gated in the mockup).
- Color laws pair every hue with a **non-color cue** (hatch/strike/label/redline)
  — required for color-blind users and AA.
- Both light and dark themes must pass contrast (the mockup ships both; the design
  record flags that a real screenshot contrast check on the orange pilot-card bg +
  Heat redline is still outstanding — do it during build).
- Run `/a11y-scan` (puppeteer + axe-core) — note it needs an unsandboxed Chrome
  (memory: _a11y-scan-needs-unsandboxed-chrome_), so run interactively.

### 10.3 CSP ([ADR-013])

- Strict CSP, no `unsafe-eval`. Zod must stay jitless: import `z` from
  `packages/salvageunion-reference/lib/zod.ts`, **never** from `zod` directly
  (enforced by `noRestrictedImports`).
- Fonts are inlined via `@fontsource` (Barlow / Barlow Semi Condensed) — no CDN.
- No inline `eval`/`new Function` in any Dashboard code.

### 10.4 Scale-to-fit vs accessibility zoom (open tension)

`transform: scale()` fixed-canvas fights browser zoom / OS text scaling — a user
who zooms to 200% gets a scaled-down canvas, not larger text. **Open question:**
below a scale threshold, or when the user has a large system font / zoom, should
we prefer the **reflow phone layout** (which respects zoom and scrolls) even on
desktop? Leaning yes — treat "needs bigger text" as a reflow trigger, not just
"small viewport". Needs a11y review.

### 10.5 Risks & open questions

- **Overload-table direction.** `reactorOverloadOutcome` is d20 **low = worse**,
  opposite the core mechanic. High risk of player misread in a fast HUD. The UI
  must frame it as "d20 vs Heat" explicitly, not "roll high". (Caveat flagged in
  combat-loop.md.)
- **Coexistence with live sheets.** Both mutate the same records via the same
  store + broadcast, so state is consistent — but do we allow both open at once
  (two tabs)? Likely fine (broadcast handles it), but confirm no write races on
  `itemUses`/conditions.
- **Full re-render performance.** The mockup rebuilds everything per interaction;
  React must not. Memoize per-surface; verify a Heat tick doesn't re-render the
  SRD card. Measure before shipping phase 5.
- **`VitalGauge` reuse vs new gauge.** Decide in phase 2 whether the Dashboard gauge
  is `component-lib`'s `VitalGauge` extended or a Dashboard primitive — do not ship
  two gauge systems.
- **Stand-in mech / default crawler persistence.** Session stand-ins must be
  ephemeral unless saved; define the boundary in phase 8.
- **Targeting.** ITUN has no enemy/GM model (local-first). Ship the lightweight
  "declare a range band" version; defer entity-selection UI.
- **Downtime data source.** The mockup hard-codes the `DOWNTIME` array; the real
  build must drive step gates from `downtime.ts` scope resolution + bay status,
  not duplicated constants.
- **Screenshot verification outstanding.** Per the design record, several v53→v60
  density/contrast decisions were made "blind" (no in-sandbox Chromium). The first
  built phase should get a real screenshot pass on light/dark contrast, the 2/3 :
  1/3 band-vs-dial proportion, and the overhang not clobbering band controls.

---

## 11. Architecture Decision Records

Building the Dashboard commits us to several architectural decisions, now
**materialized as ADR files** ([ADR-015](../adrs/ADR-015-dashboard-distinct-play-surface.md)
… [ADR-020](../adrs/ADR-020-dashboard-fixed-canvas-scale-to-fit.md), Status:
Proposed until the phase that realizes each ships). They sit under the governing
surface taxonomy ([ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md)) and its
provenance companion ([ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md)).
The summaries below are the design rationale for each, in the order they become
load-bearing; the ADR files are the authoritative records.

### ADR-015: Dashboard is a distinct actual-play HUD, separate from live sheets

- **Decision.** The Dashboard is a **new surface** at `/dashboard/$id`, not a mode
  of the live sheet. Sheets edit a character; the Dashboard runs it at the table.
  Both read and mutate the **same** persisted entities through the **same** store
  and rules engine ([ADR-006], [ADR-003]) — the Dashboard is a second lens, not a
  second source of truth.
- **Rationale.** The two moments have opposite interaction grammars (inline edit +
  scroll vs. one-screen no-scroll instrument buttons). Forcing both into one
  surface produced the clutter the redesign set out to kill. Sharing state (not
  chrome) keeps them consistent via the existing multi-tab broadcast.
- **Alternatives rejected.** (a) A "play mode" toggle on the sheet — rejected: the
  layouts are irreconcilable in one component. (b) A separate app — rejected:
  duplicates the data layer and breaks local-first single-store consistency.

### ADR-016: The rotary Dial selector and the instrument/reference split

- **Decision.** Entity/view selection is a **rotary Dial** (a 260px right-edge
  sidebar): the **Active Dial Item overhangs to ~1/3 of the row and dominates the
  main display**, while the display holds all interactivity and the dial holds
  readable stats only. The Dashboard is thereby split into **bespoke instruments**
  (rail, bays, dial) and **the reference document** (the display).
- **Rationale.** A detented dial gives a game-console "select your loadout" feel,
  keeps one selector for all entities/views, and the overhang/viewfinder framing
  makes "what you selected" and "what's showing" one continuous read. The
  instrument/document split is what lets us reuse the faithful display (ADR-017)
  without the reference document fighting the HUD chrome.
- **Alternatives rejected.** Left tabs, right drawers, a center tab bar, and
  bottom selector blocks were all built and rejected across v10→v41 as either
  reflowing the fixed frame or burying entities. Free-scroll (non-detented) was
  rejected as imprecise for a keyboard/drag HUD.

### ADR-017: Reuse the faithful light SRD display; instruments are bespoke

- **Decision.** The display renders the **actual** `ReferenceEntityDisplay` +
  `ActionCard` / `NestedActionDisplay` + `ReferenceEntityActions` + `RollTable`
  from `component-lib` — the same light "workshop paperwork" reference document the
  rest of the app shows. Action economy is injected through the existing
  `Erow` / `ActionCardErow` + `DisplayCard.footActions`/`footMeta` pattern, **not**
  a new schema-specific renderer. Only the _instruments_ (gauges, bays, dial,
  buttons) are new Dashboard components.
- **Rationale.** One display system, one place to fix reference rendering, and the
  Dashboard's reference view stays byte-for-byte identical to the sheet's. The
  foot-meta vocabulary already carries action economy in the sheet; extending it
  avoids forking the display ([ADR-011]).
- **Alternatives rejected.** A Dashboard-specific "action chip" display (forking the
  entity display) — rejected per the design record's explicit "reuse the display
  system" call. A render-prop on `ActionCard` for economy — unnecessary; `Erow`
  already solves it.

### ADR-018: Instrument/viewfinder aesthetic — flat & inset, only the display reads forward

- **Decision.** The Dashboard is **flat and inset, not 3D**. Instrument surfaces
  (rail excepted) read _recessed_ (mild inset shadow, soft entity-tinted borders);
  buttons are flat recessed keys; **the main display is the single element that
  reads "forward"** (solid hard 2.5px border, no inset). Hue encodes ontology,
  never identity; state is a treatment overlay (hatch/strike/redline), never a
  second hue.
- **Rationale.** The recessed instruments + one forward document create the
  "workshop manual under glass" read and make the display the unambiguous focus.
  The color laws keep a dense HUD legible and color-blind-safe (AA).
- **Alternatives rejected.** Skeuomorphic 3D dials and a CRT-bend were considered
  and rejected as "too cute". Per-source color chips that let hue mean identity
  were rejected in favor of hue = ontology + non-color state cues.

### ADR-019: Dashboard play-state & prefs are ephemeral/local-first, under the ADR-007 boundary

- **Decision.** The **mount state machine** (pilot/mech/downtime, range band,
  turn flags) and dial focus are **ephemeral Dashboard play-state** held in a
  dedicated non-persisted `playStateStore` — **never** written to the mech/pilot
  schema and **never** in a snapshot. **Dial config** (show/hide, order) and view
  prefs are **local-first** on the workspace record (IndexedDB), never the backend
  ([ADR-004] leaves snapshots the only server surface). Every Dashboard control obeys
  the [ADR-007] boundary: auto-apply non-destructive bookkeeping (EP/Heat/uses/SP),
  player-confirm destructive change (destroy item, Eject, meltdown).
- **Rationale.** There is no hard "pilot in mech" field (the link is a SoftLink),
  so mount state is genuinely a play-session concern, not character data. Keeping
  it out of the schema prevents it leaking into sheets and shared snapshots.
- **Alternatives rejected.** Storing mount/range on the mech record — rejected:
  pollutes the schema and snapshots. Syncing Dashboard prefs via the snapshot
  backend — rejected: violates the single-server-surface and immutability rules of
  [ADR-004].

### ADR-020: Fixed 1280×800 scale-to-fit canvas with a phone-reflow floor

- **Decision.** The Dashboard is a **fixed 1280×800 design canvas** scaled with a
  single `transform: scale(min(vw/1280, vh/800))`, letterboxed, clamped to
  ~`[0.62, 1.3]`. No-scroll is a **landscape-desktop contract**; below the clamp
  floor (and, tentatively, under large accessibility zoom) the canvas is abandoned
  for a **native stacked, scrolling phone layout** reusing the same instrument
  components.
- **Rationale.** A fixed canvas is the only way to guarantee "always one screen,
  never scrolls" across desktop sizes without per-breakpoint layout churn. The
  reflow floor is the escape hatch that keeps phones (and zoom users) usable.
- **Alternatives rejected.** A fully responsive fluid grid — rejected: cannot
  guarantee no-scroll at all sizes and reflows the locked frame. Scaling with no
  floor — rejected: fights browser zoom and becomes illegibly small on phones
  (see the scale-vs-zoom open question in §10.4).

---

## Appendix — mockup → real mapping (quick reference)

| Mockup symbol                                          | Real equivalent                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `S` object                                             | `playStateStore` (ephemeral) + `entityStore` records (persisted) + component state       |
| `MECH_DECK`/`FOOT_DECK`/drone `acts`                   | `SalvageUnionReference.resolveActions(entity)` over composed entities                    |
| `TABLES`                                               | `SalvageUnionReference.RollTables.all()`                                                 |
| `DOWNTIME`                                             | `src/lib/rules/downtime.ts` (`allDowntimeSteps` + scope/gating)                          |
| `srdCard()`/`srdActionCard()`/`actionsSection()`       | `ReferenceEntityDisplay` + `ActionCard`/`NestedActionDisplay` + `ReferenceEntityActions` |
| `srdRollTable()`/`tablesRollerView()`                  | `RollTable` (`component-lib`)                                                            |
| `vbar()`/`segGauge()`/`gcells()`                       | Dashboard `VitalGauge` (evaluate reusing `component-lib` `VitalGauge`)                   |
| `metaButtons()`/`metaAct()` (Activate/Roll/Push/Apply) | `ActionResolver` calling `heatCheck.ts`/`takeDamage.ts`/`itemEconomy()`                  |
| `performPush`/`Heat Check`/`Reactor Overload`          | `performPush`, `performHeatCheck`, `reactorOverloadOutcome` (`heatCheck.ts`)             |
| foot-meta economy                                      | `Erow`/`ActionCardErow` + `DisplayCard.footActions`/`footMeta`                           |
| `resolveSheetComposition` (mockup ref)                 | `resolveSheetComposition()` (`src/components/sheet/composition.ts`)                      |

<!-- Link reference definitions for the [ADR-xxx] shorthands used above. -->

[adr-001]: ../adrs/ADR-001-local-first-no-backend.md
[adr-003]: ../adrs/ADR-003-zustand-hydration.md
[adr-004]: ../adrs/ADR-004-snapshot-netlify-functions.md
[adr-006]: ../adrs/ADR-006-pure-rules-logic.md
[adr-007]: ../adrs/ADR-007-automation-boundary.md
[adr-010]: ../adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md
[adr-011]: ../adrs/ADR-011-component-lib-source-no-build.md
[adr-013]: ../adrs/ADR-013-csp-zod-jitless.md
