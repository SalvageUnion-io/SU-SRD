# ADR-019: Dashboard Play-State & Prefs Are Ephemeral / Local-First, Under the ADR-007 Boundary

## Status

Accepted, and **merged into [ADR-015](ADR-015-dashboard-distinct-play-surface.md)** as
its Dashboard decision 4. The number is kept because code cites it.

Full text: `git show c2476d1c:docs/adrs/ADR-019-dashboard-play-state-ephemeral.md`

Its play-state decision is reversed by [ADR-038](ADR-038-dashboard-game-surface-shared-play-state.md): play state becomes a
per-pilot seat saved on the Game. Mount still never reaches a pilot or mech record.
