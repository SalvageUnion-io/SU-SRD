# SURef Monorepo

A Bun monorepo of tools for **Salvage Union** (tabletop RPG): a static SRD
reference site, a local-first character builder & game manager, a Discord dice
bot, and two shared packages.

> **Detailed documentation lives in [docs/README.md](docs/README.md)** — it maps
> intent → the right doc (architecture, ADRs, per-package guides). Agent/build
> guidance is in [CLAUDE.md](CLAUDE.md).

## Quick Start

```bash
# Install all workspace dependencies
bun install

# Regenerate the reference package's committed artifacts (JSON Schemas, the
# registry codegen and the schema catalog). NOT required before
# the apps can resolve types — the package ships TypeScript source.
bun run build:package

# Start the reference site dev server (builds package, then serves srd)
bun run dev
```

Other dev server: `bun run dev:itun` (character builder). The Discord bot has
none — Discord only reaches the deployed Worker — so its loop is
`bun --filter discord-bot test`.

## Structure

```
.
├── apps/
│   ├── srd/                    # Static SRD reference site (in-house SSG in srd/ssg + React islands)
│   ├── itun/                   # Character builder & game manager (React 19)
│   ├── discord-bot/            # Discord bot (HTTP interactions on a Worker) for rolling on SU tables
│   └── su-assets/              # Cloudflare Worker serving entity artwork from R2
├── packages/
│   ├── salvageunion-reference/ # Game-data ORM + schema-validated JSON dataset
│   ├── component-lib/          # Shared React component library
│   └── observability/          # Sentry wiring shared by the Node surfaces
├── tools/                      # Repo gates and scripts (a workspace)
├── docs/                       # Architecture docs + ADRs (see docs/README.md)
├── package.json                # Root workspace configuration
├── biome.jsonc                 # Shared Biome (lint + format) config
└── tsconfig.json               # Shared TypeScript base config
```

**Dependency graph:** `salvageunion-reference → component-lib → {srd, itun}`;
`discord-bot` depends on the reference package directly. **No package has a
build step** — both ship TypeScript source, which the consuming apps' bundlers
compile. `bun run build:package` regenerates committed artifacts (JSON Schemas,
registry codegen, the schema catalog) and CI fails on drift; it
is not a prerequisite for typechecking or running anything.

## Common Commands

```bash
# Development
bun run dev          # Reference site (srd)
bun run dev:itun     # Character builder (itun)

# Build
bun run build            # Everything (package + all apps)
bun run build:package    # Reference package only

# Quality (run across all workspaces)
bun run lint
bun run format        # bun run format:check to verify only
bun run typecheck
bun run test          # prefer this — each workspace with its own bunfig.
                      # A bare root `bun test` is viable (the root bunfig
                      # preloads the union) but is not identical; see CLAUDE.md
bun run check         # THE full-check entry point: every gate in tools/check.ts
                      # (lint, format, typecheck, test, data, knip, audit, …)
                      # in parallel, ending in a pass/fail table.
bun run check data    # any subset by id — `bun run check --list` names them
```

The root scripts are the aggregates only — there are deliberately no
per-workspace `lint:*` / `test:*` / `typecheck:*` aliases. To scope any of them
to one workspace, call it directly: `bun --filter srd build`,
`bun --filter itun typecheck`, `bun --filter salvageunion-reference test`.

### Local-only diagnostics

These read the copyright-bearing rulebook PDFs in `rules/`, which are gitignored
and therefore unavailable to CI. They are advisory: read the findings, do not
apply them blind.

```bash
bun run rules:extract        # PDF → rules/extracted/ text layer, then grep it
bun run check:printed-names  # diff every entity name + page against the Core
                             # Book index; run after a data import or a bulk
                             # name/page edit, not on a schedule
```

With no extract present `check:printed-names` prints a notice and exits 0.
Deviations it has already been told about live in
`packages/salvageunion-reference/lib/printedNameDeviations.ts`, which is shared
with the test that enforces them.

## Making Changes to salvageunion-reference

1. Edit Zod schemas in `packages/salvageunion-reference/lib/schemas/` or data
   files in `data/`.
2. Regenerate: `bun run build:package`. It **does not compile TypeScript** —
   there is no compile step, as this file says above. It rewrites the committed
   generated artifacts from the Zod sources: `schemas/*.schema.json`, the docs,
   and `lib/generated/`. CI fails on drift.
3. Changes are immediately available to consuming apps via workspace linking.

Those generated artifacts are listed in `tools/check-generated.ts` — never edit
them by hand. (There is no `dist/` in any workspace; this line used to claim one
and contradicted the "no build step" paragraph two sections above.)

## Deployment

- **srd**, **itun**, **su-assets** and **discord-bot** → Cloudflare Workers
  (config in each app's `wrangler.jsonc`), deployed from
  `.github/workflows/deploy-cloudflare.yml`. ITUN's Worker also keeps the one
  read left of the retired snapshot shares, so old `/s/:id` links can redirect
  to a public sheet — see [ADR-036](docs/ARCHITECTURE.md#adr-036).
- Storage is **R2**: `su-itun-snapshots` for the retired snapshot shares
  (read-only), `su-lp-assets` for licensed artwork. See
  [ADR-033](docs/ARCHITECTURE.md#adr-033).

## Monorepo Conventions

Built on **[the Butter Stack](https://alxjrvs.github.io/butter/)** — Bun · Unified workspace · TypeScript · TanStack · Edge-deployed · React.

- **Bun** for all package management (not npm/yarn); single `bun.lock` at root.
- Workspace packages reference each other via the `workspace:*` protocol.
- Code conventions (relative imports, `type` over `interface`, named exports,
  no `any`) are Biome rules — see [`biome.jsonc`](biome.jsonc); `bun run lint`
  is the authority.
- Pre-commit (Lefthook): `biome check --write` on staged files. Pre-push:
  `bun tools/check.ts --profile=pre-push` and the test suite.
