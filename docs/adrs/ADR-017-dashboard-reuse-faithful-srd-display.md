# ADR-017: Reuse the Faithful Light SRD Display; Instruments Are Bespoke

## Status

Proposed (materialized from the [Dashboard design doc](../architecture/dashboard.md);
"Proposed" until realized). Sub-decision of
[ADR-015](ADR-015-dashboard-distinct-play-surface.md).

## Context

The Dashboard needs to show reference entities (systems, abilities, actions, roll
tables) while playing. It could fork a HUD-specific renderer or reuse the app's
existing display system.

## Decision

The display renders the **actual** `ReferenceEntityDisplay` + `ActionCard` /
`NestedActionDisplay` + `ReferenceEntityActions` + `RollTable` from `suref-react` —
the same light "workshop paperwork" reference document the rest of the app shows.
Action economy is injected through the existing
`Erow` / `ActionCardErow` + `DisplayCard.footActions`/`footMeta` pattern, **not** a
new schema-specific renderer. Only the _instruments_ (gauges, bays, dial, buttons)
are new Dashboard components.

## Rationale

One display system, one place to fix reference rendering, and the Dashboard's
reference view stays byte-for-byte identical to the sheet's. The foot-meta
vocabulary already carries action economy in the sheet; extending it avoids forking
the display ([ADR-011](ADR-011-suref-react-source-no-build.md)).

## Alternatives rejected

A Dashboard-specific "action chip" display (forking the entity display) — rejected
per the design record's explicit "reuse the display system" call. A render-prop on
`ActionCard` for economy — unnecessary; `Erow` already solves it.
