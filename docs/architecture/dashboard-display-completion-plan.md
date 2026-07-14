# Dashboard "Display" — Completion Plan

> **Status:** Planning / remediation record. **Scope: the Display (center panel)
> functionality only** — the context-driven content area that follows dial focus
> (Actions deck, Resolve flow, Tables, SRD Explorer, Entity view). This is a plan,
> not an implementation.
>
> **Reference artifacts:**
>
> - **The mockup** — the "Cockpit" Claude Artifact (the original interactive
>   prototype; self-titled _"ITUN · Play Cockpit — interactive prototype"_,
>   grounded at `0897124d`): <https://claude.ai/code/artifact/8b78136d-e7ee-4853-8b03-6812ee649ed0>.
>   It was authored outside the repo and **never committed** (verified via
>   `git log --all -S` pickaxe on every mockup identifier), so the artifact is the
>   only source of truth for the intended Display behavior.
> - **The prose spec** — [`dashboard.md`](dashboard.md) §2.2.D + §6 (describes the
>   mockup by function name but does not reproduce its controls in full).
> - The `suref-react` render stack the Display reuses:
>   [`display-system.md`](display-system.md); the play-state model the resolve flow
>   drives: [`combat-loop.md`](combat-loop.md); and ADRs
>   [016](../adrs/ADR-016-dashboard-rotary-dial-instrument-split.md) /
>   [017](../adrs/ADR-017-dashboard-reuse-faithful-srd-display.md) /
>   [007](../adrs/ADR-007-automation-boundary.md).

---

## 1. What "the Display" is

The **Display** is the lower-left `pc-display` grid cell — the one "forward"
surface, a **context window that follows the Dial's focus** (`centerMeta()` in the
mockup). Selecting a different dial item swaps the whole panel. In code it is
[`DisplayView.tsx`](../../apps/in-the-union-now/src/components/dashboard/DisplayView.tsx)
(replaced by `DowntimeWizard` during Downtime), with the Actions mode delegated to
[`ActionsDeck.tsx`](../../apps/in-the-union-now/src/components/dashboard/ActionsDeck.tsx).

The Dashboard's _instruments_ (RailBar, ActiveItemBand + its live reactor / damage /
critical / meltdown / cargo overlays, Dial, DialConfig, DashboardChooser,
DowntimeWizard, `dashboardRules`) are largely complete. **The drift is in the
Display's content and controls** — the mockup's center panel is a rich, filterable,
searchable instrument; the build renders a thin subset. This plan closes that.

## 2. Intended Display functionality (from the Cockpit mockup)

The mockup's center panel has five modes; the header (`center-title`) maps the dial
focus to `self→Actions`, `tables→Tables`, `srd→SRD Explorer`, entity→its sheet card.

### 2.1 Actions deck (default, `self` focus) — a filterable action instrument

Controls above the `deckgrid`:

- **Timing filter tabs** — `All · Turn · Free · React` (filter by an action's timing
  group).
- **Source-filter tags** — one button per deck owner (pilot / mech / each drone),
  family-colored (`fam-pilot`/`fam-mech`/`fam-drone`), _"Filter the deck to
  '&lt;label&gt;' actions."_
- **Grouping toggle** — `Timing ⇄ Source` (_"Group by timing" / "Group by source"_).
- **Range selector** — `C · M · L · F` (Close/Medium/Long/Far) + a **reach readout**
  (`reachStr()`, e.g. _"7 / 12 in reach"_ — counts in-reach, non-heat-locked,
  non-destroyed actions).
- **Deck ⋯ menu** — Open Locker · Filter (source/range) · Grouping · Show passives.
- **Action cards (`acell`)** — a source stamp (CHS/SYS/MOD/ABL/EQP), name, and
  micro-meta (range / dmg / HOT / traits). **Out-of-range / overheated / destroyed
  actions are dimmed and locked in place** (titles _"Out of range / overheat",
  "Heat-locked"_), never hidden.

### 2.2 Resolve flow (loaded action) — `Activate → Roll ⬡ → ⟳ Push → Apply`

- `◀ Back` / `Clear`, then state-dependent buttons: **Activate** (pay cost + Heat,
  for no-roll actions), **Roll ⬡** (Core Mechanic d20), **⟳ Push** (reroll, +2 Heat,
  forces a Heat Check — shown only if `heat+2 ≤ cap` and boarded), **Apply**
  (_"Commit this result"_).
- **Cost — EP or AP** radios (`2 EP / 2 AP`) when a pilot action fires through the
  mech.
- **Hot (X) stepper** (`− value +`) — previews heat cost, projects heat-vs-cap,
  disables when it would exceed cap.
- Roll outcomes render the SU bands (Cascade Failure / Failure / Tough Choice /
  Success / Nailed It) with their band colors.

### 2.3 Tables roller

- Mini bar: `▾ <table>` picker + `Roll` (result + follow-ups render in the panel).
- **Full picker overlay** — a **5-column grid, one column per category:
  `COMBAT · PILOT · SALVAGE · CRAWLER · DOWNTIME`**, each a stamped column of table
  buttons.
- Tables ⋯ menu: Pick a table · Roll settings · Roll history · Clear result.

### 2.4 SRD Explorer (`srd` focus)

- **Search box** — _"Search the SRD — chassis, systems, abilities, tables…"_
- **8 category tiles** — Chassis (CHS) · Systems (SYS) · Modules (MOD) · Pilot
  Abilities (ABL) · Equipment (EQP) · NPCs (NPC) · Crawler Bays (BAY) · Roll Tables
  (TBL).
- Result cards drill into the real `ReferenceEntityDisplay` (the mockup stubs this
  with _"Full ReferenceEntityDisplay renders here."_).

### 2.5 Entity view (pilot / mech / crawler / drone / ally focus)

- The faithful sheet-style reference card + entity-level buttons (Full sheet → /
  View mech sheet / Restore Mech & Pilot / Customise / Un-link), with live-play
  stats.

## 3. Built vs. intended — the Display functionality gap

Verified against `DisplayView.tsx` + `ActionsDeck.tsx` in the current worktree.

| Display capability (mockup)                                                              | Built today                                       | Status                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------ |
| Actions **timing tabs** (All/Turn/Free/React)                                            | —                                                 | **Missing**                          |
| Actions **source-filter tags**                                                           | —                                                 | **Missing**                          |
| Actions **grouping toggle** (Timing⇄Source)                                              | Hardcoded group-by-source                         | **Missing (fixed grouping)**         |
| Actions **range selector + reach readout**                                               | —                                                 | **Missing**                          |
| `acell` **source stamps + micro-meta** (range/dmg/HOT/traits)                            | Name + EP only                                    | **Partial**                          |
| Action **dim/lock states** (out-of-range / heat-locked / destroyed)                      | —                                                 | **Missing**                          |
| Resolve **Apply** step                                                                   | Activate/Roll/Push only                           | **Missing**                          |
| Resolve **Cost EP/AP** radios                                                            | —                                                 | **Missing**                          |
| Resolve **Hot(X) stepper** + cap projection                                              | —                                                 | **Missing**                          |
| Deck ⋯ menu (Locker / Filter / Grouping / Passives)                                      | —                                                 | **Missing**                          |
| Tables **5-column category picker**                                                      | Plain alphabetical `<select>`                     | **Partial**                          |
| Tables **roll history / settings / clear**                                               | —                                                 | **Missing**                          |
| **SRD Explorer** search box                                                              | —                                                 | **Missing (hard stub)**              |
| **SRD Explorer** 8 category tiles + entity drill-in                                      | Placeholder note                                  | **Missing (hard stub)**              |
| **EntityView** — grouped `ReferenceEntityActions` + `footActions` + live `statsOverride` | Bare card (chassis/class); crawler is a text note | **Partial (largest structural gap)** |
| On-foot Actions deck (pilot-sourced)                                                     | Always the boarded mech deck                      | **Missing**                          |
| `[[links]]` drill into in-display entity card                                            | Navigates away / not wired                        | **Missing**                          |

Evidence: `ActionsDeck.tsx` contains **no** filter / source / grouping / range /
cost-choice / Hot-stepper controls (only `Activate`/`Roll`/`Push`); `DisplayView.tsx`
Tables uses a bare `<select>` (`:49-82`), SRD is a placeholder (`:87-92`), and entity
focuses render a bare `ReferenceEntityDisplay` with no `footActions`/`statsOverride`/
`ReferenceEntityActions`/`EntityHrefProvider` anywhere in `components/dashboard/`.

## 4. Data & reuse foundations (dependencies resolved)

All §6 open questions from the first draft were investigated against the code. The
Display is buildable on existing data + shared components; only two controls need
Dashboard-authored logic, and drone/ally support is out of scope.

### 4.1 Action metadata — all filters/micro-meta are data-backed

The action type is `SURefMetaAction` = `ActionSchema`
(`packages/salvageunion-reference/lib/schemas/objects.ts:674`). Fields the deck needs:

| Deck feature           | Field / helper                                           | Notes                                                                                                                                               |
| ---------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timing tabs            | **`action.actionType`** (not `timing`)                   | enum `Passive/Free/Reaction/Turn/Short/Long/DownTime`; `getActionTypes()` lists them. "React"→`Reaction`; **bucket or drop** `Short/Long/DownTime`. |
| Range selector + reach | **`action.range: ('Close'\|'Medium'\|'Long'\|'Far')[]`** | clean enum array — backs C/M/L/F directly; no prose parsing.                                                                                        |
| Damage micro-meta      | `action.damage {damageType:'HP'\|'SP', amount}`          | already rendered by `ActionCard`.                                                                                                                   |
| HOT micro-meta         | trait `{type:'hot', amount}`; economy `heat`             | `traits[].type` is lowercase (`'hot'`,`'uses'`).                                                                                                    |
| Traits micro-meta      | `action.traits: {type, amount?}[]`                       | already rendered.                                                                                                                                   |
| Source stamp           | group source + `action.actionSource` schema              | CHS/SYS/MOD/ABL/EQP.                                                                                                                                |

`SalvageUnionReference.resolveActions(entity)` preserves all of these (nothing
stripped). **Decided (§7):** the deck **lists every action** — a multi-action
system/module surfaces each action as its own card, so `buildMechActions` must be
widened beyond today's primary-action-per-item (`dashboardRules.ts:249`).

### 4.2 Two controls need Dashboard-authored logic (no stored backing)

- **EP/AP cost radio.** `resolveActivationCurrency(actionSource)` is _deterministic_
  (systems/modules/chassis→EP, else AP); the action's `activationCurrency:'EP or AP'`
  enum is descriptive text no helper consumes. A genuine EP-vs-AP choice (the
  pilot-through-mech case) must be authored in the Dashboard, branching on
  `activationCurrency === 'EP or AP'`.
- **Hot(X) stepper.** `amount` can be the literal `'X'`; today `itemEconomy` /
  `chassisActionEconomy` collapse `'X'`→`+1` heat (`traitAmount` returns 0). A real
  stepper needs Dashboard-local state; the data only marks heat as _variable_, not a
  value/range. (Uses(X) collapses to 0 the same way.)

### 4.3 Reuse-point API (verified) — prop names are correct verbatim

`ReferenceEntityDisplay` accepts `abilitiesSection`, `statsOverride
{value, bottomLabel}`, `footerOverride`, `afterExtraContent`, `hide`
(`ReferenceEntityHideConfig` object), `footActions`, `footMeta`
(`CardFootMeta = {label, value:ReactNode}`) — all real. Caveats to design around:

- **`abilitiesSection` replaces the _chassis-abilities_ block only**, not the
  game-rules `Actions` masonry. To keep the built-in actions, don't `hide.actions`;
  to inject entity-level buttons use `afterExtraContent`/`footerOverride`.
- **`ReferenceEntityActions` and `displayStateContext` are internal** (not in the
  `suref-react` barrel) — reach them _through_ `ReferenceEntityDisplay`, don't import
  internals. Density is a `compact`/`mode` prop, not a context knob.
- **`RollTable`** is interactive but its Roll button needs **`showCommand` + a truthy
  `tableName`** (else static grid). Roll math: `rollOnTable`/`resultForTable`
  (package root).
- **In-panel `[[links]]`**: wrap the display in `EntityHrefProvider value={builder}`
  and leave `EntityDetailLinkProvider` at default `false` (in-app modal, not
  navigate-away); both are public. `useSearchCombobox` is also public (for D4).
- Economy injection stays the `Erow`/`ActionCardErow` + `footActions`/`footMeta`
  vocabulary (`ActionCard` itself takes neither — wrap it, per ADR-017).

### 4.4 Tables & SRD data

- **No table category field** — the 5 columns (COMBAT/PILOT/SALVAGE/CRAWLER/DOWNTIME)
  are an **app-side curated `name→category` map** over `RollTables.all()` (96 tables);
  `indexable:true` filters to the ~19 headline tables. `source` (book) doesn't map.
- **SRD Explorer:** all 8 tiles map to accessors — `Chassis/Systems/Modules/`
  **`Abilities`**`/Equipment/NPCs/CrawlerBays/RollTables`. Reuse `useSearchCombobox`
  (public) or `search()` (needs ORM `preload()` — the dashboard already preloads);
  render items via `ReferenceEntityDisplay`. **Preload hazard:** never call accessor
  `.all()`/query at module scope.

### 4.5 Out of scope (data-model work, not Display completion)

- **Drone / Ally focuses + decks.** No drone/ally entity exists; `SoftLink.type` is
  only `mech-to-pilot`/`pilot-to-crawler`, `EntityRef.type` only
  `pilot`/`mech`/`crawler`. Surfacing them = new schema + link kinds + composition
  extension — a separate project.
- **Broader HUD chrome, Settings menu, phone reflow** — not Display content.

## 5. Workstreams (Display-focused)

Ordered by value. Each is independently shippable and gated on
`bun --filter in-the-union-now test`, `typecheck`, `lint`, and the ADR-007 boundary
tests.

### D5 — EntityView: a real reference document (do first — underpins D1/D4)

- Drive each entity focus through `ReferenceEntityDisplay`: keep the built-in
  actions (don't `hide.actions`), feed live **`statsOverride`**
  (`currentHP/SP/EP/Heat`), and inject entity-level **`footActions`** (Load Into Mech
  / Enter Downtime / Hand re-roll / "Full sheet →") via `afterExtraContent` /
  `footerOverride` — not a new renderer.
- Render the **crawler** focus as its real card (today a text note).
- Provide an in-panel `EntityHrefProvider` (+ `EntityDetailLinkProvider={false}`) so
  `[[links]]` drill in place. Touches: `DisplayView.tsx` (+ an `EntityView`).

### D1 — Actions deck: filters, grouping, range, rich cards (highest visible value)

- **Timing tabs** — one tab per `actionType`: `All/Turn/Short/Long/Free/React`
  (React→Reaction; §7) — and a **grouping toggle** `Timing ⇄ Source`; drop the
  hardcoded group-by-source.
- **List every action** per item (widen `buildMechActions`; §4.1), each an
  independently filterable card.
- **Source-filter tags** per owner, family-colored.
- **Range selector** `C/M/L/F` + **reach readout** from `action.range`; add ephemeral
  `range` + `setRange` to `playStateStore` and a pure range-vs-band helper in
  `dashboardRules`. Dim (not hide) out-of-range, heat-locked (`canActivateAction`),
  and destroyed actions in place.
- **`acell` cards**: source stamp + micro-meta (range/dmg/HOT/traits) — reuse
  `ActionCard`/`DataValueDisplayView` for the tag row.
- **On-foot deck:** when `mount==='pilot'`, render a `buildPilotActions(pilot)`
  (mirror `buildMechActions` over `pilot.abilities`/`pilot.equipment` via
  `resolveActions`/`resolveAbilityApCost`; AP economy) instead of the mech deck.
- Touches: `ActionsDeck.tsx`, `dashboardRules.ts`, `playStateStore.ts`,
  `DisplayView.tsx`.

### D2 — Resolve flow: Apply, cost choice, Hot stepper

- Add the **Apply** step (`Activate → Roll → Push → Apply`) committing the rolled
  outcome as one write under ADR-007 (auto for non-destructive; route destructive
  branches through the existing `ActiveItemBand` confirm overlays).
- **Cost — EP or AP** radios, authored in the Dashboard for
  `activationCurrency==='EP or AP'` actions (§4.2).
- **Hot(X) stepper** with Dashboard-local state + heat-vs-cap projection; disable
  when it would exceed cap (§4.2). `◀ Back` / `Clear`.
- Touches: `ActionsDeck.tsx`, `dashboardRules.ts`.

### D3 — Tables: 5-column category picker + roll history

- Replace the `<select>` with the **5-column picker overlay**
  (COMBAT/PILOT/SALVAGE/CRAWLER/DOWNTIME) driven by an **app-side curated
  name→category map** (§4.4). Roll result + follow-ups in-panel via `RollTable`
  (`showCommand` + `tableName`); **roll history** + Clear.
- Touches: `DisplayView.tsx` (+ a `TablePickerOverlay` + the category map).

### D4 — SRD Explorer (currently a hard stub)

- **Search box** via `useSearchCombobox` / `search()`, **8 category tiles** over the
  real accessors (§4.4), results drilling into `ReferenceEntityDisplay` in-panel
  (shares D5's `EntityHrefProvider`). Respect the preload hazard.
- Touches: `DisplayView.tsx` (`srd` branch) + a small `SrdExplorer`.

### D6 — Display visual fidelity (fold into D1–D5, not a separate build)

Apply the mockup's Display treatment as each control lands: light "workshop-paper"
SRD card inset in the dark HUD; **source stamps** (Barlow Semi Condensed, uppercase,
dark-on-light); **cost pennant** for EP/AP; **segmented pip gauges**; roll-band
colors (`--color-roll-*`); state overlays as _treatment_ (heat redline pulse,
damaged 45° hatch, destroyed strike-in-place), never a second hue — against the
existing `--color-sheet-*` / `--color-rust` / `--color-roll-*` tokens.

## 6. Sequencing & verification

- **Order:** D5 → D1 → D2 → D3 → D4 (D6 folded in). D5's real card +
  `EntityHrefProvider` underpin D4 and the `acell` cards and fix the most visible
  "bare card" gap; D1/D2 restore the action instrument; D3/D4 finish Tables and SRD.
- **Per-workstream gate:** the checks above + extend `__tests__/DisplayView.test.tsx`
  per mode; keep `e2e/display-verification.e2e.ts` green.
- **ADR-007:** new Apply/resolve writes auto-apply only non-destructive bookkeeping
  and route destructive outcomes through confirm/undo — unit-tested.
- **Ephemeral split (ADR-019):** filter/grouping/range/resolve state stays in
  component state / `playStateStore`, never `entityStore` or snapshots.

## 7. Decisions (all settled)

- **Timing tabs** = **one tab per `actionType`** — `All · Turn · Short · Long · Free ·
React` (React→`Reaction`). No bucketing; each type is its own tab.
- **Deck granularity** = **list every action** — a multi-action system/module surfaces
  each action as its own filterable card (`buildMechActions` widened beyond the
  primary action; §4.1).
- **Hot(X) / Uses(X)** = **player-entered stepper** — a `− X +` control with a live
  heat-vs-cap projection; Dashboard-local state (§4.2).
- **Range** = lightweight self-declared band (`playStateStore.range`), compared
  against `action.range`. No enemy/target model (matches local-first).
- **SRD Explorer** = search + 8 tiles + `ReferenceEntityDisplay` drill-in (reusing
  `useSearchCombobox`), _not_ a separate standalone browser.
- **Apply** auto-commits non-destructive rolled outcomes; destructive outcomes route
  through confirm/undo (ADR-007).
