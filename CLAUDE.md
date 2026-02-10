# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Bun monorepo ("SURef") for Salvage Union (tabletop RPG) tools, located in the `SU-SRD/` subdirectory. Contains a static reference site, a character builder app, a Discord bot, and shared packages.

## SU-SRD Monorepo

### Quick Reference

```bash
# First-time setup
cd SU-SRD && bun install && bun run build:package

# Development
bun run dev              # Build package + start reference site dev server
bun run dev:builder      # Build package + start builder app dev server
bun run dev:watch        # Watch package changes + start reference site
bun run dev:bot          # Start Discord bot locally

# Testing
bun test                 # Run all tests (Bun test runner)
bun --filter salvageunion-reference test   # Test package only
bun --filter suref-react test              # Test shared components only
bun --filter suref-web test                # Test reference site only
bun --filter suref-builder test            # Test builder app only

# Code quality
bun run lint             # Lint all packages
bun run format           # Format all packages with Prettier
bun run typecheck        # TypeScript check all packages
bun run check:all        # Full CI check (lint, format, typecheck, test, validate)

# Package code generation (after schema/data changes)
cd packages/salvageunion-reference && bun run generate

# Data validation
bun run validate:all     # Check IDs, cross-references, action references
bun run validate:ids     # Unique ID check only

# Supabase type generation (after DB schema changes)
bun --filter suref-builder gen:all     # Generate TS types + Zod schemas

# Discord bot commands
bun run deploy-commands          # Deploy slash commands to test guild
bun run deploy-commands:global   # Deploy globally (production)

# Building
bun run build            # Full build (package + reference site)
bun run build:builder    # Build builder app
bun run build:bot        # Build Discord bot
```

### Architecture

**Workspace structure:**
- `apps/suref-web/` - Static SRD reference site (React 19, TanStack Start/Router, Chakra UI v3, Vite). No auth, no Supabase.
- `apps/suref-builder/` - Character builder & game manager (React 19, TanStack Start/Router/Query, Chakra UI v3, Supabase, Vite). Has auth, dashboard, live sheets.
- `apps/discord-bot/` - Discord.js bot for rolling on Salvage Union tables
- `packages/suref-react/` - Shared React component library (theme, entity display system, base typography, UI primitives). No build step, exports TypeScript source.
- `packages/salvageunion-reference/` - TypeScript ORM + schema-validated JSON dataset for game data

**Dependency graph:**
```
salvageunion-reference (game data ORM)
  └── suref-react (shared UI components)
        ├── suref-web (static reference site)
        └── suref-builder (character builder + game manager)
discord-bot (standalone, depends on salvageunion-reference)
```

**Data flow (builder):** React components -> TanStack Query hooks (`src/hooks/`) -> API clients (`src/lib/api/`) -> Supabase client -> PostgreSQL with RLS. Reference data comes from `salvageunion-reference` package imported directly.

**Key dependency:** The `salvageunion-reference` package must be built before the apps can resolve types. Run `bun run build:package` after cloning or after changes to `packages/salvageunion-reference/`.

### Code Conventions (from `.ai/rules/`)

- **Always use relative imports** (never `@/` path aliases)
- **Use `type` over `interface`** for object types (unless extending)
- **Avoid `any`** - use `unknown` if type is truly unknown
- **Use `import type`** syntax for type-only imports
- **Named exports** everywhere except route components (which may use default exports for TanStack Router)
- **Bun** for all package management (not npm/yarn)
- **Prettier + ESLint** for formatting/linting (pre-commit hooks via Lefthook)

### salvageunion-reference Package

Code generation is central to this package. **Never manually edit** auto-generated files:
- `lib/index.ts`, `lib/utilities-generated.ts`, `lib/types/*.ts`

To modify generated code, edit generator scripts in `tools/` or template files (e.g., `lib/index.template.ts`), then run `bun run generate`.

Manually editable files: `lib/utilities.ts`, `lib/ModelFactory.ts`, `lib/BaseModel.ts`, `lib/search.ts`.

Models extend `BaseModel<T>`, created via `ModelFactory`, accessed via `SalvageUnionReference.{SchemaName}` static properties (e.g., `SalvageUnionReference.Chassis.find(...)`).

### suref-react Package (Shared Components)

- **No build step** - exports TypeScript source directly via `src/index.ts` barrel. Vite in consuming apps handles `.ts/.tsx`.
- **Contents:** Theme system (colors, recipes), base typography (Heading, Text), UI primitives (Tooltip, Toaster), entity display system (~30 files), shared components (Card, ValueDisplay, SheetDisplay, RollTable, Modal, etc.), skeletons, utilities (slug, parseTraitReferences), constants.
- **No Supabase dependency** - agnostic to data source.
- **Entity display** uses a render prop pattern (`classAbilitiesRenderer`) so consuming apps can inject app-specific renderers.
- **Testing:** Own `bunfig.toml` with happy-dom preload (no Supabase env vars).

### suref-web App (Static Reference Site)

- **Routing:** File-based routing in `src/routes/` via TanStack Router. Routes: `/` (landing), `/schema/$schemaId`, `/schema/$schemaId/item/$itemId`, `/about`, `/randsum`, `/404`.
- **No auth, no Supabase, no user data.** Pure static reference site.
- **UI:** Chakra UI v3 with theme from `suref-react`. Components import from `suref-react` for shared UI.
- **Testing:** Bun test runner with React Testing Library + happy-dom. No Supabase env vars needed.
- **Deployment:** Netlify

### suref-builder App (Character Builder)

- **Routing:** File-based routing. Routes: `/dashboard/**` (pilots, mechs, crawlers, games), `/sheets/**` (playgrounds), `/auth/callback`.
- **State:** TanStack Query for server state with query key factories (e.g., `pilotsKeys`, `mechsKeys`). Local UI state with React hooks.
- **UI:** Chakra UI v3 with theme from `suref-react`. Components import from `suref-react` for shared UI.
- **Hydrated hooks:** `useHydrated*` hooks combine entity data with related data (choices, references)
- **Auth:** Discord OAuth via Supabase Auth. Client: `src/lib/supabase.ts`. Server: `src/lib/supabase.server.ts`.
- **Database:** Supabase PostgreSQL with RLS. Generated types in `src/types/database-generated.types.ts`. Migrations in `supabase/migrations/`.
- **Testing:** Bun test runner with React Testing Library + happy-dom. Supabase env vars set in `bunfig.toml`.
- **Deployment:** Netlify

### Pre-commit Hooks (Lefthook)

Pre-commit runs: lint --fix, format, typecheck (parallel).
Pre-push runs: test, validate:all (parallel).
