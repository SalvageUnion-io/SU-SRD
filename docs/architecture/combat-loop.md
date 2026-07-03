# Combat Loop Architecture

ITUN is a shared living character sheet, not a game engine. During play it lets a
player spend resources, track heat, run heat checks, and record equipment
conditions on their own mech. It is **local-first** ([ADR-001](../adrs/ADR-001-local-first-no-backend.md)):
all state lives in the player's IndexedDB and is mutated client-side through the
Zustand stores ([ADR-003](../adrs/ADR-003-zustand-hydration.md)). There is no
backend, no RPC, no change log, and no turn enforcement.

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

### `apps/in-the-union-now/src/lib/rules/heatCheck.ts`

ITUN-local heat-check rules (exported via `src/lib/rules/index.ts`), also pure
with an injectable die roller (`defaultRoll`, backed by `@randsum/roller`):

```typescript
clampHeat(heat, cap): number
reactorOverloadOutcome(roll): 'meltdown' | 'system-destroyed' | 'module-destroyed' | 'overheat' | 'safe'
performHeatCheck({ heat, currentSP, roll, now? }): HeatCheckEffect
performPush({ heat, heatCap, currentSP, roll, now? }): { nextHeat, effect }
```

`reactorOverloadOutcome` bands a d20: `1` meltdown, `2–5` system destroyed,
`6–10` module destroyed, `11–19` overheat, `20` safe.

---

## Action activation

**Where:** `activateItem(slug, economy)` in
`apps/in-the-union-now/src/components/sheet/MechSheet.tsx`. The item's cost is
computed by `itemEconomy()` in `sheet/mechItemRules.ts` (primary action's
`activationCost`, summed `Hot` amounts, max `Uses`).

`activateItem` builds one patch and applies it as a **single sequential
write-through** ([ADR-008](../adrs/ADR-008-sequential-mutations.md)):

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

- **Irreversible cross-entity moves** (scrap-mech, entity delete) → a
  `ConfirmDialog` before anything is written.
- **Reversible destructive writes** (item marked Destroyed, an automation
  rule setting `destroyed`) → the write applies immediately (player stays in
  control, ADR-007) with a visible reversal affordance: the inline **Clear**
  strip when it sits next to the flag (HeatCheckControl), plus the one-click
  **Undo toast** (`destroyedUndoToast`) when the write happens away from a
  Clear affordance (item badges, Critical Damage results).

---

## Heat check & reactor overload

**Where:** `HeatCheckControl.tsx` (a control, not a modal), wired into the mech
sheet. It rolls d20 vs. current heat via `performHeatCheck`, records the result
in `lastHeatCheck`, and calls `storeState.update('mech', …)` to apply effects.

Auto-applied (non-destructive):

- **Roll > heat (pass)** — recorded for display, no state change.
- **20 (safe)** — overload with no effect.
- **11–19 (overheat)** — sets `shutdown` and `vulnerable`, and auto-applies SP
  damage equal to current heat (`nextSP`). All persisted automatically.

Requires explicit player action (destructive):

- **6–10 (module destroyed) / 2–5 (system destroyed)** — `requiresPlayerChoice`
  is set; the control shows an advisory prompt. It does **not** auto-mark
  anything — the player marks the chosen item via its `ConditionToggle`
  ([ADR-009](../adrs/ADR-009-condition-model-destroyed-color.md)).
- **1 (meltdown)** — sets the mech `destroyed` flag; player handles consequences
  and can clear it manually.

The player can clear `shutdown` / `vulnerable` / `destroyed` flags individually
(manual restart/correction).

### Push

`HeatCheckControl` has an inline **Push (+2 Heat)** button → `performPush`
(adds 2 heat, clamped, then runs a heat check immediately). There is no separate
push modal or `pushUtils.ts`.

---

## Equipment conditions

Item condition is a per-slug map on the mech record — `systemConditions` and
`moduleConditions` (`'intact' | 'damaged' | 'destroyed'`). The player drives
changes via the `ConditionToggle` ([ADR-009](../adrs/ADR-009-condition-model-destroyed-color.md));
`cycleItemCondition` in `MechSheet.tsx` advances the value and writes the updated
map with `storeState.update('mech', …)`. Destroyed reads as semantic red
(`bg-roll-cascade`). Condition changes are never auto-applied.

---

## Persisted combat state (`src/lib/schemas/mech.ts`)

Live-play fields on the mech record (all fall back to the chassis base value when
unset): `currentHP`, `currentSP`, `currentEP`, `currentHeat`;
`systemConditions` / `moduleConditions` maps; `itemUses`; the overload flags
`shutdown` / `vulnerable` / `destroyed`; `lastHeatCheck`; and hand-edit
modifiers (`maxSpModifier`, `maxEpModifier`, `maxHeatModifier`,
`maxCargoModifier`). Derived maxima are computed in `src/lib/rules/derivedStats.ts`.

---

## The rules controls (design-review R-1…R-7, shipped in #333)

Each control follows the HeatCheckControl / ADR-007 pattern — deterministic
bookkeeping auto-applies; destructive or narrative choices stay player-driven.
Pure math lives in `src/lib/rules/*` (injectable rollers, fully unit-tested);
the control is a thin stateful wrapper.

- **Take Damage** — `TakeDamageControl.tsx` (mech, Core Book p.239-240) +
  `PilotTakeDamageControl.tsx` (pilot, p.241) over `lib/rules/takeDamage.ts`.
  SP/HP reduction, halving rules, and the Critical Damage / Critical Injury
  d20 bands auto-apply their deterministic effects (recorded roll, 1 SP/HP on
  Miraculous Survival, `destroyed` on Catastrophic, 'Chassis Damaged' /
  'Unconscious' conditions). WHICH System/Module dies is marked by the player;
  a Fatal Injury is advisory — the app never kills a pilot automatically.
- **Salvage** — `SalvageControl.tsx` over `lib/rules/salvage.ts` (pp.244-248):
  Area Salvage and Mech Salvage rollers on the crawler sheet. Found Scrap
  deposits into the crawler's TL pool buckets; 20-band wreck chassis lands in
  the hold as a Damaged lot; Jackpot!/system claims open a player-driven picker.
- **Scrap a mech** — `ScrapMechControl.tsx` over `lib/rules/scrapMech.ts`
  (p.248): deposits the breakdown and hands off cargo, then deletes the mech —
  in one atomic `transfer()`.
- **Downtime** — `DowntimeControl.tsx` over `lib/rules/downtime.ts`
  (p.227-228): the one-click per-session loop (restore, repair ≤ crawler TL,
  Med-Bay healing bands, +1 TP, recharge Uses).
- **Crawler economy** — `CrawlerEconomyControl.tsx` over
  `lib/rules/crawlerEconomy.ts` (p.218-223): Upkeep + Deterioration roll,
  Upgrade, Scrap exchange, Trading Bay availability.
- **Crafting** — `CraftingControl.tsx` over `lib/rules/crafting.ts`
  (p.222/p.244): craft ≤ crawler TL, cost drawn from the shared pool.
- **Dice & Mediator** — `QuickRollFab.tsx` (sheet-wide roller) and the
  encounter tray's `MediatorRollControl.tsx` over `lib/rules/coreMechanic.ts`
  / `mediatorTables.ts`.

## Not implemented

The following appeared in earlier (backend-era) designs and **do not exist** in
the current local-first app — do not document or assume them:

- Any change log, undo/redo, or `reversible` tracking (a narrow exception: the
  destroyed-item undo toast, `destroyedUndoToast.ts`).
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
