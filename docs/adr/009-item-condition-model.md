---
status: accepted
---

# ADR-009: Item Condition Model and Destroyed Semantic Color

## Status

Accepted

## Context

Mech equipment in Salvage Union moves through condition states, and the player
drives those transitions (per the automation boundary,
[ADR-007](007-automation-boundary.md)). The UI needs one consistent control
and color language for condition, including how a "destroyed" item reads
visually — and the SU brand palette (rust/grey/yellow hazard tones) doesn't
contain an unambiguous "this is destroyed" signal.

## Decision

- Equipment condition is a **tri-state**: `intact` → `damaged` → `destroyed`,
  cycling back to `intact`. It is modeled as `ItemCondition` and driven by the
  card's status badge (`StatusBadge` from `component-lib`), cycled by
  `cycleCondition` in `apps/itun/src/components/sheet/mechItemRules.ts`.
- The control is **player-driven and keyboard-accessible**: given an `onClick`,
  `StatusBadge` wraps the badge in a native `<button type="button">`; without
  one it renders a plain, non-interactive `Badge`, the **read-only mode** for
  read-only sheets.
- Condition maps onto the badge tones `ok` / `warn` / `bad` (intact, damaged,
  destroyed), styled `bg-status-ok` / `bg-status-warn` / `bg-status-bad`.
  **Destroyed reads as semantic red**: `--color-status-bad` is
  `--color-roll-cascade`, `rgb(176, 67, 43)` — deliberately a semantic status
  color, **not** a Salvage Union brand token.

## Consequences

- Condition has one source of truth (`ItemCondition` + `cycleCondition`) reused
  wherever equipment condition is shown or edited.
- "Destroyed" is unambiguous because it uses a conventional danger color rather
  than a brand tone that players might not read as a warning.
- The same component serves editable and read-only sheets, so condition renders
  consistently across both.
- Using a non-brand semantic color is intentional; don't "fix" it to a brand
  token — legibility of the destroyed state is the priority.
