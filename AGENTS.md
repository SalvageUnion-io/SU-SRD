# AGENTS.md

Guidance for every coding agent here. Instructions only — history lives in the ADRs
and architecture docs linked below.

## Documentation Hub

Intent → doc map: [`docs/README.md`](docs/README.md): open it to find a doc.

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — numbered Areas, then Decisions (entry N is ADR-N, status first). Jump to the slug (`#convex`) or grep `ADR-NNN`; §-cited ADRs have full text in [`docs/adr/`](docs/adr/). The three ADRs that govern:
  - [ADR-030](docs/adr/030-accounts-games-server-of-record.md) — accounts, Games, Convex of record. Ops: [accounts](docs/ARCHITECTURE.md#deployments).
  - [ADR-021](docs/adr/021-cantina-surface-taxonomy.md) — surface/mode taxonomy: **where a rule is enforced**.
  - [ADR-007](docs/adr/007-automation-boundary.md) — automation boundary; read before rules work.
- **Hosting:** Cloudflare Workers + R2 — [ADR-033](docs/adr/033-hosting-on-cloudflare.md).
- **Rules text:** gitignored here; the private repo `SalvageUnion-io/su-rules` is the source of record. Locally, `bun run rules:extract`; in a cloud checkout, attach `su-rules` as a second repo (a sibling checkout the rules tools find). Then `bun run rules:find <term>` prints `Book p.N: …snippet…`, 2.0a books first.
- **Path rules:** read the [`.claude/rules/`](.claude/rules/) whose `paths:` match your files, and the workspace's `CLAUDE.md`.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Mention extra ideas as suggestions; do not implement them.
- When the user asks to 'plan' or 'prepare' something, the scope is the document/plan only — do not begin implementation unless explicitly asked.

## UI Development

- Reuse shared components (`ReferenceEntityCard`, `Card`, …) before building one-off UI; check `apps/web/src/ui` first.
- Get CSS/layout right first time by reasoning about the rendering context (float does nothing in grid/flex). Verify a visual change yourself: `bun run shot </route|cantina:/route> --width phone|column|page` prints PNGs to read. Prefer simple, well-understood CSS.
- Default to compact, header-only, clickable listings for entity lists; never render nested entities as separate grids — render them inside the parent's expanded/modal view. Ask if unsure how much detail to show.
- Styling is tokens, style objects and one stylesheet ([ADR-046](docs/ARCHITECTURE.md#decisions); rules: [`.claude/rules/styling.md`](.claude/rules/styling.md)). There is no utility framework: never write a utility class.

## Build & Validation

After any cross-package change, run typecheck, tests and lint before calling the task done, and check every consuming app (stylesheet imports, package `exports`).

```bash
bun install              # first-time setup; postinstall builds the reference schemas

bun run dev              # srd + the Cantina at /build, beside a local Convex backend

bun run check:fast       # the inner loop: every gate except the suite, the network
                         # and regeneration
bun run check            # THE full gate: every check in tools/check.ts in parallel,
                         # ending in a pass/fail table
bun run check <id> …     # just those checks (`--list` names them: data, styling, workflows, …)
bun run test             # full suite, each workspace with its own bunfig — what CI runs
bun --filter <workspace> test      # one workspace, by package name (web, tools, …)
bun run lint | format | typecheck  # Biome is the only formatter; .md/.yml are formatted by nothing

bun run build            # reference generation + srd + Cantina (the Worker-only apps build at deploy)

bun run deploy-commands[:global]   # Discord slash commands: test guild / production
```

- **A gate failed?** Its fix prints under the failure banner; `bun run check --list` shows every check's, with its command. **Adding a gate** means adding it to the registry in `tools/check.ts` — `bun run check`, pre-push and CI all read that one list.
- **Profiling:** `bun --cpu-prof --cpu-prof-md --cpu-prof-dir=.profiles <script>` into the gitignored `.profiles/`; `bun build --metafile-md` needs `--outdir`.

### Git hooks (Lefthook)

- **Pre-commit:** `biome check --write` on staged files only (lint + safe fixes + format in one pass). No typecheck.
- **Pre-push:** `bun tools/check.ts --profile=pre-push` (every gate but the suite and the network ones). No tests: CI's `test:coverage` runs the suite and its floors in about a minute; run the suites you touched before pushing. Raise a test's timeout only for a measured intrinsic cost, never for contention.

## Repository Overview

Bun monorepo ("SUSRD") for Salvage Union (tabletop RPG) tools: a static reference site, a character builder, a Discord bot, and shared packages.

Workspaces: [README.md](README.md)'s table; dependency graph: [packages](docs/ARCHITECTURE.md#packages).

- Licensed artwork bytes never live in git: `apps/su-assets/` serves them from R2 (`ASSET_BASE_URL` in `packages/salvageunion-reference/lib/assets.ts`).

"Build & Validation" above is the cross-package checklist, and [display system](docs/ARCHITECTURE.md#display) has the two card shells (`ReferenceEntityCard` for every SRD entity, `Card` for everything else).

## Code Conventions

- Relative imports only, `type` over `interface`, no `any`, `import type`, named exports (routes and Worker entries excepted) — **all Biome rules**, so `bun run lint` is the authority ([`biome.jsonc`](biome.jsonc)).
- **Bun** for package management — never npm/yarn.
- Game-data types come from `salvageunion-reference` as `Ref*` (`RefChassis`, `RefSchemaName`, …).
- Generated files (`routeTree.gen.ts`, `schemas/*.schema.json`, `lib/generated/`) are never hand-edited.
- When a prop must reach nested entity cards, pass it explicitly (there is no shared display context; card size is the `size` × `extent` pair in `apps/web/src/ui/components/containers/displayMode.ts`) and typecheck immediately.

### Data conventions

- Entity links use slugs, never UUIDs: `/chassis/mule/`.
- Never run JSON data files through an automated formatter such as `json.dump` that reflows arrays; insert at the text level to preserve formatting.

### Debugging

For styling bugs, check the stylesheet wiring (`entry.css`'s `layer(su-reset)` / `layer(su-base)` imports, the app's import of it) before component or data logic.

## Merging

`main` requires linear history and status checks; **no merge queue**. Squash-merge: locally `gh pr merge <pr> --squash`; in cloud, see [cloud sessions](docs/ARCHITECTURE.md#cloud). The squash body is the PR body (`PR_BODY`); `git log` is the decision record.

**Releasing:** each PR into `main` bumps the root `package.json` version (CI-enforced); merging releases it (`tools/release.ts`).

Dependent PRs land only as a `gh stack`, local-only: `submit --auto --open`, then `merge --squash`; after a merge beneath you, `gh stack sync`. Never a hand rebase or `--force`. Stack state is per worktree (`gh stack checkout <pr>`).
