# Monorepo Patterns

Bun workspace monorepo with multiple apps and shared packages.

## Workspace Structure

- `apps/srd/` - Static SRD reference site (Astro 7, React 19 islands, Tailwind v4)
- `apps/itun/` - Character builder & game manager (React 19 + Vite, TanStack Router, Tailwind v4). **Two storage modes** ([ADR-030](../../docs/adrs/ADR-030-accounts-games-server-of-record.md), superseding ADR-001): Solo — not signed in, IndexedDB is the truth, no account needed, permanently supported; Connected/Disconnected — signed in, Convex (`apps/itun/convex/`) is the server of record and IndexedDB is a cache, offline is read-only. See `apps/itun/CLAUDE.md`.
- `apps/discord-bot/` - Discord.js bot for rolling on Salvage Union tables
- `apps/su-assets/` - Netlify site (`assets.salvageunion.io`) serving licensed entity artwork from Netlify Blobs; `salvageunion-reference` resolves artwork URLs against it at runtime
- `packages/component-lib/` - Shared React component library (no build step, exports TypeScript source)
- `packages/salvageunion-reference/` - TypeScript ORM + schema-validated JSON dataset for game data

## Bun Workspace Best Practices

Following [Bun workspace conventions](https://bun.com/docs/guides/install/workspaces):

- Root `package.json` is `"private": true` to prevent accidental publishing
- Each package is self-contained with its own dependencies
- Workspace dependencies use `workspace:*` protocol (e.g., `"salvageunion-reference": "workspace:*"`)
- Run `bun install` from root to install dependencies for all workspaces
- Add dependencies to specific workspaces by `cd`ing into the package directory

## Package Management

- Use `bun` as package manager (not npm/yarn)
- Root scripts use `bun --filter` to target packages
- `bun run build:package` only regenerates the package's JSON schemas — apps consume its TypeScript source directly, so no build ordering exists
- Dev commands: `bun run dev` (srd), `bun run dev:itun` (ITUN), `bun run dev:bot` (Discord bot)
- `bun run dev:watch` is an **alias of `bun run dev`**, not a watcher — the packages ship TypeScript source, so there is nothing to rebuild on change
- Type checking: `bun run typecheck` (checks all packages)
- Linting: `bun run lint` (all packages)

## Workspace Packages

- `salvageunion-reference` exports TypeScript source directly via `lib/index.ts` (no compile step; `bun run build:package` = JSON-schema regeneration only)
- `component-lib` has no build step - exports TypeScript source directly via `src/index.ts` barrel
- Both are imported via workspace protocol in consuming apps

## Import Conventions

**Always use relative imports over path aliases:**

```typescript
// Correct - use relative imports
import { MyComponent } from '../../components/MyComponent'
import { useEntityStore } from '../stores/entityStore'

// Never - path aliases hide file structure
import { MyComponent } from '@/components/MyComponent'
import { useEntityStore } from '@/stores/entityStore'
```

## Generated Files

- Generated files (like `routeTree.gen.ts` from TanStack Router, and `schemas/*.schema.json` in `salvageunion-reference`) are ignored in linting and must not be hand-edited
