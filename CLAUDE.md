# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Hub

**Start here for navigation:** [`docs/README.md`](docs/README.md) maps user intent → relevant doc (architecture, ADRs, per-package CLAUDE.md).

- [`docs/adrs/`](docs/adrs/) — architecture decision records (13 ADRs, all reflecting decisions live in the code). Consult the matching ADR before revisiting a prior decision (e.g. [ADR-007](docs/adrs/ADR-007-automation-boundary.md) automation boundary before building rules-driven features).
- [`docs/architecture/`](docs/architecture/) — cross-cutting architecture (display system, data flow, package contracts, rules-engine boundary, combat loop, SEO/a11y).
- `docs/rules/` — agent-readable digest of the Salvage Union core rules + expansions (turn loop, heat, damage, salvage, creation, GM guidance, Meld/Chimerium subsystems). **Generated, gitignored, not committed** (condensed from the copyright-bearing PDFs in `rules/`, also gitignored) — produce it locally with `bun run rules:regen`, then read it instead of re-parsing the PDFs. Generator/manifest: `tools/rules-digest/`.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Stay strictly within the scope of what the user asked for. If you think something additional would be beneficial, mention it as a suggestion but do not implement it.
- When the user asks to 'plan' or 'prepare' something, the scope is document/plan creation only — do NOT begin implementation unless explicitly asked to implement.

## UI Development

- Always reuse existing shared components (e.g., EntityDisplay, DisplayCard) rather than building custom one-off UI. Check for existing patterns in the shared packages first before creating new components.
- When making CSS/layout changes, get the first attempt right by carefully considering the rendering context (e.g., float doesn't work inside grid/flex containers). If a visual change requires iteration, ask the user to confirm via screenshot before making further adjustments. Prefer simple, well-understood CSS patterns over clever approaches.
- For UI components, prefer compact/listing card displays by default (header-only, clickable) rather than full inline expanded displays. Ask if unsure about the level of detail to render.

## Build & Validation

This is a TypeScript monorepo with shared packages (suref-react, etc.). After any cross-package changes, always run typecheck, tests, and lint before considering a task complete. When modifying shared components, check all consuming apps for regressions (especially Tailwind @source paths and import changes).

### Root Dev Dependencies (Intentional)

- **`puppeteer-core`** — Used by `tools/a11y-scan.ts` for WCAG accessibility audits. Not dead code.

## Repository Overview

Bun monorepo ("SURef") for Salvage Union (tabletop RPG) tools, located in the `SU-SRD/` subdirectory. Contains a static reference site, a character builder app, a Discord bot, and shared packages.

## External Integrations & MCP Servers

The apps deploy to two platforms, each with an official MCP server wired up in the project-scoped [`.mcp.json`](.mcp.json) (committed; Claude Code prompts each contributor to approve it per-project):

- **Netlify** — hosts `apps/suref-web` (static) and `apps/in-the-union-now` (static SPA + the snapshot backend Netlify Functions + Blobs; see `apps/*/netlify.toml` and [ADR-004](docs/adrs/ADR-004-snapshot-netlify-functions.md)). MCP server: official `@netlify/mcp` (stdio); authenticates via the Netlify CLI/OAuth — no token in the file.
- **Render** — hosts `apps/discord-bot` as a worker (see `render.yaml`). MCP server: official hosted server at `https://mcp.render.com/mcp`; reads `RENDER_API_KEY` from your shell env.
- **GitHub** — repo host + Actions CI + PR workflow. MCP server: official remote `https://api.githubcopilot.com/mcp/`; reads `GITHUB_PAT` from your shell env.

`.mcp.json` is **secret-free by design** — never put tokens in it; auth is via env vars (`RENDER_API_KEY`, `GITHUB_PAT`) or OAuth. Set the env vars before launching Claude Code if you want those servers to connect (e.g. `export RENDER_API_KEY=...`).

## SU-SRD Monorepo

### Quick Reference

```bash
# First-time setup
cd SU-SRD && bun install && bun run build:package

# Development
bun run dev              # Build package + start reference site dev server
bun run dev:watch        # Watch package changes + start reference site
bun run dev:bot          # Start Discord bot locally
bun run dev:itun         # Build package + start ITUN app dev server

# Testing
bun test                 # Run all tests (Bun test runner)
bun --filter salvageunion-reference test   # Test package only
bun --filter suref-react test              # Test shared components only
bun --filter suref-web test                # Test reference site only
bun --filter in-the-union-now test         # Test ITUN app only

# Code quality
bun run lint             # Lint all packages
bun run format           # Format all packages with Prettier
bun run typecheck        # TypeScript check all packages
bun run check:all        # Full CI check (lint, format, typecheck, test, validate, knip)

# Build package (compiles TypeScript + generates JSON schemas from Zod)
bun run build:package

# Data validation
bun run validate:all     # Check IDs, cross-references, action references
bun run validate:ids     # Unique ID check only

# Discord bot commands
bun run deploy-commands          # Deploy slash commands to test guild
bun run deploy-commands:global   # Deploy globally (production)

# Building
bun run build            # Full build (package + reference site)
bun run build:itun       # Build ITUN app
bun run build:bot        # Build Discord bot
```

### Architecture

**Workspace structure:**

- `apps/suref-web/` - Static SRD reference site (Astro 5, React 19 islands, Tailwind v4, Vite). No auth, no backend.
- `apps/in-the-union-now/` - Character builder & game manager (React 19, TanStack Router/Query, ShadCN + Tailwind v4, Vite). Local-first: IndexedDB persistence, no auth, no backend. Has dashboard, live sheets, snapshot sharing.
- `apps/discord-bot/` - Discord.js bot for rolling on Salvage Union tables
- `packages/suref-react/` - Shared React component library (ShadCN + Tailwind, entity display system, base typography, UI primitives). No build step, exports TypeScript source.
- `packages/salvageunion-reference/` - TypeScript ORM + schema-validated JSON dataset for game data

**Dependency graph:**

```
salvageunion-reference (game data ORM)
  └── suref-react (shared UI components)
        ├── suref-web (static reference site)
        └── in-the-union-now (character builder + game manager)
discord-bot (standalone, depends on salvageunion-reference)
```

**Key dependency:** The `salvageunion-reference` package must be built before the apps can resolve types. Run `bun run build:package` after cloning or after changes to `packages/salvageunion-reference/`.

### Architecture Reference

Detailed cross-cutting architecture docs live in `docs/architecture/`:

- **[display-system.md](docs/architecture/display-system.md)** — Three-layer rendering stack: DisplayCard -> ReferenceEntityDisplay -> consumer patterns
- **[data-flow.md](docs/architecture/data-flow.md)** — Reference data + player data resolution, TanStack Query patterns, IndexedDB hydration
- **[seo-accessibility.md](docs/architecture/seo-accessibility.md)** — SEO strategy (suref-web) and WCAG 2.1 AA compliance patterns
- **[package-contracts.md](docs/architecture/package-contracts.md)** — Package APIs, dependency rules, cross-package change checklist

### Code Conventions (from `.claude/rules/`)

- **Always use relative imports** (never `@/` path aliases)
- **Use `type` over `interface`** for object types (unless extending)
- **Avoid `any`** - use `unknown` if type is truly unknown
- **Use `import type`** syntax for type-only imports
- **Named exports** everywhere except route components (which may use default exports for TanStack Router)
- **Bun** for all package management (not npm/yarn)
- **Prettier + ESLint** for formatting/linting (pre-commit hooks via Lefthook)

### salvageunion-reference Package

All TypeScript source in `lib/` is hand-written (Zod schemas in `lib/schemas/`, models in `lib/index.ts`, etc.). The only auto-generated files are `schemas/*.schema.json` (from Zod schemas) and `dist/` (from TypeScript compilation) — both produced by `bun run build:package`.

**Do not manually edit** `schemas/*.schema.json` or `dist/`. To change JSON Schema output, edit Zod schemas in `lib/schemas/` and rebuild.

Models extend `BaseModel<T>`, created via `ModelFactory`, accessed via `SalvageUnionReference.{SchemaName}` static properties (e.g., `SalvageUnionReference.Chassis.find(...)`).

### suref-react Package (Shared Components)

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel. Vite in consuming apps handles `.ts/.tsx`.
- **Contents:** Theme system (colors, recipes), base typography (Heading, Text), UI primitives (Tooltip, Toaster), entity display system (~30 files), shared components (Card, ValueDisplay, SheetDisplay, RollTable, Modal, etc.), skeletons, utilities (slug, parseTraitReferences), constants.
- **No backend dependency** - agnostic to data source.
- **Entity display** uses a render prop pattern (`classAbilitiesRenderer`) so consuming apps can inject app-specific renderers.
- **Testing:** Own `bunfig.toml` with happy-dom preload (no backend env vars).

### suref-web App (Static Reference Site)

- **Framework:** Astro 5 with React 19 islands architecture. Static output, no SSR.
- **Routing:** File-based routing in `src/pages/` via Astro. Routes: `/` (landing), `/schema/[schemaId]`, `/schema/[schemaId]/item/[itemId]`, `/about`, `/404`.
- **No auth, no backend, no user data.** Pure static reference site.
- **UI:** Tailwind v4 with theme from `suref-react`. React islands for interactive components (search, schema viewer, entity display). Components import from `suref-react` for shared UI.
- **Search:** In-memory search via `salvageunion-reference` package `search()` function. Cmd+K/Ctrl+K shortcut to focus.
- **Testing:** Bun test runner with React Testing Library + happy-dom. No backend env vars needed.
- **Deployment:** Netlify (static site, no server functions)

### Data Conventions

- Entity links must use slugs, never UUIDs. Example: `/chassis/iron-mongrel` not `/chassis/550e8400-e29b...`
- When modifying JSON data files (especially crawler output), never use automated formatters like `json.dump` that reformat arrays. Use text-level insertion to preserve original formatting.

### UI Rendering Conventions

- When rendering lists of entities (roll tables, equipment, drones, etc.), default to compact header-only clickable listings unless explicitly asked for full inline displays. Never render nested entities as separate grids — always render them inside their parent's expanded/modal view.
- Reuse existing UI components (e.g., pseudoheader components with black backgrounds) before creating new CSS-based alternatives. Check the component library first.

### Development Workflow

After making component changes, always verify all props are passed through to child/nested components (e.g., fontSize, spacing, damaged). Run typecheck immediately after edits to catch missing props before moving on.

### Debugging

For styling bugs, check Tailwind configuration (@source paths, plugin setup) early before diving into component/data logic. Many visual bugs trace back to Tailwind config rather than application code.

### Pre-commit Hooks (Lefthook)

Pre-commit runs: lint --fix, format (parallel). Typecheck does NOT run pre-commit.
Pre-push runs: typecheck, test, validate:all, knip (parallel).

### Project Skills (`.claude/skills/`)

When to reach for which skill (overlap explained):

- `/build-package` — rebuild `salvageunion-reference` only (TS compile + regenerate `schemas/*.schema.json`). Use after Zod schema or data-file edits.
- `/generate` — same as above **plus** `validate:all` (IDs, cross-refs, action refs). Use when you've changed JSON data and want integrity checks in one step.
- `/validate` / `/verify` — run the full CI suite (`lint`, `format`, `typecheck`, `test`, `validate`). Both do the same thing; prefer `/validate`.
- `/a11y-scan` — WCAG 2.1 AA scan via puppeteer (suref-web).
- `/commit` — conventional commit with message drafting.
- `/deploy-bot` — deploy Discord slash commands.
