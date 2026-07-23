# Combat Loop Architecture

ITUN is a shared living character sheet, not a game engine. During play it lets a
player spend resources, track heat, run heat checks, and record equipment
conditions on their own mech. It is **local-first** ([ADR-001](../adrs/ADR-001-local-first-no-backend.md)):
all state lives in the player's IndexedDB and is mutated client-side through the
Zustand stores ([ADR-003](../adrs/ADR-003-zustand-hydration.md)). There is no
backend, no RPC, and no turn enforcement. There **is** an append-only
`changeLog` provenance store ([ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md)) —
it records what happened; it is not an undo/redo system.

## Core principles

- **Self-service.** Each player updates their own mech; the app never writes
  another player's state and does not gate actions behind a "your turn" check.
  The table handles sequencing socially (see
  [rules-engine-boundary.md](rules-engine-boundary.md)).
- **Rules math is pure and shared.** Combat math lives as pure functions in
  `salvageunion-reference` ([ADR-006](../adrs/ADR-006-pure-rules-logic.md)) plus
  ITUN-local heat-check rules. UI/state code calls them; it never reimplements
  the rules.
- **Automation boundary.** Non-destructive bookkeeping is auto-applied;
  destructive condition changes require explicit player action
  ([ADR-007](../adrs/ADR-007-automation-boundary.md)).

---

## Pure rules functions

### `salvageunion-reference/lib/combatUtils.ts`

Side-effect-free, no app or backend dependency:

```typescript
getHeatGenerated(entity): number | 'variable'            // reads the `hot` trait amount; 0 if none
applyHeat(currentHeat, heatGenerated, heatCap): number     // sum, clamped to cap
canActivateAction(currentHeat, heatCost, heatCap): boolean // currentHeat + heatCost <= heatCap
shouldTriggerHeatCheck(currentHeat, heatGained, heatCap): boolean // gained > 0 && would reach/exceed cap
canPush(currentHeat, heatCap): boolean                     // currentHeat + 2 <= heatCap
nextCondition(current): ItemCondition                      // intact → damaged → destroyed
applySpDamage(currentSp, damage): { newSp, hpDamage }      // hpDamage = floor(damage / 2)
```

### `salvageunion-reference/lib/rules/heatCheck.ts`

The heat-check math is pure and lives in the package (ADR-006), with an
injectable die roller:

```typescript
clampHeat(heat, cap): number
reactorOverloadOutcome(roll): 'meltdown' | 'system-destroyed' | 'module-destroyed' | 'overheat' | 'safe'
performHeatCheck({ heat, currentSP, roll, now? }): HeatCheckEffect
performPush({ heat, heatCap, currentSP, roll, now? }): PushResult   // { nextHeat, effect }
```

### `apps/itun/src/lib/rules/heatCheck.ts`

A thin app-local layer, imported by submodule path. It re-exports
all four functions above and adds the two pieces that can't be pure:

```typescript
defaultRoll: Roll                                        // @randsum/roller binding
heatCheckPatch(effect, currentHeat?): Partial<Mech>       // effect → durable-state patch
```

The rest of `apps/itun/src/lib/rules/` follows the same shape — the package owns
the math, the app owns the roller binding and the patch assembly.

`reactorOverloadOutcome` bands a d20: `1` meltdown, `2–5` system destroyed,
`6–10` module destroyed, `11–19` overheat, `20` safe.

---

## Action activation

**Where:** the Dashboard's `ActionsDeck.tsx`, over `activationPatch()` in
`apps/itun/src/components/dashboard/dashboardRules.ts`. Per-item cost is
computed by `itemEconomy()` in `sheet/mechItemRules.ts` (primary action's
`activationCost`, summed `Hot` amounts, max `Uses`); the Deck resolves a
**per-action** economy via `economyForActivation()`.

`activationPatch` builds one patch and the caller applies it as a **single
sequential write-through** ([ADR-008](../adrs/ADR-008-sequential-mutations.md)):

1. Deduct EP (`currentEP`) if `epCost > 0`.
2. Apply heat via `clampHeat(currentHeat + heat, heatCap)` if `heat > 0`.
3. Decrement the item's remaining uses in the `itemUses` map if `maxUses > 0`.
4. `await storeState.update('mech', mech.id, patch)` — persists to IndexedDB,
   then updates in-memory state and broadcasts to other tabs.

Single-entity patches stay sequential; the rare partial-write risk is accepted,
and affordability is checked up front ([ADR-007](../adrs/ADR-007-automation-boundary.md),
[ADR-008](../adrs/ADR-008-sequential-mutations.md)). Flows that move value
**between** entities (scrap-mech, cargo stow/load) instead use
`entityStore.transfer()`, which validates every patch and commits all writes in
one IndexedDB transaction — ADR-008's own escape hatch for cases that cannot
tolerate partial application.

**Destructive-write policy** (one vocabulary across every control):

- **Destructive automation outcomes** (a Meltdown's mech `destroyed` flag, a
  Critical Damage / Critical Injury roll, Eject) → held back from the
  auto-applied patch and offered as an explicit player-confirmed step. On the
  Dashboard this is `autoApplyPatch()` in `dashboardRules.ts`, which strips
  `destroyed` out of a `heatCheckPatch` result and returns `meltdown: true` for
  the caller to prompt on.
- **Reversible destructive writes** (an item marked Destroyed) → the write
  applies immediately (player stays in control, ADR-007) with a one-click
  **Undo toast** (`sheet/destroyedUndoToast.ts`).

---

## Heat check & reactor overload

**Where:** the **Dashboard**, not the Live Sheet. `ActiveItemBand.tsx` (the
reactor band) and `ActionsDeck.tsx` call `heatCheckOncePatch()` / `pushPatch()`
in `dashboardRules.ts`, which run `performHeatCheck` / `performPush`, map the
effect through `heatCheckPatch()`, record the result in `lastHeatCheck`, and
call `storeState.update('mech', …)` to apply it.

Auto-applied (non-destructive):

- **Roll > heat (pass)** — recorded for display, no state change.
- **20 (safe)** — overload with no effect.
- **11–19 (overheat)** — sets `shutdown` and `vulnerable`, and auto-applies SP
  damage equal to current heat (`nextSP`). All persisted automatically.

Requires explicit player action (destructive):

- **6–10 (module destroyed) / 2–5 (system destroyed)** — `requiresPlayerChoice`
  is set and the surface shows an advisory readout. It does **not** auto-mark
  anything — the player marks the chosen item via its `StatusBadge`
  ([ADR-009](../adrs/ADR-009-condition-model-destroyed-color.md)).
- **1 (meltdown)** — `heatCheckPatch` sets the mech `destroyed` flag, but the
  Dashboard's `autoApplyPatch` strips it back out and returns `meltdown: true`
  so the player confirms the destruction explicitly.

The player can clear `shutdown` / `vulnerable` / `destroyed` flags individually
(manual restart/correction) — on the sheet via the Conditions chips in the
Vitals card (`MechConditionsEditor`), and on the Dashboard via the reactor
band's Shutdown toggle (`shutdownTogglePatch`).

### Push and Vent

`ActiveItemBand` / `ActionsDeck` expose **Push (+2 Heat)** → `pushPatch` →
`performPush` (adds 2 heat, clamped, then runs a heat check immediately). Push
is locked when `heat + 2 > heatCap` (Quick Ref p.233). The band also has an
**Emergency Vent** (`VENT_PATCH` — Heat→0 plus `vulnerable`) and a Shutdown
toggle, kept as distinct controls. There is no push modal and no `pushUtils.ts`.

---

## Equipment conditions

Item condition is a per-slug map on the mech record — `systemConditions` and
`moduleConditions` (`'intact' | 'damaged' | 'destroyed'`). The player drives
changes via the `StatusBadge` on `MechItemCard.tsx`
([ADR-009](../adrs/ADR-009-condition-model-destroyed-color.md)); that badge's
`onStatusCycle` runs `cycleItemCondition` in `MechSheet.tsx`, which advances the
value (`nextCondition`) and writes the updated map with
`storeState.update('mech', …)`. Condition changes are never auto-applied.

---

## Persisted combat state (`src/lib/schemas/mech.ts`)

Live-play fields on the mech record (all fall back to the chassis base value when
unset): `currentHP`, `currentSP`, `currentEP`, `currentHeat`;
`systemConditions` / `moduleConditions` maps; `itemUses`; the overload flags
`shutdown` / `vulnerable` / `destroyed`; `lastHeatCheck`; and hand-edit
modifiers (`maxSpModifier`, `maxEpModifier`, `maxHeatModifier`,
`maxCargoModifier`). Derived maxima are computed in `src/lib/rules/derivedStats.ts`.

---

## The rules controls — where they live today

The rules **math** all still exists under `apps/itun/src/lib/rules/*`
(injectable rollers, unit-tested) and is imported by submodule path.
The **surfaces** on top of it were reorganized by the poster redesign and the
ADR-021 surface split: most play controls moved off the Live Sheet onto the
Dashboard, and several were deleted outright. Every surviving surface follows
the ADR-007 pattern — deterministic bookkeeping auto-applies, destructive or
narrative choices stay player-driven.

**On the Dashboard** (`src/components/dashboard/`):

- **Take Damage / Critical Damage / Critical Injury** — `ActiveItemBand.tsx`
  over `dashboardRules.ts` (`mechDamagePatch`, `critDamagePatch`,
  `pilotDamagePatch`, `critInjuryPatch`) → `lib/rules/takeDamage.ts`. The SP/HP
  value of a self-declared hit auto-applies; the Critical roll at 0 and marking
  the mech Destroyed are explicit player-confirmed steps.
- **Reactor** — Push / Heat Check / Vent / Shutdown, see above.
- **Action activation & core roll** — `ActionsDeck.tsx` over `activationPatch`
  and `lib/rules/coreMechanic.ts`.
- **Downtime** — `DowntimeWizard.tsx`, which uses `mechBayStatus` /
  `medBayStatus` from `lib/rules/downtime.ts`.

**On the Live Sheet / encounter tray:**

- **Crawler economy** — `sheet/CrawlerEconomyControl.tsx` over
  `lib/rules/crawlerEconomy.ts` (p.218-223), mounted by `SheetCrawler.tsx`:
  Upkeep + Deterioration roll, Upgrade, Scrap exchange, Trading Bay
  availability.
- **Mediator tables** — `encounter/MediatorRollControl.tsx` over
  `lib/rules/mediatorTables.ts`.
- Per-card activation and repair on `MechItemCard.tsx` / `MechSheet.tsx`
  (`setItemUses`, `repairItem`, `cycleItemCondition`).

**Rules modules with no UI surface today.** These are live, tested pure
modules that currently have _no_ component consumer — their controls were
deleted in the redesign (see the `CrawlerSheet.tsx` / `MechSheet.tsx` header
comments) and not re-homed:

- `lib/rules/salvage.ts` (pp.244-248) — `SalvageControl` deleted.
- `lib/rules/crafting.ts` (p.222/p.244) — `CraftingControl` deleted.
- `lib/rules/scrapMech.ts` (p.248) — `ScrapMechControl` deleted.

**Surfaces that no longer exist** — do not reference them: `HeatCheckControl`,
`TakeDamageControl`, `PilotTakeDamageControl`, `SalvageControl`,
`CraftingControl`, `DowntimeControl`, `ScrapMechControl`, `ConditionToggle`,
and `QuickRollFab` (whose removal from the Live Sheet is recorded in
[ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md)).

## Not implemented

The following appeared in earlier (backend-era) designs and **do not exist** in
the current local-first app — do not document or assume them:

- Any general undo/redo or `reversible` tracking. The one reversal affordance is
  the destroyed-item undo toast (`sheet/destroyedUndoToast.ts`). (The `changeLog`
  store is append-only provenance, not undo — see ADR-022.)
- Any backend RPC (`apply_mech_damage`), `entity_refs` table, or `useUpdateMech`
  hook — state is plain `entityStore.update(...)` write-through (or
  `entityStore.transfer(...)` for cross-entity moves).

---

## Cross-references

- [ADR-001](../adrs/ADR-001-local-first-no-backend.md) — local-first; honor system, no turn enforcement
- [ADR-006](../adrs/ADR-006-pure-rules-logic.md) — rules math as pure functions
- [ADR-007](../adrs/ADR-007-automation-boundary.md) — automation boundary
- [ADR-008](../adrs/ADR-008-sequential-mutations.md) — sequential client-side mutations
- [ADR-009](../adrs/ADR-009-condition-model-destroyed-color.md) — condition model + destroyed color
- [data-flow.md](data-flow.md) — store hydration, write-through, IndexedDB
- [rules-engine-boundary.md](rules-engine-boundary.md) — what ITUN enforces vs. leaves to the Mediator
