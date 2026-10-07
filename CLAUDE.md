# CLAUDE.md

Guidance for Claude Code in this repository. Instructions only — history lives in
the ADRs and architecture docs this file points to.

## Documentation Hub

Intent → doc map: [`docs/README.md`](docs/README.md) — open it when you need to find a doc.

- [`docs/adrs/`](docs/adrs/) — architecture decision records. **Read an ADR's `## Status` header first**: a superseded or merged ADR says so only there, and [`docs/README.md`](docs/README.md) tabulates them. The three that govern:
  - [ADR-030](docs/adrs/ADR-030-accounts-games-server-of-record.md) — accounts, Games, and Convex as the server of record. Ops reference: [`accounts-and-games.md`](docs/architecture/accounts-and-games.md).
  - [ADR-021](docs/adrs/ADR-021-itun-surface-taxonomy.md) — the surface/mode taxonomy for **where a rule is enforced**.
  - [ADR-007](docs/adrs/ADR-007-automation-boundary.md) — the automation boundary. Read before building rules-driven features.
- **Hosting:** Cloudflare Workers + R2 — see [ADR-033](docs/adrs/ADR-033-cloudflare-hosting.md).
- [`docs/architecture/`](docs/architecture/) — cross-cutting architecture (display system, data flow, package contracts, rules-engine boundary, combat loop, SEO/a11y).
- **Rules text:** `bun run rules:extract` (local only; the PDFs in `rules/` are gitignored), then grep `rules/extracted/*.txt`, which carries `<!-- page N -->` markers for citations. There is no curated rules digest.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Mention extra ideas as suggestions; do not implement them.
- When the user asks to 'plan' or 'prepare' something, the scope is the document/plan only — do not begin implementation unless explicitly asked.

## UI Development

- Reuse shared components (`ReferenceEntityCard`, `Card`, …) before building one-off UI; check `component-lib` first.
- Get CSS/layout right first time by reasoning about the rendering context (float does nothing inside grid/flex). Verify a visual change yourself: `.claude/launch.json` starts `srd` (4321), `itun` (5173) and `ladle` (61000) in the browser preview. Prefer simple, well-understood CSS.
- Default to compact, header-only, clickable listings for entity lists; never render nested entities as separate grids — render them inside the parent's expanded/modal view. Ask if unsure how much detail to show.
- Styling is migrating off Tailwind ([plan](docs/design-system/tailwind-removal.md)); `bun run check styling` fails a change that raises the count of files carrying a Tailwind utility (a heuristic scan: class-list contexts plus class strings in constants and maps — not proof of absence; the plan's P6 exit adds the built-CSS check) or adds a `.pc-*` class.

## Build & Validation

After any cross-package change, run typecheck, tests and lint before calling the task done, and check every consuming app (Tailwind `@source` paths, imports).

```bash
bun install              # first-time setup (generated files are committed; no compile step)

bun run dev              # srd dev server (ssg/dev.ts, same render path as prod)
bun run dev:itun         # ITUN dev server

bun run check:fast       # ~12s inner loop: every gate except the suite, the network
                         # and regeneration
bun run check            # THE full gate (~35s), every check in tools/check.ts in parallel,
                         # ending in a pass/fail table
bun run check <id> …     # just those checks (`--list` names them: data, styling, workflows, …)
bun run test             # full suite, each workspace with its own bunfig — what CI runs
bun --filter <workspace> test      # one workspace: salvageunion-reference, component-lib, srd, itun
bun run lint | format | typecheck  # Biome is the only formatter; .md/.yml are formatted by nothing

bun run build            # package + srd + ITUN (the bot has no build; wrangler bundles it)

bun run reap             # list abandoned .claude/worktrees/ checkouts (--force removes them)
bun run deploy-commands[:global]   # Discord slash commands: test guild / production
```

- **Prefer `bun run test` over bare `bun test`.** A bare root run preloads the union of the workspace preloads and has a handful of known cross-workspace failures (a `mock.module` collision between the two `observability` suites, and one preload-set difference); every one passes in its own workspace. If `bun run test` is red, something is broken.
- **Bare `--parallel` and `--isolate` stay banned**: both are measured regressions (ITUN `--parallel=4`, which implies `--isolate`, took 17.4 s against 16.9 s serial). `--parallel=N --no-isolate` is the measured win, and ITUN's `test` script uses it (16.5 s → ~6 s); `--changed` is the other flag that helps. Leave `test:coverage` serial: parallel coverage writes different lcov line counts.
- **A gate failed?** Its fix prints under the failure banner; `bun run check --list` shows every check's. [`tools/CLAUDE.md`](tools/CLAUDE.md) maps checks to scripts and baselines. **Adding a gate** means adding it to the registry in `tools/check.ts` — `bun run check`, pre-push and CI all read that one list.
- **Dependencies:** read [`dependency-management.md`](docs/architecture/dependency-management.md) before touching `package.json`, `bunfig.toml`, `renovate.json` or `overrides`. In short: Renovate owns updates and auto-merges non-majors; `bun audit --audit-level=high` gates every PR that changes `bun.lock` or a `package.json` (one `--ignore`: braces); `bunfig.toml` refuses versions under three days old (a caret range resolves silently down).
- **Profiling:** use Bun's markdown profiles into the gitignored `.profiles/` (`bun --cpu-prof --cpu-prof-md --cpu-prof-dir=.profiles <script>`, `--heap-prof-md` likewise). `bun build --metafile-md` needs `--outdir`, or it prints the bundle to stdout.

### Hooks (Lefthook)

- **Pre-commit:** `biome check --write` on staged files only (lint + safe fixes + format in one pass). No typecheck.
- **Pre-push (parallel):** `bun tools/check.ts --profile=pre-push` (every gate but the suite and the network ones) and `test`. Its `test` runs `bun test --changed=<merge-base>` for app-source-only pushes and `bun run test:coverage` (CI's gate: the full suite plus per-workspace coverage floors) whenever `packages/`, `test/`, `bunfig.toml`, root manifests or any `apps/*/package.json` moved, because `--changed` does not cross workspace boundaries. Don't "simplify" that away. CI always runs `test:coverage`.

## Repository Overview

Bun monorepo ("SURef") for Salvage Union (tabletop RPG) tools: a static reference site, a character builder, a Discord bot, and shared packages. The repo root is this directory.

**Workspace structure:**

- `apps/srd/` - Static SRD reference site: in-house SSG on Vite, React 19 islands. No auth, no backend. Read [`apps/srd/CLAUDE.md`](apps/srd/CLAUDE.md) first.
- `apps/itun/` - Character builder & game manager (React 19, TanStack Router, Zustand, Convex, Vite). Storage modes and the account gate: [`apps/itun/CLAUDE.md`](apps/itun/CLAUDE.md) — **read it before touching data.**
- `apps/discord-bot/` - Discord bot on a Cloudflare Worker (HTTP interactions, Components V2 replies); also an ITUN Game client.
- `apps/su-assets/` - Cloudflare Worker (`assets.salvageunion.io`) serving licensed entity artwork from the `su-lp-assets` R2 bucket, with `-440`/`-880` derivatives from Cloudflare Images. Image bytes never live in git; entity-card artwork in both apps depends on it (`ASSET_BASE_URL` in `packages/salvageunion-reference/lib/assets.ts`).
- `packages/component-lib/` - Shared React component library (Base UI primitives, entity display system, typography, tokens). No build step.
- `packages/observability/` - Sentry wiring: `/cloudflare` for the three Workers, `/browser` for the two browser apps' shared helper.
- `packages/salvageunion-reference/` - TypeScript ORM + schema-validated JSON dataset for game data. Ships TS source; `bun run build:package` only regenerates schemas and registries — commit the result (CI fails on drift).
- `tools/` - The repo's gates and scripts: [`tools/CLAUDE.md`](tools/CLAUDE.md).

**Dependency graph:**

```
salvageunion-reference (game data ORM)
  └── component-lib (shared UI components)
        ├── srd (static reference site)
        └── itun (character builder + game manager)
discord-bot (standalone, depends on salvageunion-reference)
```

Each workspace's own `CLAUDE.md` loads when you work in it; [`package-contracts.md`](docs/architecture/package-contracts.md) has the cross-package change checklist, and [`display-system.md`](docs/architecture/display-system.md) the two card shells (`ReferenceEntityCard` for every SRD entity, `Card` for everything else).

## Code Conventions

- Relative imports only, `type` over `interface`, no `any`, `import type`, named exports (routes and Worker entries excepted) — **all Biome rules**, so `bun run lint` is the authority ([`biome.jsonc`](biome.jsonc)).
- **Bun** for package management — never npm/yarn.
- Game-data types come from `salvageunion-reference` as `SURef*` (`SURefChassis`, `SURefSchemaName`, …).
- Generated files (`routeTree.gen.ts`, `schemas/*.schema.json`, `lib/generated/`) are never hand-edited.
- When a prop must reach nested entity cards, pass it explicitly (there is no shared display context; card size is the `size` × `extent` pair in `packages/component-lib/src/components/shared/displayMode.ts`) and typecheck immediately.

### Data conventions

- Entity links use slugs, never UUIDs: `/chassis/iron-mongrel`.
- Never run JSON data files through an automated formatter such as `json.dump` that reflows arrays; insert at the text level to preserve formatting.

### Debugging

For styling bugs, check the Tailwind/stylesheet wiring (`@source` paths, the `layer(su-base)` import) before component or data logic.

## `.claude/`

- **Rules** (`.claude/rules/`) load automatically by `paths:` when you touch matching files — testing, React components, the display system, the ITUN router and data access, the Discord bot, and workspace manifests. There is nothing to open by hand.
- **Skills** (`.claude/skills/`) encode decision procedures: `/stacked-pr` (recover a stacked PR after its parent squash-merges — never plain `--force`), `/triage`, `/component-refresh`, `/knip-triage` (delete by default), `/convex-deploy-verify`. There is no `/commit`; use `/ship` or the commit plugin.

## External Integrations & MCP Servers

The registry — ids, deployments, dashboards, how each server authenticates — is [`docs/architecture/agent-tooling.md`](docs/architecture/agent-tooling.md). [`.mcp.json`](.mcp.json) declares `cloudflare-bindings`, `cloudflare-observability`, `sentry`, `convex` (stdio, targets the **dev** deployment from `CONVEX_DEPLOYMENT`; run `bunx convex dev` once) and `context7` (version-pinned library docs — this repo runs ahead of training data: TypeScript 7, Vite 8, Tailwind 4.3, Convex 1.43).

- `.mcp.json` is **secret-free by design**: no auth headers, no tokens, no `${VAR}` placeholders. Authenticate each server locally (OAuth on first connect).
- `claude mcp list` is the only way to know a server works. GitHub has no declared server: use the `gh` CLI, or in a cloud session (no `gh`, remote MCP hosts blocked by the egress proxy, possibly a pre-pin Bun) the session's `mcp__github__*` tools — see "Cloud sessions" in `agent-tooling.md`.
- **Sentry fails silently.** No DSN means Vite tree-shakes the SDK out; a `connect-src` missing the ingest origin blocks every event. `tools/check-observability.ts` (the `observability` check) checks DSN gating, each app's CSP source against `SENTRY_INGEST_HOST`, and that each Worker wraps its export with `withObservability` and grants `nodejs_als`. **Change the CSP or Sentry region in every source for that app together.**

## Merging

`main` requires linear history and status checks; there is **no merge queue**. Merge with `gh pr merge <pr> --squash` (or `--auto --squash`). The squash body is the PR body (repo setting `PR_BODY`); `git log --format='%h %s%n%b'` is the decision record. Squash-merge plus `delete_branch_on_merge` is why stacked PRs need `/stacked-pr`.
