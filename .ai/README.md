# AI Context Rules

This directory contains coding conventions and patterns for AI assistants working on this codebase. These rules are designed to be agent-agnostic and work with any AI coding assistant (Claude Code, Cursor, GitHub Copilot, Cody, etc.).

## How to Use These Rules

AI assistants should reference these files when working on code in this repository. Each rule file documents patterns, conventions, and best practices for specific areas of the codebase.

## Rules Index

### Always Active

These rules apply globally to all files:

| Rule | Description |
|------|-------------|
| [typescript-style.md](rules/typescript-style.md) | TypeScript conventions, type safety, imports |
| [monorepo-patterns.md](rules/monorepo-patterns.md) | Bun workspace structure, package management |

### Context-Specific

These rules apply when working on specific file types or areas:

| Rule | Applies To | Description |
|------|------------|-------------|
| [react-components.md](rules/react-components.md) | `apps/suref-web/src/components/**/*.tsx`, `apps/suref-web/src/routes/**/*.tsx` | React component patterns, Chakra UI, live sheets |
| [supabase-api.md](rules/supabase-api.md) | `apps/suref-web/src/lib/api/**/*.ts` | Supabase client, queries, validation, hydration |
| [tanstack-query-hooks.md](rules/tanstack-query-hooks.md) | `apps/suref-web/src/hooks/**/*.ts` | Query hooks, mutations, query key factories |
| [tanstack-router.md](rules/tanstack-router.md) | `apps/suref-web/src/routes/**/*.tsx` | File-based routing, navigation, context |
| [testing-patterns.md](rules/testing-patterns.md) | `**/*.test.ts`, `**/*.test.tsx` | Testing with Bun and Testing Library |
| [error-handling.md](rules/error-handling.md) | `**/*.ts`, `**/*.tsx` | Error types, boundaries, logging |
| [database-migrations.md](rules/database-migrations.md) | `apps/suref-web/supabase/migrations/*.sql` | Migration patterns, RLS, type generation |
| [package-development.md](rules/package-development.md) | `packages/salvageunion-reference/**/*.ts` | Package structure, code generation |

## Quick Reference

### Key Conventions

1. **Relative imports** - Always use relative imports, not path aliases (`@/`)
2. **Bun** - Use `bun` for all package management (not npm/yarn)
3. **Type safety** - Use strict TypeScript, prefer `type` over `interface`
4. **TanStack Query** - Use for all server state management
5. **Chakra UI v3** - Use for all UI components
6. **Named exports** - Use named exports (except route components)

### Common Commands

```bash
# Development
bun run dev          # Start dev server
bun run dev:watch    # Start with package watching

# Building
bun run build        # Full build
bun run build:package # Build salvageunion-reference only

# Testing
bun test             # Run all tests
bun run typecheck    # Type check all packages

# Code Quality
bun run lint         # Lint the app
bun run format       # Format with Prettier

# Type Generation
bun run gen:types    # Generate Supabase types
bun run gen:zod      # Generate Zod schemas
bun run gen:all      # Generate all types
```

## Workspace Structure

```
SU-SRD/
├── apps/
│   └── suref-web/           # Main web application
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── hooks/       # TanStack Query hooks
│       │   ├── lib/         # Utilities, API clients
│       │   ├── routes/      # TanStack Router pages
│       │   └── types/       # TypeScript types
│       └── supabase/        # Supabase config & migrations
├── packages/
│   └── salvageunion-reference/  # Game reference data package
└── docs/                    # Documentation
```
