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
# registry codegen, the schema catalog and the API report). NOT required before
# the apps can resolve types — the package ships TypeScript source.
bun run build:package

# Start the reference site dev server (builds package, then serves srd)
bun run dev
```

Other dev servers: `bun run dev:itun` (character builder), or `bunx wrangler dev`
in `apps/discord-bot` (the Discord bot's Worker).

## Structure

```
.
├── apps/
│   ├── srd/                    # Static SRD reference site (in-house SSG in srd/ssg + React islands)
│   ├── itun/                   # Character builder & game manager (React 19)
│   ├── discord-bot/            # Discord.js bot for rolling on SU tables
│   └── su-assets/              # Cloudflare Worker serving entity artwork from R2
├── packages/
│   ├── salvageunion-reference/ # Game-data ORM + schema-validated JSON dataset
│   ├── component-lib/          # Shared React component library
│   └── observability/          # Sentry wiring shared by the Node surfaces
├── docs/                       # Architecture docs + ADRs (see docs/README.md)
├── package.json                # Root workspace configuration
├── biome.jsonc                 # Shared Biome (lint + format) config
└── tsconfig.json               # Shared TypeScript base config
```

**Dependency graph:** `salvageunion-reference → component-lib → {srd, itun}`;
`discord-bot` depends on the reference package directly. **No package has a
build step** — both ship TypeScript source, which the consuming apps' bundlers
compile. `bun run build:package` regenerates committed artifacts (JSON Schemas,
registry codegen, the schema catalog, the API report) and CI fails on drift; it
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
bun run validate:all  # Data integrity: IDs, cross-refs, action refs
bun run check         # THE full-check entry point: the whole CI suite (lint,
                      # format, typecheck, test, validate, knip, audit, …).
                      # `check:all` is a deprecated alias for it.
```

The root scripts are the aggregates only — there are deliberately no
per-workspace `lint:*` / `test:*` / `typecheck:*` aliases. To scope any of them
to one workspace, call it directly: `bun --filter srd build`,
`bun --filter component-lib lint`, `bun --filter salvageunion-reference test`.

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
   `lib/generated/`, and the API report. CI fails on drift.
3. Changes are immediately available to consuming apps via workspace linking.

Those generated artifacts are listed in `bun run check:schemas` — never edit
them by hand. (There is no `dist/` in any workspace; this line used to claim one
and contradicted the "no build step" paragraph two sections above.)

## Deployment

- **srd**, **itun**, **su-assets** and **discord-bot** → Cloudflare Workers
  (config in each app's `wrangler.jsonc`), deployed from
  `.github/workflows/deploy-cloudflare.yml`. ITUN also serves the
  snapshot-sharing backend as part of its Worker
  the same Worker — see [ADR-004](docs/adrs/ADR-004-snapshot-netlify-functions.md),
  whose contract ADR-033 keeps while changing the platform underneath it.
- Storage is **R2**: `su-itun-snapshots` for shared sheets, `su-lp-assets` for
  licensed artwork. See [ADR-033](docs/adrs/ADR-033-cloudflare-hosting.md).

## Monorepo Conventions

Built on **[the Butter Stack](https://alxjrvs.github.io/butter/)** — Bun · Unified workspace · TypeScript · TanStack · Edge-deployed · React.

- **Bun** for all package management (not npm/yarn); single `bun.lock` at root.
- Workspace packages reference each other via the `workspace:*` protocol.
- Relative imports only (no `@/` path aliases); `type` over `interface`; named
  exports. See [CLAUDE.md](CLAUDE.md) and `.claude/rules/` for the full set.
- Pre-commit (Lefthook): lint --fix + format. Pre-push: typecheck, test,
  validate:all, knip.
