# ADR-007: Automation Boundary — Smart Bookkeeping, No Automatic Destruction

## Status

Accepted

## Context

When ITUN applies combat results to a mech sheet, a recurring question is which
events the app should apply automatically and which require explicit player
action. An inconsistent boundary (auto-applying some destructive outcomes but not
others) produces a confusing experience and surprises players with destroyed gear
they didn't choose.

## Decision

**The app automates resource bookkeeping and enforces the rules. It never
changes an item's condition without explicit player action.**

Auto-applied (non-destructive, recoverable):

- Heat generated when using an action; AP/EP spent; item uses decremented
  (`activateItem` in the mech sheet performs these as sequential mutations —
  see [ADR-008](ADR-008-sequential-mutations.md)).
- Heat clamping to the cap; Heat Check prompt when heat is gained.
- SP damage from a Reactor Overload high roll (damage = current heat), and other
  pure bookkeeping computed by the rules functions
  ([ADR-006](ADR-006-pure-rules-logic.md), `lib/rules/heatCheck.ts`).
- Blocking an action when resources are insufficient or the heat cost would
  exceed the cap.

Requires explicit player action (destructive, irreversible):

- Any condition change on equipment (intact → damaged → destroyed), driven only
  by the player via the `ConditionToggle`
  (`apps/in-the-union-now/src/components/shared/ConditionToggle.tsx`) — see
  [ADR-009](ADR-009-condition-model-destroyed-color.md).
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
- This boundary is why rules functions ([ADR-006](ADR-006-pure-rules-logic.md))
  return results rather than apply them — the consumer decides what crosses the
  line into durable, destructive state.
