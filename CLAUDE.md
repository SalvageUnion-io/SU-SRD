# CLAUDE.md

Guidance for Claude Code in this repository. Instructions only — history lives in
the ADRs and architecture docs this file points to.

## Documentation Hub

Intent → doc map: [`docs/README.md`](docs/README.md) — open it when you need to find a doc.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the architecture as terse numbered entries (Areas, then Decisions: entry N is ADR-N, status first). Read it whole; §-cited ADRs keep full text in [`docs/adr/`](docs/adr/). The three ADRs that govern:
  - [ADR-030](docs/adr/030-accounts-games-server-of-record.md) — accounts, Games, Convex of record. Ops: [accounts](docs/ARCHITECTURE.md#areas).
  - [ADR-021](docs/adr/021-itun-surface-taxonomy.md) — surface/mode taxonomy: **where a rule is enforced**.
  - [ADR-007](docs/adr/007-automation-boundary.md) — automation boundary; read before rules work.
- **Hosting:** Cloudflare Workers + R2 — [ADR-033](docs/adr/033-hosting-on-cloudflare.md).
- **Rules text:** gitignored here; the private repo `SalvageUnion-io/su-rules` is the source of record. Locally, `bun run rules:extract`, then grep `rules/extracted/*.txt`; in a cloud session or Routine, attach `su-rules` as a second repo and grep its committed `extracted/*.txt` (sibling checkout, no poppler; the rules checks find it there). Both carry `<!-- page N -->` markers for citations. There is no curated rules digest.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Mention extra ideas as suggestions; do not implement them.
- When the user asks to 'plan' or 'prepare' something, the scope is the document/plan only — do not begin implementation unless explicitly asked.

## UI Development

- Reuse shared components (`ReferenceEntityCard`, `Card`, …) before building one-off UI; check `component-lib` first.
- Get CSS/layout right first time by reasoning about the rendering context (float does nothing inside grid/flex). Verify a visual change yourself: `bun run shot <story-id|/route> --width phone|column|page [--dark]` prints PNGs to Read (ITUN: its stories). Prefer simple, well-understood CSS.
- Default to compact, header-only, clickable listings for entity lists; never render nested entities as separate grids — render them inside the parent's expanded/modal view. Ask if unsure how much detail to show.
- Styling is tokens, style objects and one stylesheet ([ADR-046](docs/ARCHITECTURE.md#decisions); rules: [`.claude/rules/styling.md`](.claude/rules/styling.md)). There is no utility framework: never write a utility class.

## Build & Validation

After any cross-package change, run typecheck, tests and lint before calling the task done, and check every consuming app (stylesheet imports, package `exports`).

```bash
bun install              # first-time setup; postinstall builds the reference schemas

bun run dev              # srd dev server (ssg/dev.ts, same render path as prod)
bun run dev:itun         # ITUN dev server on a local Convex backend

bun run check:fast       # the inner loop: every gate except the suite, the network
                         # and regeneration
bun run check            # THE full gate: every check in tools/check.ts in parallel,
                         # ending in a pass/fail table
bun run check <id> …     # just those checks (`--list` names them: data, styling, workflows, …)
bun run test             # full suite, each workspace with its own bunfig — what CI runs
bun --filter <workspace> test      # one workspace: salvageunion-reference, component-lib, srd, itun
bun run lint | format | typecheck  # Biome is the only formatter; .md/.yml are formatted by nothing

bun run build            # package + srd + ITUN (the bot has no build; wrangler bundles it)

bun run deploy-commands[:global]   # Discord slash commands: test guild / production
```

- **A gate failed?** Its fix prints under the failure banner; `bun run check --list` shows every check's. [`tools/CLAUDE.md`](tools/CLAUDE.md) maps checks to scripts and baselines. **Adding a gate** means adding it to the registry in `tools/check.ts` — `bun run check`, pre-push and CI all read that one list.
- **Profiling:** use Bun's markdown profiles into the gitignored `.profiles/` (`bun --cpu-prof --cpu-prof-md --cpu-prof-dir=.profiles <script>`, `--heap-prof-md` likewise). `bun build --metafile-md` needs `--outdir`, or it prints the bundle to stdout.

### Hooks (Lefthook)

- **Pre-commit:** `biome check --write` on staged files only (lint + safe fixes + format in one pass). No typecheck.
- **Pre-push (in order):** `bun tools/check.ts --profile=pre-push` (every gate but the suite and the network ones), then `bun tools/pre-push-test.ts`: a plain run of the workspaces changed since the merge-base with `origin/main`, their dependents by `workspace:` edges (`--changed` stops at a workspace boundary) and `tools`. No coverage: floors are CI's `test:coverage` alone. Raise a test's timeout only for a measured intrinsic cost, never for contention.

## Repository Overview

Bun monorepo ("SURef") for Salvage Union (tabletop RPG) tools: a static reference site, a character builder, a Discord bot, and shared packages. The repo root is this directory.

**Workspace structure:**

- `apps/srd/` - Static SRD reference site: in-house SSG on Vite, React 19 islands. No auth, no backend. Read [`apps/srd/CLAUDE.md`](apps/srd/CLAUDE.md) first.
- `apps/itun/` - Character builder & game manager (React 19, TanStack Router, Zustand, Convex, Vite). Read [`apps/itun/CLAUDE.md`](apps/itun/CLAUDE.md); storage modes and the account gate are [`.claude/rules/itun-data-access.md`](.claude/rules/itun-data-access.md) — **read it before touching data.**
- `apps/catalog/` - Dev-only story catalog: `bun run stories`.
- `apps/discord-bot/` - Discord bot on a Cloudflare Worker (HTTP interactions, Components V2 replies); also an ITUN Game client.
- `apps/su-assets/` - Worker (`assets.salvageunion.io`) serving licensed artwork from R2 `su-lp-assets`, `-440`/`-880` via Cloudflare Images. Image bytes never live in git; both apps' artwork depends on it (`ASSET_BASE_URL` in `packages/salvageunion-reference/lib/assets.ts`).
- `packages/component-lib/` - Shared React components (Base UI primitives, entity display system, typography, tokens). No build step.
- `packages/gates/` - The gates' library, imported by `tools/` and the apps' e2e.
- `packages/itun-domain/` - schemas and rules shared by ITUN, Convex and the bot.
- `packages/observability/` - Sentry wiring: `/cloudflare` for Workers, `/browser` for both apps.
- `packages/salvageunion-reference/` - TypeScript ORM + schema-validated JSON game data. Ships TS source; `schemas/` and `lib/generated/` are gitignored, generated on install, typecheck, build and test.
- `tools/` - The gates' CLI entry points and baselines: [`tools/CLAUDE.md`](tools/CLAUDE.md).

**Dependency graph:**

```
salvageunion-reference (game data ORM)
  └── component-lib (shared UI components)
        ├── srd (static reference site)
        └── itun (character builder + game manager)
discord-bot (salvageunion-reference + itun-domain types)
```

Each workspace's own `CLAUDE.md` loads when you work in it; "Build & Validation" above is the cross-package checklist, and [display system](docs/ARCHITECTURE.md#areas) has the two card shells (`ReferenceEntityCard` for every SRD entity, `Card` for everything else).

## Code Conventions

- Relative imports only, `type` over `interface`, no `any`, `import type`, named exports (routes and Worker entries excepted) — **all Biome rules**, so `bun run lint` is the authority ([`biome.jsonc`](biome.jsonc)).
- **Bun** for package management — never npm/yarn.
- Game-data types come from `salvageunion-reference` as `SURef*` (`SURefChassis`, `SURefSchemaName`, …).
- Generated files (`routeTree.gen.ts`, `schemas/*.schema.json`, `lib/generated/`) are never hand-edited.
- When a prop must reach nested entity cards, pass it explicitly (there is no shared display context; card size is the `size` × `extent` pair in `packages/component-lib/src/components/shared/displayMode.ts`) and typecheck immediately.

### Data conventions

- Entity links use slugs, never UUIDs: `/schema/chassis/item/mule/`.
- Never run JSON data files through an automated formatter such as `json.dump` that reflows arrays; insert at the text level to preserve formatting.

### Debugging

For styling bugs, check the stylesheet wiring (`entry.css`'s `layer(su-reset)` / `layer(su-base)` imports, the app's import of it) before component or data logic.

## `.claude/`

- **Rules** (`.claude/rules/`) load automatically by `paths:` when you touch matching files. There is nothing to open by hand.
- **Skills** (`.claude/skills/`): `/convex-ops` (Convex setup, probes, rotations, repairs), `/open-pr` (PR title, body, cloud route, stacks).
- **Agents** (`.claude/agents/`): `rules-lookup`, `design-reviewer`, `gate-fixer`.

## External Integrations & MCP Servers

The registry — ids, deployments, dashboards, how each server authenticates — is [services](docs/ARCHITECTURE.md#areas). [`.mcp.json`](.mcp.json) declares `cloudflare-bindings`, `cloudflare-observability`, `sentry`, `convex` (stdio, targets the **local** deployment `bun run dev:itun` runs, from `CONVEX_DEPLOYMENT` in `apps/itun/.env.local`) and `context7` (version-pinned library docs — this repo runs ahead of training data; versions: the manifests).

- `.mcp.json` is **secret-free by design**: no auth headers, no tokens, no `${VAR}` placeholders. Only `context7` and `convex` are enabled; opt into the rest [locally](docs/ARCHITECTURE.md#areas).
- `claude mcp list` is the only way to know a server works. GitHub has no declared server: use the `gh` CLI. In a cloud session `gh` is preinstalled and authenticated by the GitHub proxy, but only REST answers (`gh api`); GraphQL subcommands such as `gh pr` and `gh issue` get 403, so use `gh api` or the session's `mcp__github__*` tools — see [cloud sessions](docs/ARCHITECTURE.md#areas).
- **Sentry fails silently**: no DSN tree-shakes the SDK out, and a `connect-src` missing the ingest origin blocks every event. The rules are [`packages/observability/CLAUDE.md`](packages/observability/CLAUDE.md)'s, gated by the `observability` check; **change the CSP or Sentry region in every source for that app together.**

## Merging

`main` requires linear history and status checks; **no merge queue**. Squash-merge: locally `gh pr merge <pr> --squash` (`--auto` too); in cloud, see [cloud sessions](docs/ARCHITECTURE.md#areas). The squash body is the PR body (`PR_BODY`); `git log --format='%h %s%n%b'` is the decision record.

Dependent PRs land only as a `gh stack`, local-only: `submit --auto --open`, then `merge --squash`; after a merge beneath you, `gh stack sync`. Never a hand rebase or `--force`. Stack state is per worktree (`gh stack checkout <pr>`).
