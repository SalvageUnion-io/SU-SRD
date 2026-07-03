---
paths:
  - "packages/salvageunion-reference/**"
---

# Package Development

Patterns for developing the salvageunion-reference package.

## Data-First Principle

When encoding any game data, **always start by modeling it in this package first**. Define the Zod schemas, add the JSON data, and implement any resolution logic here before building UI components or consumers in other packages/apps. The reference package is the single source of truth for all game data.

## Package Structure

- `lib/` - TypeScript source (all hand-written)
- `lib/schemas/` - Zod schema definitions (entities, enums, objects, common)
- `data/` - JSON data files
- `schemas/` - JSON Schema files (generated from Zod schemas during build)
- `tools/` - Validation and generation scripts

## Build & JSON Schema Generation

Building the package regenerates JSON Schema files (the package ships TypeScript source — no compile step):

```bash
bun run build:package   # from repo root
```

This runs `generate:json-schemas`. There is no standalone `generate` command.

**Auto-generated files (DO NOT EDIT):**

- `schemas/*.schema.json` - Generated from Zod schemas via `tools/generateJsonSchemas.ts`

To change generated output:

1. Edit Zod schemas in `lib/schemas/`
2. Run `bun run build:package`

## All TypeScript Source is Hand-Written

All files in `lib/` are manually maintained. Key files:

- `lib/schemas/entities.ts` - Zod schema definitions for all entity types
- `lib/schemas/enums.ts` - Enum definitions
- `lib/schemas/objects.ts` - Shared object schemas
- `lib/schemas/common.ts` - Common schema utilities
- `lib/index.ts` - Main entry point, model definitions
- `lib/types/index.ts` - Type re-exports for backward compatibility
- `lib/BaseModel.ts`, `lib/ModelFactory.ts` - ORM infrastructure
- `lib/utilities.ts`, `lib/search.ts`, `lib/helpers.ts`

## Model Structure

- All models extend `BaseModel<T>`
- Created via `ModelFactory`
- Use `SalvageUnionReference` static properties to access models
- Models provide: `all()`, `find()`, `findAll()` methods

## Testing

- Tests use Bun's built-in test runner
- Test files: `*.test.ts`
- Run tests with `bun test`
- Tests validate schema compliance and data integrity

## Adding New Data

1. Add JSON file to `data/` directory
2. Add Zod schema to `lib/schemas/entities.ts`
3. Add schema to the map in `tools/generateJsonSchemas.ts`
4. Add model to `lib/index.ts`
5. Run `bun run build:package`
6. Run `bun test` to verify

## Usage

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

const chassis = SalvageUnionReference.Chassis.find((c) => c.id === 'some-id')
```
