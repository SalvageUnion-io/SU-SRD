---
paths:
  - 'packages/salvageunion-reference/**'
---

# Package Development

Patterns for developing the salvageunion-reference package.

## Data-First Principle

When encoding any game data, **always start by modeling it in this package first**. Define the Zod schemas, add the JSON data, and implement any resolution logic here before building UI components or consumers in other packages/apps. The reference package is the single source of truth for all game data.

## Package Structure

- `lib/` - TypeScript source (mostly hand-written; `lib/generated/` is codegen — see below)
- `lib/schemas/` - Zod schema definitions (entities, enums, objects, common) plus `lib/schemas/registry.ts`, the hand-maintained manifest that drives registry codegen
- `data/` - JSON data files
- `schemas/` - JSON Schema files (generated from Zod schemas during build)
- `tools/` - Validation and generation scripts

## Build & Registry/JSON-Schema Generation

Building the package regenerates the registry codegen and JSON Schema files (the package ships TypeScript source — no compile step):

```bash
bun run build:package   # from repo root
```

This runs `generate:registry` (`tools/generateRegistry.ts`) then `generate:json-schemas`, in that order — the JSON Schema generator transitively imports the generated `zodSchemaMap`, so the registry must be regenerated first. There is no standalone `generate` command.

**Auto-generated files (DO NOT EDIT):**

- `schemas/*.schema.json` - Generated from Zod schemas via `tools/generateJsonSchemas.ts`
- `lib/generated/modelFactoryRegistry.generated.ts` and `lib/generated/schemaRegistry.generated.ts` - Generated from `lib/schemas/registry.ts` via `tools/generateRegistry.ts`
- The static-accessor block inside `lib/index.ts`'s `SalvageUnionReference` class, between the `// GENERATED:BEGIN` / `// GENERATED:END` marker comments — the rest of `lib/index.ts` is hand-written; only that block is generator-injected (see "Adding a New Entity Type" below for why it's injected into hand-written source rather than imported from `lib/generated/`)

To change generated output:

1. Edit Zod schemas in `lib/schemas/`, or the manifest in `lib/schemas/registry.ts`
2. Run `bun run build:package`

CI (the `build-package` job in `.github/workflows/ci.yml`, and the root `check:schemas` script) fails the build if any of these generated outputs drift from what `bun run build:package` produces.

## All TypeScript Source is Hand-Written (except `lib/generated/`)

Every file in `lib/` is manually maintained except `lib/generated/*.generated.ts`. Key files:

- `lib/schemas/entities.ts` - Zod schema definitions for all entity types
- `lib/schemas/enums.ts` - Enum definitions
- `lib/schemas/objects.ts` - Shared object schemas
- `lib/schemas/common.ts` - Common schema utilities
- `lib/schemas/registry.ts` - The registry manifest (one `RegistryEntry` per schema); source of truth for `tools/generateRegistry.ts`
- `lib/naming.ts` - `toPascalCase`, the schema-id → model-property-name helper (zero imports, used by both the generator and runtime code)
- `lib/LazyModel.ts` - The `LazyModel` class (a `BaseModel` that throws until `preload()` installs its backing model); extracted to its own module so the generated `lazyModelMap` can import it without a circular dependency on `lib/index.ts`
- `lib/index.ts` - Main entry point, model definitions (its static-accessor block is generator-injected — see above)
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

Adding rows to an existing schema's data file needs no code changes — just edit the JSON file in `data/` and run `bun run validate:all`.

## Adding a New Entity Type (schema)

Adding a whole new schema needs 3 hand-authored pieces plus **one** manifest entry:

1. Zod schema in `lib/schemas/entities.ts`, its inferred type + import in `lib/schemas/index.ts`, and (for entity schemas) the `SURefEntity`/`SURefMetaEntity` union edits in **both** `lib/schemas/index.ts` and `lib/types/index.ts` — these need human judgment about which unions a schema belongs in, so they stay manual.
2. The data file (`data/<id>.json`) and a catalog entry in `schemas/index.json` — also manual (prose description, required fields).
3. One entry in the `registry` array in `lib/schemas/registry.ts` (`id`, `typeName`, `zodExportName`, `singular`, `plural`, optional `entity: false`).

Then run `bun run build:package` (or `bun run scaffold:entity <schema-id> [Singular] [Plural]` first, to print an exact checklist with ready-to-paste snippets for steps 1–3). `tools/generateRegistry.ts` derives everything else — `dataLoaders`/`jsonSchemaLoaders`/`zodSchemaMap`/`schemaDisplayNames` in `lib/generated/modelFactoryRegistry.generated.ts`, and the `LazyModel` instances/`lazyModelMap`/`SchemaToEntityMap`/`SCHEMA_REGISTRY`/`SalvageUnionReference` static accessor in `lib/generated/schemaRegistry.generated.ts` plus the marker-injected block in `lib/index.ts` — from that one manifest entry. Run `bun test` afterward; `lib/registryConsistency.test.ts` independently re-verifies every generated registry covers the same schema-id set.

## Usage

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

const chassis = SalvageUnionReference.Chassis.find((c) => c.id === 'some-id')
```
