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

# Build the reference package (required before apps can resolve types)
bun run build:package

# Start the reference site dev server (builds package, then serves srd)
bun run dev
```

Other dev servers: `bun run dev:itun` (character builder), `bun run dev:bot`
(Discord bot).

## Structure

```
.
├── apps/
│   ├── srd/              # Static SRD reference site (in-house SSG in srd/ssg + React islands)
│   ├── itun/       # Character builder & game manager (React 19, local-first)
│   └── discord-bot/            # Discord.js bot for rolling on SU tables
├── packages/
│   ├── salvageunion-reference/ # Game-data ORM + schema-validated JSON dataset (built)
│   └── component-lib/            # Shared React component library (no build step)
├── docs/                       # Architecture docs + ADRs (see docs/README.md)
├── package.json                # Root workspace configuration
├── biome.jsonc                 # Shared Biome (lint + format) config
└── tsconfig.json               # Shared TypeScript base config
```

**Dependency graph:** `salvageunion-reference → component-lib → {srd,
itun}`; `discord-bot` is standalone. The reference package must be
built (`bun run build:package`) before the apps can resolve its types.

## Common Commands

```bash
# Development
bun run dev          # Reference site (srd)
bun run dev:itun     # Character builder (itun)
bun run dev:bot      # Discord bot

# Build
bun run build            # Everything (package + all apps)
bun run build:package    # Reference package only

# Quality (run across all workspaces)
bun run lint
bun run format        # bun run format:check to verify only
bun run typecheck
bun run test          # never bare `bun test` at the root — it skips the
                      # per-workspace bunfig preloads and fails by the hundreds
bun run validate:all  # Data integrity: IDs, cross-refs, action refs
bun run check:all     # Full CI suite (lint, format, typecheck, test, validate, knip)
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
bun run rules:extract        # PDF → rules/extracted/ text layer (prerequisite)
bun run rules:regen          # regenerate the docs/rules/ agent digest
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
2. Rebuild: `bun run build:package` (compiles TypeScript and regenerates
   `schemas/*.schema.json` from the Zod sources).
3. Changes are immediately available to consuming apps via workspace linking.

`schemas/*.schema.json` and `dist/` are generated — never edit them by hand.

## Deployment

- **srd** and **itun** → Netlify (config in each app's
  `netlify.toml`). ITUN also serves the snapshot-sharing backend as Netlify
  Functions — see [ADR-004](docs/adrs/ADR-004-snapshot-netlify-functions.md).
- **discord-bot** → Render worker (Blueprint in `render.yaml`).

## Monorepo Conventions

- **Bun** for all package management (not npm/yarn); single `bun.lock` at root.
- Workspace packages reference each other via the `workspace:*` protocol.
- Relative imports only (no `@/` path aliases); `type` over `interface`; named
  exports. See [CLAUDE.md](CLAUDE.md) and `.claude/rules/` for the full set.
- Pre-commit (Lefthook): lint --fix + format. Pre-push: typecheck, test,
  validate:all, knip.
