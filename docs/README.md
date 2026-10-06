# SURef Docs

An intent → doc map. Open the doc for what you are doing; `ls` is the full index.

## By intent

| I'm…                                                       | Read                                                                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| adding or changing a UI component                          | [design-system/ruleset.md](design-system/ruleset.md) (the laws), [architecture/display-system.md](architecture/display-system.md), [design-system/ladle-styleguide.md](design-system/ladle-styleguide.md) |
| moving styling off Tailwind                                | [design-system/tailwind-removal.md](design-system/tailwind-removal.md)                                                                                                |
| changing how data flows or persists                        | [architecture/data-flow.md](architecture/data-flow.md), ADR-030, ADR-034, ADR-035                                                                                      |
| deciding where a rule is enforced, or touching combat      | [architecture/rules-engine-boundary.md](architecture/rules-engine-boundary.md), [architecture/combat-loop.md](architecture/combat-loop.md), ADR-021, ADR-007          |
| working on the Dashboard                                   | [architecture/dashboard.md](architecture/dashboard.md), ADR-015                                                                                                        |
| sharing a sheet (public sheets; retired snapshot links)    | ADR-032, ADR-036                                                                                                                                                      |
| working on accounts, Games or the Convex backend           | ADR-030, [architecture/accounts-and-games.md](architecture/accounts-and-games.md) (ops reference)                                                                      |
| assigning pilots, mechs and crawlers to each other         | ADR-037, `apps/itun/src/lib/links/linkRules.ts`                                                                                                                        |
| working on the Discord bot as a Game client                | [architecture/discord-bot-game-client.md](architecture/discord-bot-game-client.md)                                                                                    |
| building the NPC Builder                                   | [architecture/npc-builder.md](architecture/npc-builder.md) (plan)                                                                                                      |
| changing a package's public API                            | [architecture/package-contracts.md](architecture/package-contracts.md)                                                                                                 |
| changing hosting, deploys or CI                            | ADR-033, [architecture/ci.md](architecture/ci.md)                                                                                                                      |
| adding, bumping or pinning a dependency                    | [architecture/dependency-management.md](architecture/dependency-management.md)                                                                                         |
| looking for a service id, deployment or dashboard URL      | [architecture/agent-tooling.md](architecture/agent-tooling.md)                                                                                                         |
| shipping SEO or accessibility work                         | [architecture/seo-accessibility.md](architecture/seo-accessibility.md)                                                                                                 |
| changing how `srd` is built                                | [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md), ADR-031                                                                                                          |
| checking how a Salvage Union rule works                    | `bun run rules:extract` (local only), then grep `rules/extracted/*.txt`                                                                                                |

## ADRs

37 ADRs in [`adrs/`](adrs/). Each one's own `## Status` block is authoritative.

| ADR                                                                  | Decision                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [ADR-001](adrs/ADR-001-local-first-no-backend.md)                    | Local-first, no backend — superseded by ADR-030                              |
| [ADR-002](adrs/ADR-002-indexeddb-idb-zod.md)                         | IndexedDB via `idb`, Zod as schema source (a cache since ADR-034)            |
| [ADR-003](adrs/ADR-003-zustand-hydration.md)                         | Zustand: lazy hydration, write-through, cross-tab invalidation               |
| [ADR-004](adrs/ADR-004-snapshot-netlify-functions.md)                | Snapshot sharing, unauthenticated — superseded by ADR-036                    |
| [ADR-005](adrs/ADR-005-reference-data-orm.md)                        | Game-data ORM with lazy loading                                              |
| [ADR-006](adrs/ADR-006-pure-rules-logic.md)                          | Rules logic as pure functions                                                |
| [ADR-007](adrs/ADR-007-automation-boundary.md)                       | **Governing** — the automation boundary                                      |
| [ADR-008](adrs/ADR-008-sequential-mutations.md)                      | Sequential client-side mutations                                             |
| [ADR-009](adrs/ADR-009-condition-model-destroyed-color.md)           | Item condition model + destroyed colour                                      |
| [ADR-010](adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)        | Choices: ephemeral in srd, persisted in ITUN                                 |
| [ADR-011](adrs/ADR-011-component-lib-source-no-build.md)             | `component-lib` ships source, no build                                       |
| [ADR-012](adrs/ADR-012-srd-astro-static.md)                          | `srd` on Astro — superseded by ADR-031                                       |
| [ADR-013](adrs/ADR-013-csp-zod-jitless.md)                           | CSP-safe jitless Zod                                                         |
| [ADR-014](adrs/ADR-014-json-api-public-interface-npm-retired.md)     | The JSON API is the dataset's public interface; partially superseded by ADR-025 |
| [ADR-015](adrs/ADR-015-dashboard-distinct-play-surface.md)           | The Dashboard is a distinct play surface, with its merged sub-decisions      |
| [ADR-016](adrs/ADR-016-dashboard-rotary-dial-instrument-split.md)    | Merged into ADR-015 (rotary dial)                                            |
| [ADR-017](adrs/ADR-017-dashboard-reuse-faithful-srd-display.md)      | Merged into ADR-015 (reuse the SRD display)                                  |
| [ADR-018](adrs/ADR-018-dashboard-instrument-viewfinder-aesthetic.md) | Merged into ADR-015 (flat and inset)                                         |
| [ADR-019](adrs/ADR-019-dashboard-play-state-ephemeral.md)            | Merged into ADR-015 (ephemeral play-state)                                   |
| [ADR-020](adrs/ADR-020-dashboard-fixed-canvas-scale-to-fit.md)       | Merged into ADR-015 (fixed scale-to-fit canvas)                              |
| [ADR-021](adrs/ADR-021-itun-surface-taxonomy.md)                     | **Governing** — surface/mode taxonomy: where a rule is enforced              |
| [ADR-022](adrs/ADR-022-provenance-log-and-overrides.md)              | Change Log provenance + stat overrides                                       |
| [ADR-023](adrs/ADR-023-drone-equipment-installed-loadout.md)         | Drone loadouts — superseded by ADR-027, then ADR-028                         |
| [ADR-024](adrs/ADR-024-derived-release-changelogs.md)                | Derived per-app release changelogs                                           |
| [ADR-025](adrs/ADR-025-reference-versioned-releases-surface-gate.md) | Versioned internal releases + the reference surface gate                     |
| [ADR-026](adrs/ADR-026-entity-card-design-rules.md)                  | Entity card design rules                                                     |
| [ADR-027](adrs/ADR-027-partners-owned-by-host.md)                    | Partners owned by host — superseded by ADR-028                               |
| [ADR-028](adrs/ADR-028-partners-render-in-place.md)                  | Partners render in place; carries ADR-027's model                            |
| [ADR-029](adrs/ADR-029-contribution-model-and-stat-provenance.md)    | One contribution model for caps, traits and damage + stat provenance         |
| [ADR-030](adrs/ADR-030-accounts-games-server-of-record.md)           | **Governing** — accounts, Games, ownership, Convex as server of record       |
| [ADR-031](adrs/ADR-031-srd-vite-ssg.md)                              | `srd` on an in-house Vite SSG                                                |
| [ADR-032](adrs/ADR-032-public-read-only-sheets.md)                   | Public read-only sheets — the one account-free way to share since ADR-036    |
| [ADR-033](adrs/ADR-033-cloudflare-hosting.md)                        | Hosting on Cloudflare Workers + R2                                           |
| [ADR-034](adrs/ADR-034-account-required-persistence.md)              | Persistence requires an account; IndexedDB is a cache                        |
| [ADR-035](adrs/ADR-035-no-isolated-local-only-data.md)               | No isolated local-only data; device rows migrate automatically               |
| [ADR-036](adrs/ADR-036-retire-snapshot-shares.md)                    | Snapshot shares retired; old links redirect to the public sheet if public    |
| [ADR-037](adrs/ADR-037-assignment-model.md)                          | Assignments (direct links, cardinality, one container) + the primary crawler |

## Per-package guidance

Each has a `CLAUDE.md` that loads when you work there:
[`apps/srd`](../apps/srd/CLAUDE.md), [`apps/itun`](../apps/itun/CLAUDE.md),
[`apps/discord-bot`](../apps/discord-bot/CLAUDE.md),
[`packages/salvageunion-reference`](../packages/salvageunion-reference/CLAUDE.md),
[`packages/component-lib`](../packages/component-lib/CLAUDE.md),
[`packages/observability`](../packages/observability/CLAUDE.md), and
[`tools/`](../tools/CLAUDE.md) (every checker `bun run check` runs).
`apps/su-assets` has none: it is one Worker serving licensed artwork from R2
(see its `wrangler.jsonc`). Path-scoped rules live in
[`.claude/rules/`](../.claude/rules/).
