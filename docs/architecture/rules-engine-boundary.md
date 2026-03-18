# Rules Engine Boundary

ITUN is a shared living character sheet, not a game engine. The line between what the app enforces and what it leaves to the Mediator is drawn at one boundary: **economic constraints** vs. **procedural adjudication**.

This document codifies that boundary, places every identified gray-zone mechanic explicitly on one side, and establishes a classification rule for future development.

---

## The Boundary Statement

**ITUN enforces economic constraints.** These are deterministic, player-facing limits on resources, progression, and equipment state that can be computed unambiguously from structured data. Violation is blocked by the UI.

**ITUN does not enforce procedural adjudication.** These are table-governance concerns — who acts when, what consequences a roll implies, how narrative outcomes unfold — that depend on Mediator judgment and social coordination. The app may surface relevant rules text or prompt for input, but it never blocks or controls the outcome.

This boundary maps onto a deeper principle already present in the codebase: the honor system of ADR-001 (Self-Service Combat Model). The app trusts players to act in turn and trusts the Mediator to govern the table. What the app does own is the math: costs, caps, conditions, prerequisites.

---

## Economic Constraints (ITUN Enforces)

The following constraints are validated in code. The UI blocks or warns when they would be violated.

### Tech Level Gates

Crafting, trading, and repair actions check the crawler's tech level against the item's tech level requirement. A Tech 2 crawler cannot craft a Tech 4 system. This is enforced at the point of action, not advisory.

### Scrap Costs

Crafting and repair actions consume scrap at the appropriate tech level. The mutation verifies the crawler has sufficient scrap before writing. Insufficient scrap blocks the action.

### Training Point Costs and Ability Prerequisites

Spending TP to unlock an ability checks both that the pilot has enough TP and that any named prerequisite abilities are already unlocked. The `ability-tree-requirements.json` data encodes these prerequisite chains. The validation function must consume this data rather than using a numeric approximation.

### Slot Capacities

System slots, module slots, and cargo slots each have a defined capacity. Adding an item to a full slot is blocked. The `ReferenceEntityPickerModal` renders over-capacity items as greyed with a red outline so players understand what they cannot select and why — rejection is visible, not hidden.

### Equipment Condition Tracking

Item condition transitions (`intact` -> `damaged` -> `destroyed`) are tracked in the `entity_refs` table. ITUN surfaces condition state on every entity card and prevents use of destroyed items. Condition writes always require explicit player confirmation (see ADR-008).

### Heat Capacity Limits

An action whose heat cost would cause current heat to exceed the heat cap is blocked before execution. `canActivateAction(currentHeat, heatCost, heatCap)` in `combatUtils.ts` is the authoritative check. This is a hard block, not a warning — the action button is disabled.

---

## Procedural Adjudication (Left to Mediator)

The following are deliberately outside the app's enforcement scope. The Mediator governs them at the table.

### Action Economy

Turn actions, reactions, and free actions per round are not tracked or enforced. All players can always activate actions from their sheet. This is by design (ADR-001): Salvage Union does not have formal turn enforcement, and adding it would add complexity without matching how the game is played.

### Initiative and Turn Order

The app does not track who goes next. Initiative is handled socially. The Mediator declares open rounds; players act. No server-side sequencing is implemented or planned.

### Movement and Range Band Enforcement

Range bands (Close, Near, Far, Distant) are contextual terrain descriptions, not computable distances. The app does not enforce them. Action descriptions may reference range, but the Mediator adjudicates whether a target is in range.

### Narrative Consequences of Die Rolls

Tough choices, setbacks, and other narrative outcomes from rolls are communicated verbally at the table. The app may display a roll result, but the Mediator interprets consequence and the player applies it using existing tools (Take Damage, condition changes, etc.).

### Death Blow Declarations

Whether a target is destroyed by an attack is a Mediator call. The app tracks HP and SP, but the transition from "0 SP" to "mech destroyed" is not automated — the Mediator declares it, and players apply consequences manually.

### Exploration and Area Salvage Supply Tracking

The number of salvage rolls remaining in a zone is Mediator bookkeeping. ITUN does not track exploration supply totals. If this becomes a recurring need, it is a future Mediator-facing feature, not an economic constraint on players.

---

## Gray Zone Mechanics

Several mechanics have characteristics of both categories. This section places each one explicitly, with rationale.

### Heat Check Modal — Economic

The Heat Check triggers whenever heat is gained (`shouldTriggerHeatCheck` in `combatUtils.ts`). The trigger condition is deterministic: heat was gained, therefore a check is required. No Mediator judgment is involved in whether to trigger. The modal fires automatically.

What happens after the roll (the Reactor Overload Table) is hybrid — see below. But the trigger itself is economic: a computable threshold crossed.

**Placement: economic (trigger), hybrid (consequence). Trigger is enforced. Consequences are partially automated per ADR-006.**

### Keepsake / Background / Motto Re-roll — Economic

Each pilot's special re-roll (keepsake, background, motto) has a binary used/unused state tracked in the database (`_used` booleans). Once used, it is unavailable until restored during the Downtime Restore step. This is pure resource tracking — no Mediator judgment determines whether the re-roll was validly spent.

**Placement: economic. ITUN enforces availability and tracks state. Restore step must reset these flags.**

### Critical Damage Table (Mech 0 SP) — Hybrid

When a mech reaches 0 SP, the Critical Damage Table applies. The trigger is economic: an HP/SP threshold reached. But the consequence (which system or module is destroyed, or whether the player chooses vs. rolls randomly) involves Mediator input for some outcomes.

**Placement: hybrid. The trigger should fire automatically when SP reaches 0. Consequence selection (random target picker or Mediator-directed choice) requires player confirmation before any write. No condition change is applied without the player seeing and confirming the outcome (ADR-008).**

### Push Mechanic — Hybrid

The decision to Push is the pilot's voluntary choice, not a deterministic threshold. No app logic can determine when pushing is appropriate — that is a player judgment call. However, the heat cost of a Push (2 heat) is a hard economic constraint once the player elects to push.

**Placement: hybrid. The Push decision is procedural (player-initiated). The heat cost application is economic (enforced on confirmation). `canPush()` in `combatUtils.ts` is the gate check. ITUN should surface a Push button within the action activation flow but not prompt unprompted.**

### Reactor Overload — Hybrid

The Reactor Overload Table fires after a failed Heat Check. The trigger is economic (deterministic dice threshold). Consequence execution varies by result:

- Roll 20: informational only.
- Roll 11–19: SP damage equal to current heat — economic, auto-applied.
- Roll 6–10 or 2–5: module or system destroyed — requires target selection and confirmation.
- Roll 1: catastrophic meltdown — Mediator handles manually.

**Placement: hybrid per outcome. See ADR-006 for the full decision. The pattern is: non-destructive math is auto-applied; destructive outcomes require confirmation; narrative extremes are left to the Mediator.**

---

## Implications for Future Development

**Classify before implementing.** When a new feature involves a game rule, place it in one of three categories before writing any code:

| Category | Definition | App behavior |
|----------|------------|--------------|
| Economic | Deterministic constraint computable from structured data | Enforce in code. Block violations. |
| Procedural | Requires Mediator judgment or table-social coordination | Surface relevant rules text, prompt for inputs, but do not enforce. |
| Hybrid | Has an economic trigger and a procedural or player-confirmed consequence | Trigger automatically. Present outcomes for Mediator or player confirmation before writing. |

**Economic constraints should be enforced in code.** If a rule can be expressed as a comparison against a value in the database or the reference data, ITUN should enforce it. Advisory warnings for checkable constraints are a weaker substitute.

**Procedural mechanics should be surfaced, not enforced.** For mechanics the app cannot resolve without Mediator input, display the relevant rules text, show a prompt with the relevant roll or decision context, and let the player or Mediator apply the outcome using existing tools.

**Hybrid mechanics should trigger automatically and present outcomes for confirmation.** The trigger condition (threshold crossed, resource spent) fires without user initiation. The consequence write requires the player to see and confirm the result before it is persisted. This is the automation boundary from ADR-008: smart bookkeeping, hands-off on permanent consequences.

**Gray zones should be resolved here, not in code comments.** If a new mechanic is ambiguous, update this document with the explicit placement and rationale before implementation begins. That record prevents inconsistent design decisions across stories.

---

## Cross-References

- `docs/adrs/ADR-001-self-service-combat-model.md` — Honor system foundation; no turn enforcement
- `docs/adrs/ADR-006-reactor-overload-partial-automation.md` — Hybrid mechanic example: Reactor Overload outcomes
- `docs/adrs/ADR-008-automation-boundary.md` — Smart bookkeeping, confirmation required for destructive outcomes
- `docs/architecture/combat-loop.md` — Implementation details for the combat resource loop
- `docs/architecture/data-flow.md` — How economic constraints are stored and hydrated
