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

## 4. Workstreams (Display-focused)

Ordered by user-visible value. Each is independently shippable and gated on
`bun --filter in-the-union-now test`, `typecheck`, `lint`, and the ADR-007 boundary
tests. Reuse `suref-react` (`ReferenceEntityDisplay` / `ActionCard` / `RollTable`)
and inject economy via the existing `Erow`/`ActionCardErow` + `DisplayCard.footActions`
vocabulary (ADR-017) — never a new schema-specific renderer.

### D1 — Actions deck: filters, grouping, range, and rich cards (highest value)

- **Timing tabs** `All/Turn/Free/React` and a **grouping toggle** `Timing ⇄ Source`
  over the existing `buildMechActions` groups; drop the hardcoded group-by-source.
- **Source-filter tags** per owner (pilot/mech/drone), family-colored.
- **Range selector** `C/M/L/F` + **reach readout**; dim (not hide) out-of-range,
  heat-locked (`canActivateAction`), and destroyed actions in place.
- **`acell` cards** carry a source stamp (CHS/SYS/MOD/ABL/EQP) + micro-meta
  (range/dmg/HOT/traits) — read from `SURefMetaAction`.
- **On-foot deck:** when `mount==='pilot'`, render the **pilot's** action deck
  (add a pilot-sourced `buildActions` sibling), not the mech's.
- Touches: `ActionsDeck.tsx`, `dashboardRules.ts`, `DisplayView.tsx`.
- **Data dependency to confirm first:** whether `SURefMetaAction` carries timing
  group / range / traits fields the tabs+range+micro-meta need (see §6).

### D2 — Resolve flow: Apply, cost choice, Hot stepper

- Add the **Apply** step (`Activate → Roll → Push → Apply`) that commits a rolled
  outcome as one write under the ADR-007 boundary (auto for non-destructive; route
  destructive branches through the existing `ActiveItemBand` confirm overlays).
- **Cost — EP or AP** radios for `'EP or AP'` actions (`resolveActivationCurrency`).
- **Hot(X) stepper** with heat-vs-cap projection; disable when it would exceed cap.
- `◀ Back` / `Clear`. Touches: `ActionsDeck.tsx`, `dashboardRules.ts`.

### D3 — Tables: 5-column category picker + roll history

- Replace the `<select>` with the **5-column grouped picker overlay**
  (`COMBAT/PILOT/SALVAGE/CRAWLER/DOWNTIME`), categorizing `RollTables.all()`
  app-side (no category field in data — §5.6 of the spec).
- Roll result + follow-ups in-panel; **roll history** + Clear. Reuse `RollTable`.
- Touches: `DisplayView.tsx` (+ a `TablePickerOverlay`).

### D4 — SRD Explorer (currently a hard stub)

- **Search box** over `salvageunion-reference` `search()`, **8 category tiles**
  (CHS/SYS/MOD/ABL/EQP/NPC/BAY/TBL), result cards drilling into the real
  `ReferenceEntityDisplay` in-panel (shares the D5 `EntityHrefProvider`).
- Touches: `DisplayView.tsx` (`srd` branch) + a small `SrdExplorer`.

### D5 — EntityView: a real reference document

- Drive the entity focus through `ReferenceEntityDisplay` slot props: grouped
  `ReferenceEntityActions` (`abilitiesSection`), live `statsOverride`
  (`currentHP/SP/EP/Heat`), and entity-level `footActions` (Load Into Mech / Enter
  Downtime / Hand re-roll / sheet links) via `DisplayCard.footActions`.
- Render the **crawler** focus as its real card (currently a text note).
- Provide an in-display `EntityHrefProvider` so `[[links]]` drill in-panel (the one
  sanctioned internal scroll). Touches: `DisplayView.tsx` (+ an `EntityView`).

### D6 — Display visual fidelity (fold into D1–D5, not a separate build)

The mockup's Display treatment: light "workshop-paper" SRD card inset in the dark
HUD; **source stamps** (Barlow Semi Condensed, uppercase, dark-on-light); **cost
pennant** for EP/AP; **segmented pip gauges**; roll-band colors
(`--cascade/--failure/--tough/--success/--nailed`); state overlays as _treatment_
(heat redline pulse, damaged 45° hatch, destroyed strike-in-place), never a second
hue. Apply these per-workstream as each control lands, against the existing
`--color-sheet-*` / `--color-rust` / `--color-roll-*` tokens — not as a separate
visual pass. (Broader HUD chrome / phone reflow are **out of scope** here.)

## 5. Sequencing & verification

- **Order:** D5 → D1 → D2 → D3 → D4. D5 (real reference card + `EntityHrefProvider`)
  underpins D4 and the `acell` cards, and fixes the most visible "bare card" gap;
  D1/D2 restore the action instrument; D3/D4 complete Tables and SRD.
- **Per-workstream gate:** the four checks above + extend
  `__tests__/DisplayView.test.tsx` per mode and keep
  `e2e/display-verification.e2e.ts` green.
- **ADR-007:** new Apply/resolve writes must auto-apply only non-destructive
  bookkeeping and route destructive outcomes through confirm/undo — unit-tested.
- **Ephemeral split (ADR-019):** filter/grouping/range/resolve state stays in
  component state / `playStateStore`, never `entityStore` or snapshots.

## 6. Open questions / dependencies

1. **Action metadata (blocks D1).** Do `SURefMetaAction` records carry the **timing
   group** (Turn/Free/React), **range**, and **traits** the tabs / range selector /
   micro-meta need? If not, D1's filters degrade to what the data supports — confirm
   before building.
2. **Range model.** ITUN has no enemy/GM model (local-first); the mockup's `C/M/L/F`
   is a self-declared range band. Ship the lightweight declare-a-band version
   (matches spec §10.5), not target selection?
3. **SRD Explorer depth (D4).** Full standalone browser, or the search + 8-tile +
   drill-in the mockup shows (recommended — reuses D5's card path)?
4. **Apply semantics (D2).** Auto-commit non-destructive rolled outcomes, explicit
   confirm for destructive (recommended, per ADR-007)?
