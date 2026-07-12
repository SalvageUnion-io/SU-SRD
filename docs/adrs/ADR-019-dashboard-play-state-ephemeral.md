# ADR-019: Dashboard Play-State & Prefs Are Ephemeral / Local-First, Under the ADR-007 Boundary

## Status

Accepted — the Play Cockpit is **built** (realized in `apps/in-the-union-now/src/components/play/`, Phases 1–7, routed at `/play/:id`; design in the [Dashboard design doc](../architecture/dashboard.md)). Sub-decision of
[ADR-015](ADR-015-dashboard-distinct-play-surface.md); obeys the automation
boundary of [ADR-007](ADR-007-automation-boundary.md) as scoped by
[ADR-021](ADR-021-itun-surface-taxonomy.md).

## Context

The Dashboard tracks live play-state (who is mounted, range band, turn flags) that
is not character data. Where it lives determines whether it leaks into sheets and
shared snapshots.

## Decision

The **mount state machine** (pilot/mech/downtime, range band, turn flags) and dial
focus are **ephemeral Dashboard play-state** held in a dedicated non-persisted
`playStateStore` — **never** written to the mech/pilot schema and **never** in a
snapshot. **Dial config** (show/hide, order) and view prefs are **local-first** on
the workspace record (IndexedDB), never the backend
([ADR-004](ADR-004-snapshot-netlify-functions.md) leaves snapshots the only server
surface). Every Dashboard control obeys the
[ADR-007](ADR-007-automation-boundary.md) boundary: auto-apply non-destructive
bookkeeping (EP/Heat/uses/SP), player-confirm destructive change (destroy item,
Eject, meltdown).

## Rationale

There is no hard "pilot in mech" field (the link is a SoftLink), so mount state is
genuinely a play-session concern, not character data. Keeping it out of the schema
prevents it leaking into sheets and shared snapshots. This is the same
Free-Edit-vs-Guided-Play split the taxonomy draws
([ADR-021](ADR-021-itun-surface-taxonomy.md)): the Dashboard enforces its
transactions, and its ephemeral play-state is distinct from the persisted entity.

## Alternatives rejected

Storing mount/range on the mech record — rejected: pollutes the schema and
snapshots. Syncing Dashboard prefs via the snapshot backend — rejected: violates
the single-server-surface and immutability rules of
[ADR-004](ADR-004-snapshot-netlify-functions.md).
