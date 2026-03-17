# ADR-008: Automation Boundary — Smart Bookkeeping, No Automatic Destruction

## Status

Accepted

## Context

As the combat loop was designed, a recurring question arose: which game events should the app apply automatically, and which should require player confirmation?

An early draft applied the automation boundary loosely, with some destructive outcomes (Reactor Overload module/system destruction) treated as automated and others (Critical Damage) left manual. This inconsistency produced an unclear user experience and would have required revising several other decisions.

The question was clarified into a single governing principle.

## Decision

The app automates resource bookkeeping and enforces game rules. It never destroys equipment without explicit player confirmation.

**Auto-applied (non-destructive, reversible):**

- Heat generation when using an action
- AP/EP spending when using an action
- Heat Check prompt when heat is gained (d20 vs. current heat)
- SP damage from Reactor Overload result 11–19 (damage = current heat)
- Blocking an action if resources are insufficient
- Blocking an action if heat cost would exceed the heat cap

**Require player confirmation (destructive, irreversible):**

- Destroying a Module (any source: Reactor Overload 6–10, Critical Damage 6–10)
- Destroying a System (any source: Reactor Overload 2–5, Critical Damage 2–5)
- Catastrophic meltdown (Reactor Overload 1) — player handles manually
- Any condition change on equipment (intact -> damaged -> destroyed)

**No condition change is applied without the player seeing the consequence and confirming it.**

The principle: **smart bookkeeping, hands-off on permanent consequences.**

## Consequences

- ADR-006 (Reactor Overload) reflects this boundary: roll 11–19 auto-applies SP damage, rolls 6–10 and 2–5 open the target picker requiring confirmation.
- ADR-003 (damage target selection) is consistent with this boundary: the player always confirms which item is destroyed.
- ADR-004 (change log reversibility) aligns with this boundary: auto-applied changes are `reversible: true`, condition changes are `reversible: false`.
- The automation boundary is a stable rule. If new combat mechanics are added in the future, classify them against this boundary before implementing.
- The user experience consequence: players never encounter a destroyed item on their sheet without having explicitly chosen it. Surprises happen at the narrative level, not the app level.
