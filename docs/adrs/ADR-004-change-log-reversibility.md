# ADR-004: Change Log Reversibility for Combat Events

## Status

Accepted

## Context

The `change_log` table has a `reversible` boolean field. During combat, several types of changes are logged:

- Resource spends: AP spent, EP spent, heat applied
- Condition changes: equipment transitioning from intact -> damaged or damaged -> destroyed

The `reversible` flag signals to the UI (and to the audit trail) whether a change represents a mistake that can be undone or a permanent game event that should stand.

## Decision

Resource spends (AP, EP, heat) are logged as `reversible: true`. Mistakes happen at the table — a player may click "Use" on the wrong action, or miscount resources. These are easy to undo without meaningful game consequence.

Condition changes (any `item_condition` change: intact -> damaged, damaged -> destroyed) are logged as `reversible: false`. These represent significant game events. The appropriate way to recover from a condition change is a forward repair action, not an undo. Logging these as permanent preserves the integrity of the activity feed.

## Consequences

- `changeLogApi.log()` calls in `handleUseAction` set `reversible` based on the change type.
- Resource spend logs: `reversible: true`
- Condition change logs: `reversible: false`
- Any future "undo" UI feature can filter on `reversible: true` to find reversible combat events.
- Condition changes remain in the permanent audit trail even if the item is later repaired. Repair is logged as a separate forward event.
