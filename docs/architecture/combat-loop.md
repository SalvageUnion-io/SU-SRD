# Combat Loop Architecture

The combat loop gives players a structured way to spend resources, track heat, apply damage, and record conditions during a Salvage Union session. The system is built around a self-service model: each player manages their own mech and pilot state. The app is a shared living character sheet, not a game engine.

## Core Design Principles

**Self-service mutation model.** Each player updates their own records. There is no turn enforcement, no server-side sequencing, and no cross-player writes. The table handles initiative socially. The honor system is by design, not by limitation.

**No turn enforcement.** All users can always act. The app does not gate mutations behind a "your turn" check. This removes significant server-side complexity and matches how Salvage Union is actually played at the table.

**No cross-player mutations.** Current RLS policies (owner-only writes) are correct and sufficient for the combat loop. No security-definer RPCs are required. The Mediator sees changes live via realtime sync but does not initiate them remotely.

**Realtime visibility.** All state changes sync to other clients via the existing Supabase realtime subscriptions already wired in `usePilotSheet`. No new channels are needed.

**Data-first.** Game logic lives in `salvageunion-reference` as pure functions. The ITUN app calls these functions from mutation handlers — it does not reimplement game rules.

---

## Story Architecture

The combat loop is delivered in three stories with a shared utility foundation.

### Story 0: `combatUtils.ts` — Pure Game Logic

**Location:** `packages/salvageunion-reference/lib/combatUtils.ts`

Pure functions with no side effects and no Supabase dependency. All combat math and rule checks live here so the logic is testable in isolation and reusable across any future consumer (Discord bot, etc.).

**Function signatures:**

```typescript
// Heat
function getHeatGenerated(entity: SURefEntity): number | 'variable'
function applyHeat(currentHeat: number, heatGenerated: number, heatCap: number): number
function canActivateAction(currentHeat: number, heatCost: number, heatCap: number): boolean
function shouldTriggerHeatCheck(newHeat: number): boolean  // d20 <= newHeat

// Pushing
function canPush(currentHeat: number, heatCap: number): boolean  // pushing adds 2 heat

// Conditions
function nextCondition(current: ItemCondition): ItemCondition
// ItemCondition = 'intact' | 'damaged' | 'destroyed'

// Damage
function applySpDamage(currentSp: number, damage: number): { newSp: number; hpDamage: number }
```

`getHeatGenerated` reads the `hot` trait from the entity's trait list and returns its `amount`. If the amount is the variable marker (i.e. `hot(x)`), it returns `'variable'`. If the entity has no `hot` trait, it returns `0`.

`shouldTriggerHeatCheck` determines whether a Heat Check is triggered. Per the rules, a Heat Check is triggered whenever Heat is gained. The caller rolls d20 and compares to current heat after application. This function is provided for informational display — the dice roll itself uses the existing `@randsum/roller` integration.

### Story 1: Action Execution

**Entry point:** `handleUseAction` handler in `usePilotSheet`.

**Hook:** `useActivateAction` — a focused hook extracted from `usePilotSheet` following the same decomposition pattern as the existing focused hooks (`usePilotBoardingActions`, `usePilotResources`, etc.).

The name `useActivateAction` is chosen deliberately. `useActionAction` would be confusing. `useExecuteAction` implies server-side execution. `useActivateAction` reads naturally at the call site.

**Execution sequence:**

1. Call `getHeatGenerated(entity)` from `combatUtils`.
   - If `'variable'`, show a heat input prompt before proceeding.
   - If the resulting heat would exceed the mech's heat cap, block the action with an error toast.
2. Call `canActivateAction(currentHeat, heatCost, heatCap)`. Block if false.
3. Spend EP via `spendMechEP` (calls `useUpdateMech`).
4. Apply heat via `applyHeat`, write new heat value (calls `useUpdateMech`).
5. If the action has limited uses tracked via `entity_refs`, decrement via `useUpdateMechEntityRef`.
6. Log each change via `changeLogApi.log()` (fire-and-forget).
7. If `shouldTriggerHeatCheck(newHeat)`, show a Heat Check prompt (Story 2).

**API function naming:** Mechanical names are used, not game concepts.

| Function | Meaning |
|----------|---------|
| `spendMechEP(mechId, amount)` | Decrements `current_ep` on the mech row |
| `spendPilotAP(pilotId, amount)` | Decrements `ap` on the pilot row |

This avoids collision with the `Action` entity type from the reference package.

**Mutations use existing hooks.** No new Supabase RPC is introduced for action execution. Sequential client-side mutations match the established pattern in `usePilotSheet`. See ADR-007 for the rationale.

**Failure mode.** If EP is spent but heat application fails, the mech has spent EP without gaining heat. This is the same risk profile as other sequential mutations in the app (e.g., HP decrement followed by log write). Accepted as-is. An atomic RPC can be introduced in a future story if this proves problematic in practice.

### Story 2: Heat UI

**Visual feedback for heat state:**

| Heat range | `StatDisplay` appearance |
|------------|--------------------------|
| 0 — 49% of cap | Default (no color change) |
| 50 — 79% of cap | Warning color |
| 80 — 99% of cap | Danger color |
| At cap | Max/critical color |

Heat thresholds are calculated as percentages of the mech's heat cap at render time.

**"Use" button heat cost annotation.** When an entity has a `hot` trait, the Use `EntityControl` label shows the heat cost inline: `"Use (Heat: 3)"` or `"Use (Heat: ?)"` for variable heat. This uses the `label` property on the `ReferenceEntityControl` type.

**Heat Check prompt.** When `shouldTriggerHeatCheck(newHeat)` returns true after an action, a modal presents the full Reactor Overload flow in sequence:

1. Show the d20 result and the rolled entry from the Reactor Overload Table.
2. **Roll 20 (miraculous):** Show result text, no further action.
3. **Roll 11–19 (core damage):** Auto-apply SP damage equal to current heat. Show the new SP value. Player dismisses.
4. **Roll 6–10 (module destroyed) or 2–5 (system destroyed):** Show result text, then open the target picker. Player selects the destroyed item from their equipment list, or taps "Random." Condition change requires explicit confirmation.
5. **Roll 1 (catastrophic meltdown):** Show result text. Player handles consequences manually using existing tools.

The Reactor Overload Table entries are read from `salvageunion-reference` via the existing `RollTables` model. Non-destructive outcomes are auto-applied; destructive outcomes always require explicit player confirmation. See ADR-006 and ADR-008.

**Accessibility.** The heat stat box uses `role="meter"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`. The Heat Check result modal uses `aria-live="assertive"` so screen reader users are notified of the result.

### Story 3: Damage Application

**Entry point:** A "Take Damage" control on the mech card. Opens a damage modal.

**Damage flow:**

1. Player enters the incoming SP damage amount.
2. `applySpDamage(currentSp, damage)` is called to compute:
   - New SP value
   - HP damage (SP damage / 2, rounded down)
3. A **reactive cascade preview** shows the player what will happen before they confirm:
   - New SP value
   - HP damage to pilot (if boarded)
   - Whether SP reaching 0 triggers the Critical Damage Table
4. Player confirms. A single RPC (`apply_mech_damage`) applies all row updates atomically:
   - `mechs.current_sp` (and `current_hp` if applicable)
   - `pilots.hp` if damage flows through

**Why an RPC here?** Multi-row condition updates require atomicity. If SP update succeeds but HP update fails, the sheet is in an inconsistent state. Unlike action execution (Story 1), there is no acceptable partial-failure mode for damage application. See ADR-007.

**Critical Damage Table target selection.** When SP reaches 0, the Critical Damage Table determines what is destroyed. Per the rules, "Mediator or at random." In this app, the damaged player chooses the target from their own equipment list, or taps "Random" for a random selection. See ADR-003.

**Item conditions follow `nextCondition`.** Intact -> Damaged -> Destroyed. The `apply_mech_damage` RPC calls the same progression logic on the database side.

---

## Automation Boundary

The app automates resource bookkeeping and enforces game rules, but never destroys equipment without explicit player confirmation. The guiding principle: **smart bookkeeping, hands-off on permanent consequences.**

### Auto-Applied (non-destructive, reversible)

The app applies these automatically when an action is taken or a check is triggered:

- Heat generation from using an action
- AP/EP spending from using an action
- Heat Check prompt when heat is gained
- SP damage from Reactor Overload result 11–19 (damage equals current heat)
- Blocking an action if resources are insufficient
- Blocking an action if heat cost would exceed the heat cap

### Require Player Confirmation (destructive, irreversible)

The app prompts the player and requires explicit confirmation for:

- Destroying a Module (Reactor Overload 6–10, Critical Damage 6–10)
- Destroying a System (Reactor Overload 2–5, Critical Damage 2–5)
- Catastrophic meltdown (Reactor Overload 1) — player handles manually
- Any condition change on equipment (intact -> damaged -> destroyed)

**No condition change is applied without the player seeing the consequence and confirming it.**

### Why This Boundary

This boundary is not arbitrary. The distinction is between math (reversible by re-clicking) and permanent game events (which have lasting consequences, appear in the change log as `reversible: false`, and may affect what equipment is available for the rest of the session). Automating math saves time. Automating destruction removes player agency over a meaningful game moment.

See ADR-008 for the full decision record.

---

## Data Layer

### combatUtils in salvageunion-reference

`combatUtils.ts` exports pure functions only. No imports from the ITUN app. No Supabase dependency. Exported from the package's public API via `lib/index.ts`.

Tests live in `packages/salvageunion-reference/test/combatUtils.test.ts`. Because these are pure functions, tests cover all branches without React rendering or Supabase mocking.

### apply_mech_damage RPC

A Supabase Postgres function scoped to Story 3. It accepts:

```sql
apply_mech_damage(
  p_mech_id uuid,
  p_pilot_id uuid,           -- may be null if unboarded
  p_sp_damage integer,
  p_target_entity_ref_id uuid -- may be null (no Critical Damage target chosen)
)
```

The function runs as the calling user's role (not `SECURITY DEFINER`) so RLS still applies.

### Change Log Reversibility

Combat events are logged with reversibility set by event type. See ADR-004 for the full rationale.

| Event | `reversible` |
|-------|-------------|
| AP spent | `true` |
| EP spent | `true` |
| Heat applied | `true` |
| Condition changed (damaged/destroyed) | `false` |

---

## UI Integration

### EntityControl for "Use"

Actions on equipment and mech systems are rendered as `EntityControl` entries on `SubEntityCard`. The "Use" control:

```typescript
{
  key: 'use-action',
  icon: PlayIcon,
  label: heatCost > 0 ? `Use (Heat: ${heatCost})` : 'Use',
  ariaLabel: `Use ${entity.name}`,
  onClick: () => handleUseAction(entityRef, entity),
  variant: 'primary',
}
```

For variable heat (`heatCost === 'variable'`): `label: 'Use (Heat: ?)'`.

### Destroyed Item Overlay

Destroyed items render with `damageOverlayText` set and `damaged: true` on `ReferenceEntityDisplay`. The overlay uses `bg-red-800/90` — semantic red, not an SU brand token. See ADR-005.

### Heat StatDisplay in PlayerPilotDisplay

The heat stat in the boarded stats bar uses the existing `StatItem` type. Color thresholds are applied via `valueColor` and `bg` properties on the `StatItem`, computed from the percentage-of-cap formula at render time.

---

## Game Rules Reference

The following rules from the Salvage Union Quick Reference Sheets inform the implementation.

**Heat.** Gained by using Systems, Modules, or Pushing. Cannot exceed Heat Cap — if an action would exceed cap, it cannot be taken. A Heat Check (d20 vs. current heat) triggers whenever heat is gained. Rolling at or below current heat = Reactor Overload.

**Pushing.** Adds 2 Heat and immediately triggers a Heat Check. Can only push once per activation. Cannot push if the +2 would exceed heat cap.

**Mech Damage.** Expressed as SP damage. HP Damage = SP Damage / 2 (round down). When SP reaches 0, roll on the Critical Damage Table.

**Critical Damage Table:**
| Roll | Result |
|------|--------|
| 20 | Miraculous — no damage |
| 11–19 | Core damage |
| 6–10 | Module destroyed |
| 2–5 | System destroyed |
| 1 | Catastrophic |

**Item Conditions.** Intact -> Damaged -> Destroyed.

**Reactor Overload Table** results (stored in `salvageunion-reference` as a `RollTable` entity). Non-destructive outcomes (11–19) are auto-applied. Destructive outcomes (6–10, 2–5) open the target picker. Catastrophic (1) is shown as text; the player handles it manually.

---

## Cross-References

- `docs/adrs/ADR-001-self-service-combat-model.md` — Why honor-system, no turn enforcement
- `docs/adrs/ADR-002-variable-heat-handling.md` — `hot(x)` prompt behavior
- `docs/adrs/ADR-003-damage-target-selection.md` — Who picks the destroyed item
- `docs/adrs/ADR-004-change-log-reversibility.md` — Which combat events are reversible
- `docs/adrs/ADR-005-destroyed-item-semantic-color.md` — Why `bg-red-800/90` not `su-rust`
- `docs/adrs/ADR-006-reactor-overload-partial-automation.md` — What Reactor Overload auto-applies vs. requires confirmation
- `docs/adrs/ADR-007-sequential-mutations-for-action-execution.md` — Why no RPC for Story 1
- `docs/adrs/ADR-008-automation-boundary.md` — Smart bookkeeping vs. permanent consequences
- `docs/architecture/data-flow.md` — TanStack Query patterns, mutation hooks, change log
- `docs/architecture/display-system.md` — EntityControl, StatItem, damageOverlayText
