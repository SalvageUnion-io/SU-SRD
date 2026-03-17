# ADR-006: Reactor Overload — Partial Automation

## Status

Accepted

## Context

When a Heat Check fails, the player rolls on the Reactor Overload Table:

| Roll | Result |
|------|--------|
| 20 | Miraculous — no damage |
| 11–19 | Core damage — SP damage equal to current heat |
| 6–10 | Module destroyed |
| 2–5 | System destroyed |
| 1 | Catastrophic meltdown |

These outcomes have varying implementation complexity and varying permanence. An earlier draft of this decision categorized the Reactor Overload Table as purely informational — show the text, player applies everything manually. That draft was revised after clarifying the automation boundary (see ADR-008).

The revised question: which Reactor Overload outcomes does the app apply automatically, and which require player confirmation?

## Decision

The app applies the Reactor Overload Table result as follows:

**Roll 20 (miraculous).** Show result text. No further action.

**Roll 11–19 (core damage).** Auto-apply SP damage equal to current heat. Show the new SP value. Player dismisses. This is non-destructive and reversible — it is math that the app can do reliably.

**Roll 6–10 (module destroyed) or 2–5 (system destroyed).** Show result text, then open the target picker. Player selects the target from their equipment list or taps "Random." Condition change applies only after player confirmation.

**Roll 1 (catastrophic meltdown).** Show result text. Player handles consequences manually using existing tools (Take Damage, etc.). Meltdown has complex, campaign-altering consequences that do not fit a simple automated flow.

No `is_shutdown` column is added to the `mechs` table. Shutdown, if it occurs, is communicated verbally at the table.

## Consequences

- The Heat Check modal is a multi-step flow: roll result -> conditional action -> dismiss.
- Auto-applied SP damage (11–19) uses the same `apply_mech_damage` path as player-initiated damage.
- Destructive outcomes (6–10, 2–5) use the same target picker as Critical Damage (ADR-003).
- Meltdown (1) requires no special app state. Players handle it at the table.
- The distinction between auto-applied and confirmation-required is consistent with ADR-008 (automation boundary).
- Future enhancement: full meltdown automation could be added as a separate story if demand warrants it.
