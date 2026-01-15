# Architecture Overview

This document provides a high-level overview of the SURef monorepo architecture, data flow, and key patterns.

## Repository Structure

```
.
├── apps/
│   └── suref-web/              # Main web application (React + TanStack Start)
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── hooks/          # TanStack Query hooks
│       │   ├── lib/            # Utilities and API clients
│       │   ├── routes/         # TanStack Router routes
│       │   ├── types/          # TypeScript types
│       │   └── utils/          # Utility functions
│       └── supabase/           # Database migrations
└── packages/
    └── salvageunion-reference/ # Reference data package (TypeScript ORM)
        ├── data/               # JSON data files
        ├── lib/                # TypeScript ORM and utilities
        └── schemas/            # JSON schemas for validation
```

## Apps

### suref-web

The main web application built with:
- **React 19** - UI library
- **TanStack Start** - Full-stack React framework
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Server state management
- **Chakra UI v3** - Component library
- **Supabase** - Backend (database, auth, storage)

#### Key Patterns

**Imports**
- Prefer relative imports over path aliases for imports from `src/` directory
- Example: `import { useHydratedPilot } from '../../hooks/pilot'`
- Relative imports make file relationships explicit and clear
- This applies to ALL files including route files, components, hooks, utilities, etc.

**Data Fetching**
- Use TanStack Query hooks in `src/hooks/`
- Query key factories (e.g., `pilotsKeys`, `mechsKeys`)
- Hydrated hooks for entities with related data (e.g., `useHydratedPilot`)

**Component Organization**
- `components/shared/` - Reusable UI components
- `components/{Feature}/` - Feature-specific components
- `components/entity/` - Entity display and selection
- `components/base/` - Typography and foundational components

**Routing**
- File-based routing in `src/routes/`
- Server-side rendering support via TanStack Start
- Route loaders for data fetching

## Packages

### salvageunion-reference

TypeScript ORM for Salvage Union game data:
- Schema-validated JSON data
- Type-safe model access via `SalvageUnionReference` static methods (e.g., `SalvageUnionReference.Chassis.find(...)`)
- Code generation from schemas
- Search and filtering utilities

## Data Flow

### Reference Data Flow

1. JSON data files in `packages/salvageunion-reference/data/`
2. JSON schemas validate data structure
3. Code generation creates TypeScript types and utilities
4. App imports types from `salvageunion-reference` package

### Application Data Flow

1. User interacts with UI
2. React components call TanStack Query hooks
3. Hooks fetch data via API clients in `src/lib/api/`
4. API clients use Supabase client to query database
5. TanStack Query caches and manages state
6. Components re-render with fresh data

### Authentication Flow

1. User signs in via Supabase Auth (Discord OAuth)
2. Session stored in Supabase
3. Client-side: `src/lib/supabase.ts` client handles auth
4. Server-side: `src/lib/supabase.server.ts` creates request-scoped clients
5. Protected routes check authentication via route loaders

## Key Technologies

### TanStack Query

- Query keys: Hierarchical keys (e.g., `['pilots', id]`)
- Mutations: Optimistic updates, cache invalidation
- Local data: Support for cache-only data (e.g., new entities before save)

### TanStack Router

- Type-safe routes with route params
- Server-side rendering via TanStack Start
- Route loaders for data prefetching

### Supabase

- PostgreSQL database with Row Level Security (RLS)
- Traditional API calls with TanStack Query for data fetching
- Optimistic updates for immediate UI feedback
- Automatic cache invalidation on mutations
- Storage for file uploads
- Authentication with Discord OAuth

## Development Workflow

1. Make changes to code
2. Pre-commit hooks run (lint, format, typecheck, tests)
3. Build package if reference data changed
4. Start dev server
5. Hot reload updates UI

## Bun Workspace Best Practices

This monorepo follows [Bun workspace conventions](https://bun.com/docs/guides/install/workspaces):

- Root `package.json` is `"private": true` to prevent accidental publishing
- Each package/app is self-contained with its own dependencies
- Workspace dependencies use `workspace:*` protocol
- Run `bun install` from root to install dependencies for all workspaces
- Add dependencies to specific workspaces by `cd`ing into the package directory and running `bun add <package>`

## Build Process

1. Install dependencies (`bun install`)
2. Build reference package (`bun run build:package`)
3. Generate types and validate data
4. Build app (`bun run build`)
5. Output: `apps/suref-web/dist/client/` for deployment

## Deployment

- **Platform**: Netlify
- **Build Command**: `bun install && bun run build:package && bun --filter suref-web build`
- **Output Directory**: `apps/suref-web/dist/client`
- **Functions**: Serverless functions auto-generated by TanStack Start

## Testing

- **Framework**: Bun test runner
- **Testing Library**: React Testing Library
- **Test Files**: `*.test.ts` or `*.test.tsx`
- **Coverage**: Run with `bun run test:coverage`

## Type Safety

- Strict TypeScript settings enabled
- Generated types from database (`database-generated.types.ts`)
- Generated types from reference package schemas
- Path aliases for cleaner imports

