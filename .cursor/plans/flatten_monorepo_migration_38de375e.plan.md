---
name: Flatten Monorepo Migration
overview: Merge the Bun workspace monorepo (apps/suref-web + packages/salvageunion-reference) into a single unified application. The salvageunion-reference library becomes an internal module at src/reference/.
todos:
  - id: move-app
    content: Move apps/suref-web contents (src/, public/, supabase/, configs) to root
    status: completed
  - id: move-reference
    content: Move packages/salvageunion-reference/lib to src/reference/, data and schemas as subdirs
    status: completed
  - id: move-tools
    content: Move packages/salvageunion-reference/tools to root tools/
    status: completed
  - id: update-imports
    content: Update 127 files importing from 'salvageunion-reference' to relative imports
    status: completed
  - id: update-reference-internals
    content: Update ModelFactory.ts and types/index.ts internal paths (../data -> ./data)
    status: completed
  - id: update-tools-paths
    content: Update all tool scripts with new data/schema paths
    status: completed
  - id: merge-package-json
    content: Merge package.json files, remove workspaces config
    status: completed
  - id: merge-tsconfig
    content: Create unified tsconfig.json for single project
    status: completed
  - id: merge-eslint
    content: Merge eslint.config.js files
    status: completed
  - id: update-bunfig
    content: Merge bunfig.toml test configurations
    status: completed
  - id: update-netlify
    content: Move and update netlify.toml with new paths
    status: completed
  - id: update-ci
    content: Simplify .github/workflows/ci.yml
    status: completed
  - id: update-cursor-rules
    content: Delete monorepo-patterns.mdc, update package-development.mdc
    status: completed
  - id: cleanup
    content: Delete apps/ and packages/ directories, regenerate bun.lock
    status: completed
  - id: verify
    content: 'Run full verification: typecheck, lint, test, validate, build, dev server'
    status: completed
---

# Flatten Monorepo to Single Bun Application

## Current vs Target Structure

```mermaid
flowchart LR
    subgraph current [Current Structure]
        root[Root package.json]
        apps[apps/suref-web]
        pkg[packages/salvageunion-reference]
        root --> apps
        root --> pkg
        apps -.->|workspace:*| pkg
    end

    subgraph target [Target Structure]
        newRoot[Single package.json]
        src[src/]
        ref[src/reference/]
        tools[tools/]
        newRoot --> src
        src --> ref
        newRoot --> tools
    end

    current -->|migrate| target
```

## Key Files to Modify

- [package.json](package.json) - Merge dependencies, remove workspaces
- [tsconfig.json](tsconfig.json) - Simplify to single project config
- [netlify.toml](apps/suref-web/netlify.toml) - Update paths, move to root
- [bunfig.toml](bunfig.toml) - Merge test config
- [.github/workflows/ci.yml](.github/workflows/ci.yml) - Remove workspace filters
- [apps/suref-web/eslint.config.js](apps/suref-web/eslint.config.js) - Merge with package config

## Phase 1: Move Web App to Root

Move from `apps/suref-web/` to root:

- `src/` directory
- `public/` directory
- `supabase/` directory
- Config files: `vite.config.ts`, `index.html`, `happydom.ts`, `testing-library.ts`

## Phase 2: Move Reference Library to src/reference/

- Move `packages/salvageunion-reference/lib/*` to `src/reference/`
- Move `packages/salvageunion-reference/data/` to `src/reference/data/`
- Move `packages/salvageunion-reference/schemas/` to `src/reference/schemas/`
- Move `packages/salvageunion-reference/tools/` to `tools/`

## Phase 3: Update Imports (127 files)

Change all imports from:

```typescript
import { SalvageUnionReference } from 'salvageunion-reference'
```

To relative imports based on file location:

```typescript
import { SalvageUnionReference } from '../reference'
```

## Phase 4: Update Reference Library Internal Paths

In [ModelFactory.ts](packages/salvageunion-reference/lib/ModelFactory.ts), change:

```typescript
// From (when in lib/)
import abilitiesData from '../data/abilities.json'
// To (when in src/reference/)
import abilitiesData from './data/abilities.json'
```

## Phase 5: Update Tools Path References

All tools in `tools/` need path updates. Example for [checkUniqueIds.ts](packages/salvageunion-reference/tools/checkUniqueIds.ts):

```typescript
// From
const filePath = join(process.cwd(), 'data', filename)
// To
const filePath = join(process.cwd(), 'src', 'reference', 'data', filename)
```

## Phase 6: Merge Configuration Files

- Merge both `package.json` files, remove `workspaces` config
- Merge both `eslint.config.js` files
- Simplify `tsconfig.json` (remove composite/incremental)
- Update `bunfig.toml` with merged test config

## Phase 7: Update Netlify Configuration

Move `netlify.toml` to root, update:

```toml
[build]
  command = "bun install --frozen-lockfile && bun run build"
  publish = "dist/client"
```

## Phase 8: Update CI and Cursor Rules

- Simplify CI workflow (remove `--filter` commands)
- Delete `.cursor/rules/monorepo-patterns.mdc`
- Update `.cursor/rules/package-development.mdc` for new structure

## Phase 9: Cleanup

- Delete `apps/` and `packages/` directories
- Regenerate `bun.lock`
- Run verification: `bun run check:all`

## Verification Checklist

- TypeScript compiles without errors
- All tests pass
- Linting passes
- Data validation passes
- App runs locally
- Netlify preview deploy succeeds
