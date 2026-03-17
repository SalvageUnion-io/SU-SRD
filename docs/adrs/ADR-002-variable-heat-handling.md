# ADR-002: Variable Heat `hot(x)` Handling

## Status

Accepted

## Context

Most weapons and systems have a fixed heat cost encoded in the `hot` trait as a numeric `amount` (e.g., `hot` with `amount: 3`). A small number of entities have `hot(x)` — the heat generated depends on how the action is used, and the amount is not knowable from the data alone.

`getHeatGenerated()` in `combatUtils.ts` reads the `hot` trait and returns the cost. It needs a way to signal "this action's heat cost is variable" without conflating it with "this action generates no heat."

## Decision

`getHeatGenerated()` returns `number | 'variable'`.

- `0` means the action generates no heat.
- A positive number means the action generates that exact amount of heat.
- `'variable'` means the heat amount is unknown from the data and must be entered by the player.

When the UI receives `'variable'` from `getHeatGenerated()`, it shows a heat input step before the action executes. The player enters the heat amount. If the entered value would exceed the mech's heat cap, the action is blocked with an error toast and the input step remains open.

Fixed heat is auto-applied without any input prompt.

## Consequences

- `getHeatGenerated()` has a non-numeric return type. All callers must handle the `'variable'` branch.
- The UI flow for variable-heat actions has one extra step (input prompt) compared to fixed-heat actions.
- The "Use" button label shows `"Use (Heat: ?)"` for variable heat actions instead of `"Use (Heat: N)"`.
- Variable heat input is part of the pre-execution check sequence: enter amount -> validate cap -> proceed or block.
- No new data model changes are required. The distinction is handled entirely in `combatUtils.ts` logic.
