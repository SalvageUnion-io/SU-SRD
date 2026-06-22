# ADR-008: Action Execution via Sequential Client-Side Mutations

## Status

Accepted

## Context

Using an action changes several pieces of mech state at once: spend EP, apply
heat, decrement the item's remaining uses. With a backend, this would be one
atomic transaction (a single RPC). But there is no backend
([ADR-001](ADR-001-local-first-no-backend.md)); state changes are applied
client-side through the Zustand stores
([ADR-003](ADR-003-zustand-hydration.md)), which write through to IndexedDB one
update at a time.

The choice was between building a client-side transaction/rollback mechanism over
IndexedDB, or accepting sequential mutations with their failure mode.

## Decision

Action execution applies **sequential, independent client-side mutations** via
the store. In `activateItem` (the mech sheet), EP is spent, then heat applied,
then uses decremented — each a separate `update`. There is **no atomic
transaction and no automatic rollback**; the rare partial-application failure
mode is accepted rather than engineered away.

Affordability is checked **before** execution (the automation boundary,
[ADR-007](ADR-007-automation-boundary.md), blocks an action whose resources or
heat cost can't be paid), so the common failure causes are prevented up front
rather than rolled back after the fact.

## Consequences

- The state layer stays simple: no bespoke transaction manager over IndexedDB.
- The accepted risk is a partial mutation if execution is interrupted mid-
  sequence (e.g. EP spent but uses not decremented). Pre-execution validation
  makes this rare, and the user can correct state manually (state is local and
  directly editable).
- If a future mechanic genuinely cannot tolerate partial application, that case
  warrants its own transactional treatment and an ADR superseding this one — it
  does not change the default.
