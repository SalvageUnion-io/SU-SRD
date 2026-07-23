# ADR-009: Item Condition Model and Destroyed Semantic Color

## Status

Accepted

## Context

Mech equipment in Salvage Union moves through condition states, and the player
drives those transitions (per the automation boundary,
[ADR-007](ADR-007-automation-boundary.md)). The UI needs one consistent control
and color language for condition, including how a "destroyed" item reads
visually — and the SU brand palette (rust/grey/yellow hazard tones) doesn't
contain an unambiguous "this is destroyed" signal.

## Decision

- Equipment condition is a **tri-state**: `intact` → `damaged` → `destroyed`,
  cycling back to `intact`. It is modeled as `ItemCondition` and driven by a
  single controlled component, `ConditionToggle`
  (`apps/itun/src/components/shared/ConditionToggle.tsx`).
- The control is **player-driven and keyboard-accessible** (role="button",
  Enter/Space, 44px touch target) and has a **`readOnly` static-badge mode** for
  read-only contexts such as published snapshots
  ([ADR-004](ADR-004-snapshot-netlify-functions.md)).
- **Destroyed reads as semantic red** (`bg-roll-cascade`, Material red ≈
  `rgb(244, 67, 54)`), deliberately a semantic status color, **not** a Salvage
  Union brand token. Intact uses `bg-roll-success`, damaged `bg-roll-failure`.

## Consequences

- Condition has one source of truth (`ItemCondition` + `ConditionToggle`) reused
  wherever equipment condition is shown or edited.
- "Destroyed" is unambiguous because it uses a conventional danger color rather
  than a brand tone that players might not read as a warning.
- The same component serves editable sheets and read-only snapshots, so condition
  renders consistently across both.
- Using a non-brand semantic color is intentional; don't "fix" it to a brand
  token — legibility of the destroyed state is the priority.
