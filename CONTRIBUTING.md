# Contributing to SURef

A Bun monorepo for **Salvage Union** tools: a static SRD reference site
(`apps/srd`), a local-first character builder (`apps/itun`), a
Discord dice bot (`apps/discord-bot`), and two shared packages
(`packages/salvageunion-reference`, `packages/component-lib`).

## Prerequisites

- **[Bun](https://bun.com)** — pinned to the version in [`.bun-version`](.bun-version)
  (currently `1.4.0`). Install with `curl -fsSL https://bun.sh/install | bash`
  or `brew install oven-sh/bun/bun`, then `bun upgrade --to <version>` if needed.
  CI enforces this pin via `bun tools/check-bun-version.ts` (part of `validate:all`).
- Node is **not** required for the apps — Bun runs everything.

## First-time setup

```bash
bun install          # installs all workspaces + git hooks (see below)
bun run build:package # regenerates packages/salvageunion-reference/schemas/*.schema.json
```

`bun install` runs the `prepare` script, which installs the [Lefthook](https://lefthook.dev)
git hooks. `lefthook` is a hard dev dependency, so a fresh clone always gets the
hooks — if `bun install` succeeds, your hooks are installed.

## Git hooks (Lefthook)

- **pre-commit** — `biome check --write` on staged files (parallel). Biome is the only formatter; Markdown and YAML are not formatted by tooling (Biome cannot parse them yet), so keep those tidy by hand.
- **pre-push** — `typecheck`, `test`, `validate:all`, `knip` (parallel).

Typecheck runs on **push**, not commit (a full fan-out across five workspaces is
too slow per commit). Lean on the TypeScript LSP in your editor between commits.

## Before you open a PR

Run the full local gate — it mirrors the CI merge gate:

```bash
bun run check
```

This runs, in order: schema-drift check (`build:package` + `git diff`), lint,
format check, typecheck, tests, data validation, knip, and `bun audit`. If
`check` is green, CI's `CI Success` gate should be too. `check:all` is a
deprecated alias for the same script, kept for one release cycle so existing
muscle memory and scripts keep working — new callers use `check`. The app builds
(`build:web`, `build:itun`) run only in CI/deploy; run them locally
if you touched build config.

### Common workspace-scoped commands

```bash
bun run dev            # build:package + srd dev server
bun run dev:itun       # build:package + ITUN dev server

bun --filter srd test          # test one workspace
bun run typecheck:itun               # typecheck one workspace
```

> **Prefer `bun run test` or `bun --filter <pkg> test`.** A bare `bun test` at
> the repo root used to fail by the hundreds because it skipped each workspace's
> `bunfig.toml` preloads; the root `bunfig.toml` now preloads the union of them,
> so it runs. It is still not identical to the per-workspace run — the preload
> *sets* differ, and one component-lib SSR test fails only from the root. Use
> `bun run test` as the source of truth; it is what CI runs.

## Conventions

- **Bun** for all package management (never npm/yarn).
- **Relative imports** only — never `@/` path aliases.
- **`type`** over `interface`; avoid `any` (use `unknown`).
- **Named exports** everywhere except TanStack Router route components.
- **Conventional commits** with a scope: `feat(itun):`, `fix(bot):`, `ci:`,
  `data(actions):`, etc. — match the existing `git log`.
- Do **not** hand-edit generated files: `packages/salvageunion-reference/schemas/*.schema.json`
  (regenerate via `bun run build:package`) or `routeTree.gen.ts`.

## Data changes

The game dataset lives in `packages/salvageunion-reference/data/*.json`, validated
by Zod schemas in `lib/schemas/`. After editing data or schemas:

```bash
bun run build:package   # regenerate JSON schemas from Zod
bun run validate:all    # unique IDs, cross-references, action references
```

Never reformat JSON data files with automated formatters (`json.dump` etc.) —
use text-level edits to preserve the original array formatting.
