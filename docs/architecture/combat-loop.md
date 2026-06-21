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

There is no atomic transaction; the rare partial-write risk is accepted, and
affordability is checked up front ([ADR-007](../adrs/ADR-007-automation-boundary.md),
[ADR-008](../adrs/ADR-008-sequential-mutations.md)).

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

## Not implemented

The following appeared in earlier (backend-era) designs and **do not exist** in
the current local-first app — do not document or assume them:

- A standalone "Take Damage" modal or Critical Damage Table flow (SP damage today
  comes only from the 11–19 overheat band).
- Salvage in ITUN (`SalvageModal` / `salvageUtils.ts`) — salvage tables live in
  the Discord bot, not ITUN.
- Any change log, undo/redo, or `reversible` tracking.
- Any Supabase RPC (`apply_mech_damage`), `entity_refs` table, or `useUpdateMech`
  hook — state is plain `entityStore.update(...)` write-through.

---

## Cross-references

- [ADR-001](../adrs/ADR-001-local-first-no-backend.md) — local-first; honor system, no turn enforcement
- [ADR-006](../adrs/ADR-006-pure-rules-logic.md) — rules math as pure functions
- [ADR-007](../adrs/ADR-007-automation-boundary.md) — automation boundary
- [ADR-008](../adrs/ADR-008-sequential-mutations.md) — sequential client-side mutations
- [ADR-009](../adrs/ADR-009-condition-model-destroyed-color.md) — condition model + destroyed color
- [data-flow.md](data-flow.md) — store hydration, write-through, IndexedDB
- [rules-engine-boundary.md](rules-engine-boundary.md) — what ITUN enforces vs. leaves to the Mediator
