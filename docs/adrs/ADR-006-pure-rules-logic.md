# ADR-006: Rules / Combat Logic as Pure Functions in `salvageunion-reference`

## Status

Accepted

## Context

Salvage Union's mechanics — heat generation, heat checks, push conditions,
action affordability, damage resolution — are shared across surfaces: ITUN
applies them to a live mech sheet, and the Discord bot rolls on the same tables.
If this logic lived inside ITUN's React/state layer, the bot couldn't reuse it
and it couldn't be unit-tested in isolation. If it depended on a backend, it
would violate [ADR-001](ADR-001-local-first-no-backend.md).

## Decision

Game rules logic lives as **pure, side-effect-free functions** in the data
package (`packages/salvageunion-reference/lib/combatUtils.ts` and siblings):

- Functions take state in and return results out — no I/O, no mutation of inputs,
  no backend or storage dependency (`getHeatGenerated`, `applyHeat`,
  `canActivateAction`, `shouldTriggerHeatCheck`, `canPush`, damage resolution,
  etc.).
- Applying a result to durable state is the **consumer's** job: ITUN persists via
  its stores ([ADR-003](ADR-003-zustand-hydration.md)) using sequential
  client-side mutations ([ADR-008](ADR-008-sequential-mutations.md)); the bot
  formats output for Discord.

## Consequences

- The same rules power ITUN and the bot with no duplication.
- Pure functions are trivially unit-testable without a DOM, store, or network.
- A clean seam separates "what the rules say" (this package) from "what the app
  does about it" — UI/state decisions don't leak into rules math.
- The automation boundary ([ADR-007](ADR-007-automation-boundary.md)) governs
  _which_ of these results the app applies automatically versus surfacing for
  player confirmation; this ADR only governs _where the math lives_.
