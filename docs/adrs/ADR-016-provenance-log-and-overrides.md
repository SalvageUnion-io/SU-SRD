# ADR-016: Per-Entity Provenance Log & Stat Overrides

## Status

Accepted (decision recorded ahead of implementation). Subordinate to
[ADR-015](ADR-015-itun-surface-taxonomy.md), which establishes the surface/mode
model this ADR serves.

## Context

[ADR-015](ADR-015-itun-surface-taxonomy.md) makes the **Live Sheet** a Free-Edit
surface: players may override caps, bypass lifecycle costs, and hand-edit state to
patch reality at the table. Two capabilities fall out of that decision and need
their own record:

1. **Overrides must be distinguishable from derived values.** If a player pins max
   SP above its computed value, the sheet has to show that the number is an
   override, not a derivation — and ideally let them revert.
2. **Manual edits need provenance.** The whole point of Free Edit is off-rules
   change. Six months later, "why does this mech have 4 extra cargo?" must be
   answerable. Enforced Cockpit transactions deserve the same trail. Without a log,
   the free surface becomes an un-auditable one.

Both touch the IndexedDB persistence layer
([ADR-002](ADR-002-indexeddb-idb-zod.md),
[ADR-003](ADR-003-zustand-hydration.md)) and are event-sourcing-shaped, so they
are a distinct decision from the surface taxonomy.

## Decision

### Provenance log

**Every mutation to a player entity, on every surface, appends to a per-entity,
append-only provenance log.** Both classes of change are recorded, each tagged
with its provenance:

- **Transaction** entries — enforced lifecycle events from Guided Creation / Guided
  Play (`spent 3 scrap to install Coilgun`, `Push: +2 heat, Heat Check → 14`).
- **Override / manual** entries — free edits from the Live Sheet
  (`manual override: currentHeat → 0`, `cap override: maxSP 12 → 16`,
  `installed Coilgun (no cost)`).

Properties:

- **Append-only and ordered** — entries are never mutated or deleted in place; the
  log is the entity's history, not a cache.
- **Emitted at one chokepoint** — the entry is written where all persistence
  already funnels: the `entityStore.update` write-through
  ([ADR-003](ADR-003-zustand-hydration.md)). "Every mutation is logged" then holds
  by construction, not by remembering to log at each call site; a surface that
  mutates an entity outside the store is the visible anti-pattern, not a silent gap.
- **Replay-shaped, replay-deferred** — entries carry enough structure
  (target field, before/after, provenance kind, source surface) to _reconstruct_
  state by replay. A player-facing replay / time-travel surface is **explicitly out
  of scope for now** — we build the log so replay is _possible_, not the replay UI.
- **Local only** — the log lives in IndexedDB and **does not travel with a
  published snapshot**. A snapshot stays a frozen, historyless, bare-entity payload
  ([ADR-004](ADR-004-snapshot-netlify-functions.md),
  [ADR-010](ADR-010-srd-choices-ephemeral-vs-persisted.md)). Provenance is a
  local-first, owner-only concern; it is not part of the share contract.

### Stat overrides

**An overridden stat retains its derived baseline.** A cap/maximum override stores
both the pinned value and the value it would derive to, so the UI can render an
"overridden from N" callout and offer a one-click revert to derived. Overrides are
therefore **non-destructive and reversible**: reverting drops the pin and the stat
resumes tracking its derivation.

- The override marker is a small, visible graphical callout on the affected stat —
  enough to tell an overridden value from a derived one at a glance.
- Overrides apply to quantitative caps and maxima (per ADR-015). Structural
  coherence is never overridable; free state needs no override concept (it is
  already free).

## Consequences

- The Live Sheet's freedom becomes auditable rather than opaque — the audit trail
  is strongest exactly where the app stops enforcing.
- Overrides are safe to make: nothing is lost, the derived baseline is always
  recoverable, and the sheet never silently hides that a number was pinned by hand.
- New cost: schema + migration work in `src/lib/db/` (an append-only log store and
  an override representation on entity records). Routing the log entry through the
  `entityStore.update` chokepoint ([ADR-003](ADR-003-zustand-hydration.md)) keeps
  "every mutation is logged" structural rather than a per-call-site discipline —
  the requirement lives in one place instead of scattered across components.
- Replay is preserved as a future option at low present cost — the log is designed
  for it even though no replay surface ships now.
- Snapshot payloads and their privacy surface are unchanged: history stays local.
