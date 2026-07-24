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
package (`packages/salvageunion-reference/lib/rules/`, reached via the
`salvageunion-reference/rules` subpath export):

- Functions take state in and return results out — no I/O, no mutation of inputs,
  no backend or storage dependency (`clampHeat`, `canActivateAction`,
  `performHeatCheck`, `performPush`, `applySpDamage`, `applyMechDamage`, etc.).
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

## Status update (2026-07): ITUN rules-module migration

For a long stretch after this ADR was accepted, only `combatUtils.ts` and
`rollOnTable.ts` actually lived in the package (`combatUtils.ts` no longer
exists — it was later folded into `lib/rules/`, its two live functions landing
in `rules/heatCheck.ts` and `rules/takeDamage.ts` and its five unused ones
deleted, so that path is history, not a live location) — the bulk of the rules engine
(21 modules) had grown up locally in
`apps/itun/src/lib/rules/` instead, so the "shared by ITUN and the
Discord bot" promise wasn't yet true beyond those two files. A migration
project moved the fully-portable modules into
`packages/salvageunion-reference/lib/rules/`, executed in dependency-ordered
tiers:

**Tier 1 — moved (zero ITUN-schema coupling):** `capacity.ts`, `cargo.ts`,
`crawlerCapacity.ts`, `scrap.ts`, `resolveRefs.ts`, `pilotSnapshot.ts`,
`crawlerSystems.ts`, `softWarnings.ts`, `detailWarnings.ts`, and the
structural-type module `types.ts` (its own header comment had anticipated
exactly this move — "this module is file-disjoint from schemas... Zod schemas
will satisfy these structural shapes automatically").

**Tier 2 — moved (small outcome-shape types generalized structurally):**
`takeDamage.ts`, `coreMechanic.ts`, `derivedStats.ts`, `mediatorTables.ts`, and
the pure half of `heatCheck.ts` (`clampHeat`, `reactorOverloadOutcome`,
`performHeatCheck`, `performPush`). Several of these modules turned out to
import outcome/result types (`HeatCheckResult`, `ReactorOverloadOutcome`,
`CriticalDamageResult`/`Outcome`, `CriticalInjuryResult`/`Outcome`,
`MediatorRollResult`, `MediatorTableId`) directly from ITUN's Zod schemas — a
tighter coupling than a pre-migration survey had assumed for some of them.
These were generalized into small structural types in the package's
`types.ts` (the same "outcome/result record shape, not a full persisted
record" treatment already used for `derivedStats.ts`'s `Pick<Mech/Pilot/
Crawler, ...>` parameters); ITUN's Zod-inferred types satisfy them
structurally with no behavior change. `heatCheck.ts`'s `@randsum/roller`
binding (`defaultRoll`) and `Partial<Mech>` patch assembly (`heatCheckPatch`)
stayed in ITUN, per the automation-boundary split
([ADR-007](ADR-007-automation-boundary.md)) — the package only owns the
deterministic math, not the RNG binding or the write-through shape.

Every migrated ITUN module became a thin re-export shim at its original path
(re-exporting the same public API from `salvageunion-reference`) rather than
being deleted, because ~40 ITUN call sites import these by submodule path
(e.g. `../../lib/rules/capacity`), not through the `lib/rules` barrel — the
shim pattern kept every call site unchanged while the implementation now
lives in the package.

**Tier 3 — deferred, not yet migrated:** `crawlerEconomy.ts`, `salvage.ts`,
`crafting.ts`, `scrapMech.ts`, and `downtime.ts` remain app-local in
`apps/itun/src/lib/rules/`. These modules are deeply coupled to
full persisted records and to `CargoLot` construction via ITUN's
`makeUnitLot()` (which calls `crypto.randomUUID()` — app/runtime machinery,
not pure rules math), so the extraction boundary is less mechanical than
Tiers 1–2 and was left for a follow-up: `crawlerEconomy.ts`'s pure math
(once `ScrapPool` becomes a package structural type) is the next entry point,
with its `DOWNTIME_UPKEEP_SCRAP` constant flipping ownership to the package
(`downtime.ts` would then import it back, not the reverse); `salvage.ts`,
`crafting.ts`, `scrapMech.ts`, and `downtime.ts` would keep their
`CargoLot`-building code in ITUN as thin wrappers around pure math moved out
into the package.

The Discord bot was intentionally left untouched by this migration — wiring
the newly-portable rules into the bot is a follow-up consequence of this ADR,
not part of the migration itself.

**Follow-up (2026-07): the pure pass-through shims were removed.** Eight of
the Tier 1/2 shims (`capacity`, `cargo`, `crawlerSystems`, `pilotSnapshot`,
`scrap`, `detailWarnings`, `resolveRefs`, `softWarnings`) contained nothing but
re-export lines, so their call sites now import from
`salvageunion-reference/rules` directly. The barrel
`apps/itun/src/lib/rules/index.ts` was deleted with them — it had no importers.
The remaining `apps/itun/src/lib/rules/*` modules are **not** shims: they either
re-export the pure math _and_ add app-layer code this ADR's split with
[ADR-007](ADR-007-automation-boundary.md) keeps out of the package (RNG bindings
such as `defaultRoll`, write-through patch builders typed against ITUN's Zod
`Mech`), or are full app-local Tier 3 implementations. Collapsing any of those
would violate the boundary.
