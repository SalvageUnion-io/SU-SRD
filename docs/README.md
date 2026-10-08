# SURef Docs

An intent → doc map. Most areas are a section of [ARCHITECTURE.md](ARCHITECTURE.md),
which opens with its section index: `grep -n '^##' docs/ARCHITECTURE.md`, then
Read with an offset and limit, never the whole file.

## By intent

| I'm… | Read |
| --- | --- |
| adding or changing a UI component | [design-system/ruleset.md](design-system/ruleset.md) (the laws), [display system](ARCHITECTURE.md#display-system), [component catalog](ARCHITECTURE.md#component-catalog-ladle) |
| moving styling off Tailwind | [design-system/tailwind-removal.md](design-system/tailwind-removal.md) |
| changing how data flows or persists | [data flow](ARCHITECTURE.md#data-flow), ADR-030, ADR-034, ADR-035 |
| deciding where a rule is enforced, or touching combat | [rules and ITUN surfaces](ARCHITECTURE.md#rules-and-itun-surfaces), [combat loop](ARCHITECTURE.md#combat-loop), ADR-021, ADR-007 |
| working on the Dashboard | [architecture/dashboard.md](architecture/dashboard.md), ADR-015, ADR-038, [architecture/dashboard-redesign.md](architecture/dashboard-redesign.md) (the done plan: decisions D1–D12) |
| sharing a sheet (public sheets; retired snapshot links) | ADR-032, ADR-036 |
| working on accounts, Games or the Convex backend | ADR-030, [accounts and Games operations](ARCHITECTURE.md#accounts-and-games-operations) |
| repairing data, rotating auth secrets or Convex error reporting | the [`convex-maintenance`](../.claude/skills/convex-maintenance/SKILL.md) skill |
| inviting someone by their Discord account | ADR-039, `apps/itun/convex/model/invites.ts` |
| assigning pilots, mechs and crawlers to each other | ADR-037, `apps/itun/src/lib/links/linkRules.ts` |
| working on the Discord bot as a Game client | [Discord bot](ARCHITECTURE.md#discord-bot-as-a-game-client) |
| building the NPC Builder | [architecture/npc-builder.md](architecture/npc-builder.md) (plan) |
| changing a package's public API | [packages and contracts](ARCHITECTURE.md#packages-and-contracts) |
| changing hosting, deploys or CI | ADR-033, [CI and deploy](ARCHITECTURE.md#ci-and-deploy) |
| adding, bumping or pinning a dependency | [dependencies](ARCHITECTURE.md#dependencies) |
| looking for a service id, deployment or dashboard URL | [services and agent tooling](ARCHITECTURE.md#services-and-agent-tooling) |
| shipping SEO or accessibility work | [SEO and accessibility](ARCHITECTURE.md#seo-and-accessibility) |
| changing how `srd` is built | [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md), ADR-031 |
| checking how a Salvage Union rule works | `bun run rules:extract` (local only), then grep `rules/extracted/*.txt` |

## ADRs

39 ADRs, the [Decisions](ARCHITECTURE.md#decisions) that close ARCHITECTURE.md,
one `## ADR-NNN` each. Each one's own Status block is authoritative.

| ADR                                                                  | Decision                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [ADR-001](ARCHITECTURE.md#adr-001)                    | Local-first, no backend — superseded by ADR-030                              |
| [ADR-002](ARCHITECTURE.md#adr-002)                         | IndexedDB via `idb`, Zod as schema source (a cache since ADR-034)            |
| [ADR-003](ARCHITECTURE.md#adr-003)                         | Zustand: lazy hydration, write-through (cross-tab via Convex since #1153)    |
| [ADR-004](ARCHITECTURE.md#adr-004)                | Snapshot sharing, unauthenticated — superseded by ADR-036                    |
| [ADR-005](ARCHITECTURE.md#adr-005)                        | Game-data ORM with lazy loading                                              |
| [ADR-006](ARCHITECTURE.md#adr-006)                          | Rules logic as pure functions                                                |
| [ADR-007](ARCHITECTURE.md#adr-007)                       | **Governing** — the automation boundary                                      |
| [ADR-008](ARCHITECTURE.md#adr-008)                      | Sequential client-side mutations                                             |
| [ADR-009](ARCHITECTURE.md#adr-009)           | Item condition model + destroyed colour                                      |
| [ADR-010](ARCHITECTURE.md#adr-010)        | Choices: ephemeral in srd, persisted in ITUN                                 |
| [ADR-011](ARCHITECTURE.md#adr-011)             | `component-lib` ships source, no build                                       |
| [ADR-012](ARCHITECTURE.md#adr-012)                          | `srd` on Astro — superseded by ADR-031                                       |
| [ADR-013](ARCHITECTURE.md#adr-013)                           | CSP-safe jitless Zod                                                         |
| [ADR-014](ARCHITECTURE.md#adr-014)     | The JSON API is the dataset's public interface; partially superseded by ADR-025 |
| [ADR-015](ARCHITECTURE.md#adr-015)           | The Dashboard is a distinct play surface, with its merged sub-decisions; amended by ADR-038 |
| [ADR-016](ARCHITECTURE.md#adr-016)    | Merged into ADR-015 (rotary dial); replaced by ADR-038                       |
| [ADR-017](ARCHITECTURE.md#adr-017)      | Merged into ADR-015 (reuse the SRD display)                                  |
| [ADR-018](ARCHITECTURE.md#adr-018) | Merged into ADR-015 (flat and inset)                                         |
| [ADR-019](ARCHITECTURE.md#adr-019)            | Merged into ADR-015 (ephemeral play-state); reversed by ADR-038              |
| [ADR-020](ARCHITECTURE.md#adr-020)       | Merged into ADR-015 (fixed scale-to-fit canvas)                              |
| [ADR-021](ARCHITECTURE.md#adr-021)                     | **Governing** — surface/mode taxonomy: where a rule is enforced              |
| [ADR-022](ARCHITECTURE.md#adr-022)              | Change Log provenance + stat overrides                                       |
| [ADR-023](ARCHITECTURE.md#adr-023)         | Drone loadouts — superseded by ADR-027, then ADR-028                         |
| [ADR-024](ARCHITECTURE.md#adr-024)                | Derived per-app release changelogs                                           |
| [ADR-025](ARCHITECTURE.md#adr-025) | Versioned internal releases + the reference surface gate                     |
| [ADR-026](ARCHITECTURE.md#adr-026)                  | Entity card design rules                                                     |
| [ADR-027](ARCHITECTURE.md#adr-027)                    | Partners owned by host — superseded by ADR-028                               |
| [ADR-028](ARCHITECTURE.md#adr-028)                  | Partners render in place; carries ADR-027's model                            |
| [ADR-029](ARCHITECTURE.md#adr-029)    | One contribution model for caps, traits and damage + stat provenance         |
| [ADR-030](ARCHITECTURE.md#adr-030)           | **Governing** — accounts, Games, ownership, Convex as server of record       |
| [ADR-031](ARCHITECTURE.md#adr-031)                              | `srd` on an in-house Vite SSG                                                |
| [ADR-032](ARCHITECTURE.md#adr-032)                   | Public read-only sheets — the one account-free way to share since ADR-036    |
| [ADR-033](ARCHITECTURE.md#adr-033)                        | Hosting on Cloudflare Workers + R2                                           |
| [ADR-034](ARCHITECTURE.md#adr-034)              | Persistence requires an account; IndexedDB is a cache                        |
| [ADR-035](ARCHITECTURE.md#adr-035)               | No isolated local-only data; device rows migrate automatically               |
| [ADR-036](ARCHITECTURE.md#adr-036)                    | Snapshot shares retired; old links redirect to the public sheet if public    |
| [ADR-037](ARCHITECTURE.md#adr-037)                          | Assignments (direct links, cardinality, one container) + the primary crawler |
| [ADR-038](ARCHITECTURE.md#adr-038) | The Dashboard is Game-only, with play state as a seat saved on the Game      |
| [ADR-039](ARCHITECTURE.md#adr-039)                          | Addressed invites — by Discord account, verified by Discord’s signature      |

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
