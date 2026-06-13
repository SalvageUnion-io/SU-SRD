---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Style

TypeScript style conventions for type safety, imports, and code style.

## Type Safety

- Use strict TypeScript settings (enabled in `tsconfig.json`)
- Prefer `type` over `interface` for object types (unless extending)
- Use `as const` for literal types and readonly arrays
- Avoid `any` at all costs - use `unknown` if type is truly unknown

## Import Conventions

- Import types with `import type` syntax: `import type { SURefChassis } from 'salvageunion-reference'`
- Always use relative imports - never use `@/` path aliases
- Use relative imports to make file relationships explicit and clear

## Game-Data Types

Import types from `salvageunion-reference` package:

- Use `SURef*` prefix types (e.g., `SURefChassis`, `SURefEquipment`)
- Use `SURefSchemaName` for schema name unions

## Generics

Use meaningful generic names with constraints when needed:

- `T`, `TData`, `TVariables`
- Example: `<T extends { id: string }>`

## Utility Types

- Use `Omit`, `Pick`, `Partial`, `Required` from TypeScript
- Use `type-fest` utilities when needed

## Formatting and Linting

- Use Prettier for formatting (run `bun run format` before committing)
- Use ESLint (run `bun run lint` to check)
