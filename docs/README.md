# SURef Docs

An intent → doc map. Most areas are a section of [ARCHITECTURE.md](ARCHITECTURE.md),
which opens with its section index: `grep -n '^##' docs/ARCHITECTURE.md`, then
Read with an offset and limit, never the whole file.

## By intent

| I'm… | Read |
| --- | --- |
| adding or changing a UI component | [design-system/ruleset.md](design-system/ruleset.md) (the laws), [display system](ARCHITECTURE.md#display-system), [component catalog](ARCHITECTURE.md#component-catalog) |
| moving styling off Tailwind | [design-system/tailwind-removal.md](design-system/tailwind-removal.md) |
| changing how data flows or persists | [data flow](ARCHITECTURE.md#data-flow), ADR-030, ADR-034, ADR-035 |
| deciding where a rule is enforced, or touching combat | [rules and ITUN surfaces](ARCHITECTURE.md#rules-and-itun-surfaces), [combat loop](ARCHITECTURE.md#combat-loop), ADR-021, ADR-007 |
| working on the Dashboard | [architecture/dashboard.md](architecture/dashboard.md), ADR-038 (the one decision record) |
| sharing a sheet (public sheets; retired snapshot links) | ADR-032, ADR-036 |
| working on accounts, Games or the Convex backend | ADR-030, [accounts and Games operations](ARCHITECTURE.md#accounts-and-games-operations) |
| setting up a Convex deployment, repairing data, rotating auth secrets or Convex error reporting | the [`convex-ops`](../.claude/skills/convex-ops/SKILL.md) skill |
| inviting someone by their Discord account | ADR-039, `apps/itun/convex/model/invites.ts` |
| assigning pilots, mechs and crawlers to each other | ADR-037, `apps/itun/src/lib/links/linkRules.ts` |
| adding or assigning an NPC (the designer, crawler crew) | [architecture/npc-builder.md](architecture/npc-builder.md), ADR-043 |
| working on the Discord bot as a Game client | [Discord bot](ARCHITECTURE.md#discord-bot-as-a-game-client) |
| changing a package's public API | [packages and contracts](ARCHITECTURE.md#packages-and-contracts) |
| changing hosting, deploys or CI | ADR-033, [CI and deploy](ARCHITECTURE.md#ci-and-deploy) |
| moving a domain registration, or deleting what is left on Netlify | [ops/domain-transfer.md](ops/domain-transfer.md) (one-off runbook) |
| adding, bumping or pinning a dependency | [dependencies](ARCHITECTURE.md#dependencies) |
| looking for a service id, deployment or dashboard URL | [services and agent tooling](ARCHITECTURE.md#services-and-agent-tooling) |
| shipping SEO or accessibility work | [SEO and accessibility](ARCHITECTURE.md#seo-and-accessibility) |
| changing how `srd` is built | [`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md), ADR-031 |
| checking how a Salvage Union rule works | `bun run rules:extract` (local only), then grep `rules/extracted/*.txt` |

## ADRs

The [Decisions](ARCHITECTURE.md#decisions) that close ARCHITECTURE.md, one
`## ADR-NNN` each: `grep -n '^## ADR-' docs/ARCHITECTURE.md` lists them. Each
one's own Status block is authoritative.

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
