# ADR-007: Automation Boundary — Smart Bookkeeping, No Automatic Destruction

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 7, which summarises it.

## Status

Accepted

## Context

When the Cantina applies combat results to a mech sheet, a recurring question is which
events the app should apply automatically and which require explicit player
action. An inconsistent boundary (auto-applying some destructive outcomes but not
others) produces a confusing experience and surprises players with destroyed gear
they didn't choose.

## Decision

**The app automates resource bookkeeping and enforces the rules. It never
changes an item's condition without explicit player action.**

Auto-applied (non-destructive, recoverable):

- Heat generated when using an action; AP/EP spent; item uses decremented
  (`activationPatch` in `apps/web/src/lib/rules/playActions.ts` builds them as
  one write-through patch — see [ADR-008](../ARCHITECTURE.md#decisions)).
- Heat clamping to the cap; Heat Check prompt when heat is gained.
- SP damage from a Reactor Overload high roll (damage = current heat), and other
  pure bookkeeping computed by the rules functions
  ([ADR-006](../ARCHITECTURE.md#decisions),
  `packages/salvageunion-reference/lib/rules/heatCheck.ts`).
- Blocking an action when resources are insufficient or the heat cost would
  exceed the cap.

Requires explicit player action (destructive, irreversible):

- Any condition change on equipment (intact → damaged → destroyed), driven only
  by the player via the card's status badge (`StatusBadge` from
  `apps/web/src/components`, cycled by `cycleCondition` in
  `apps/web/src/lib/rules/mechItems.ts`) — see
  [ADR-009](../ARCHITECTURE.md#decisions).
- Destroying a Module or System from any source; catastrophic meltdown.

The principle: **smart bookkeeping, hands-off on permanent consequences.** Roll
outcomes that imply destruction surface the choice; they do not silently mutate
the sheet.

## Consequences

- Players never find a destroyed item on their sheet they did not choose;
  narrative surprises stay at the table, not in the app.
- Any new combat mechanic must be classified against this boundary before it's
  built: pure bookkeeping may auto-apply; anything that destroys or downgrades
  equipment must be player-driven.
- This boundary is why rules functions ([ADR-006](../ARCHITECTURE.md#decisions))
  return results rather than apply them — the consumer decides what crosses the
  line into durable, destructive state.
