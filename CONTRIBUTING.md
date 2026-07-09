# Contributing to SURef

A Bun monorepo for **Salvage Union** tools: a static SRD reference site
(`apps/suref-web`), a local-first character builder (`apps/in-the-union-now`), a
Discord dice bot (`apps/discord-bot`), and two shared packages
(`packages/salvageunion-reference`, `packages/suref-react`).

## Prerequisites

- **[Bun](https://bun.com)** — pinned to the version in [`.bun-version`](.bun-version)
  (currently `1.3.14`). Install with `curl -fsSL https://bun.sh/install | bash`
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

- **pre-commit** — `biome check --write` + a narrow `prettier` fallback (Markdown/YAML only) on staged files (parallel).
- **pre-push** — `typecheck`, `test`, `validate:all`, `knip` (parallel).

Typecheck runs on **push**, not commit (a full fan-out across five workspaces is
too slow per commit). Lean on the TypeScript LSP in your editor between commits.

## Before you open a PR

Run the full local gate — it mirrors the CI merge gate:

```bash
bun run check:all
```

This runs, in order: schema-drift check (`build:package` + `git diff`), lint,
format check, typecheck, tests, data validation, knip, and `bun audit`. If
`check:all` is green, CI's `quality-checks` gate should be too. The app builds
(`build:web`, `build:itun`, `build:bot`) run only in CI/deploy; run them locally
if you touched build config.

### Common workspace-scoped commands

```bash
bun run dev            # build:package + suref-web dev server
bun run dev:itun       # build:package + ITUN dev server
bun run dev:bot        # build:package + Discord bot (local)

bun --filter suref-web test          # test one workspace
bun run typecheck:itun               # typecheck one workspace
```

> **Never run a bare `bun test` at the repo root** — it skips each workspace's
> `bunfig.toml` preloads (fake-indexeddb, happy-dom, reference preload) and fails
> by the hundreds. Always use `bun run test` or `bun --filter <pkg> test`.

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
