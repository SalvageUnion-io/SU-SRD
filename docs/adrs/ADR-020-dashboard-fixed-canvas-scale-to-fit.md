# ADR-020: Fixed 1280×800 Scale-to-Fit Canvas with a Phone-Reflow Floor

## Status

Accepted — the Play Cockpit is **built** (realized in `apps/in-the-union-now/src/components/play/`, Phases 1–7, routed at `/play/:id`; design in the [Dashboard design doc](../architecture/dashboard.md)). Sub-decision of
[ADR-015](ADR-015-dashboard-distinct-play-surface.md).

## Context

The Dashboard's defining promise is "always one screen, never scrolls" during play.
That has to hold across desktop sizes without per-breakpoint layout churn, and
degrade gracefully on phones and under large zoom.

## Decision

The Dashboard is a **fixed 1280×800 design canvas** scaled with a single
`transform: scale(min(vw/1280, vh/800))`, letterboxed, clamped to ~`[0.62, 1.3]`.
No-scroll is a **landscape-desktop contract**; below the clamp floor (and,
tentatively, under large accessibility zoom) the canvas is abandoned for a
**native stacked, scrolling phone layout** reusing the same instrument components.

## Rationale

A fixed canvas is the only way to guarantee "always one screen, never scrolls"
across desktop sizes without per-breakpoint layout churn. The reflow floor is the
escape hatch that keeps phones (and zoom users) usable.

## Alternatives rejected

A fully responsive fluid grid — rejected: cannot guarantee no-scroll at all sizes
and reflows the locked frame. Scaling with no floor — rejected: fights browser zoom
and becomes illegibly small on phones.
