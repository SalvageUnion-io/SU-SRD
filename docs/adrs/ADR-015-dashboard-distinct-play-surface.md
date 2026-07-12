# ADR-015: The Dashboard is a Distinct Actual-Play Surface, Separate from Live Sheets

## Status

Accepted — the Play Cockpit is **built** (realized in `apps/in-the-union-now/src/components/play/`, Phases 1–7, routed at `/play/:id`; design in the [Dashboard design doc](../architecture/dashboard.md)). This is the specific
play-surface instance of the governing surface taxonomy in
[ADR-021](ADR-021-itun-surface-taxonomy.md) — the **Guided Play** surface.

## Context

ITUN's live sheet fuses two moments with opposite interaction grammars: editing a
character (inline edit + scroll) and running it at the table (one-screen, no-scroll
instrument buttons). Forcing both into one surface produced clutter. The
[surface taxonomy](ADR-021-itun-surface-taxonomy.md) names these as two modes —
Free Edit and Guided Play — and this ADR gives Guided Play its own surface.

## Decision

The **Dashboard** is a **new surface** at `/dashboard/$id`, not a mode of the live
sheet. It composes a player's **Pilot + Mech + Crawler** into one live play
surface. Sheets edit a character; the Dashboard runs it at the table. Both read and
mutate the **same** persisted entities through the **same** store and rules engine
([ADR-006](ADR-006-pure-rules-logic.md), [ADR-003](ADR-003-zustand-hydration.md)) —
the Dashboard is a second lens, not a second source of truth.

## Rationale

The two moments have opposite interaction grammars (inline edit + scroll vs.
one-screen no-scroll instrument buttons). Sharing state (not chrome) keeps them
consistent via the existing multi-tab broadcast. As the Guided Play surface it is
where enforced lifecycle transactions live (see
[ADR-021](ADR-021-itun-surface-taxonomy.md) and
[rules-engine-boundary.md](../architecture/rules-engine-boundary.md)).

## Alternatives rejected

- **A "play mode" toggle on the sheet** — rejected: the layouts are irreconcilable
  in one component.
- **A separate app** — rejected: duplicates the data layer and breaks local-first
  single-store consistency.

## Consequences

- The single-player Dashboard is the first step toward the long-tail shared, live
  Dashboard (multiple players + Mediator sync) noted in ADR-021.
- Full design (layout, components, canvas) lives in
  [dashboard.md](../architecture/dashboard.md); ADRs 016–020 pin its sub-decisions.
