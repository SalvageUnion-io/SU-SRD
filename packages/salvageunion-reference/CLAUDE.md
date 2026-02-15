# salvageunion-reference (Game Data Package)

TypeScript ORM + schema-validated JSON dataset for Salvage Union game data.

## Build & JSON Schema Generation

Building the package compiles TypeScript and generates JSON Schema files from Zod schemas:

```bash
bun run build:package   # from repo root
```

This runs `tsc` followed by `generate:json-schemas` (which converts Zod schemas in `lib/schemas/` to JSON Schema files in `schemas/`).

### Auto-Generated Files (DO NOT EDIT)

- `schemas/*.schema.json` - Generated from Zod schemas via `tools/generateJsonSchemas.ts`
- `dist/` - TypeScript compilation output

To change JSON Schema output, edit the Zod schemas in `lib/schemas/` and rebuild.

### Manually Editable Files

All TypeScript source in `lib/` is hand-written and safe to edit directly:

- `lib/schemas/` - Zod schema definitions (entities, enums, objects, common)
- `lib/index.ts` - Main entry point and model definitions
- `lib/types/index.ts` - Type re-exports for backward compatibility
- `lib/BaseModel.ts`, `lib/ModelFactory.ts` - ORM infrastructure
- `lib/utilities.ts`, `lib/search.ts`, `lib/helpers.ts`, `lib/slug.ts`, `lib/contentBlockHelpers.ts`

## Package Structure

- `lib/` - TypeScript source (all hand-written)
- `lib/schemas/` - Zod schema definitions
- `data/` - JSON data files
- `schemas/` - JSON Schema files (generated from Zod schemas)
- `tools/` - Validation and generation scripts
- `dist/` - Compiled output (don't edit)

## Model Access Pattern

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

// All models extend BaseModel<T>, created via ModelFactory
const chassis = SalvageUnionReference.Chassis.find((c) => c.id === 'some-id')
const allWeapons = SalvageUnionReference.Equipment.all()
```

## Adding New Data

1. Add JSON file to `data/`
2. Add Zod schema to `lib/schemas/entities.ts`
3. Add schema to the map in `tools/generateJsonSchemas.ts`
4. Add model to `lib/index.ts`
5. Run `bun run build:package` to compile and generate JSON schemas
6. Run `bun test` to verify

## Validation

- `bun run validate:all` - Check IDs, cross-references, action references
- `bun run validate:ids` - Unique ID check only
