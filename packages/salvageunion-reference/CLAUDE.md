# salvageunion-reference (Game Data Package)

TypeScript ORM + schema-validated JSON dataset for Salvage Union game data.
Design rationale: [ADR-005](../../docs/adrs/ADR-005-reference-data-orm.md) (Zod →
generated JSON Schema, BaseModel/ModelFactory, lazy data loading). All Zod usage
goes through `lib/zod.ts` for CSP-safe (jitless) parsing
([ADR-013](../../docs/adrs/ADR-013-csp-zod-jitless.md)). Pure rules math lives
here too ([ADR-006](../../docs/adrs/ADR-006-pure-rules-logic.md)).

## Build & JSON Schema Generation

Building the package regenerates JSON Schema files from Zod schemas (the package ships TypeScript source — no compile step):

```bash
bun run build:package   # from repo root
```

This runs `generate:json-schemas` (which converts Zod schemas in `lib/schemas/` to JSON Schema files in `schemas/`).

### Auto-Generated Files (DO NOT EDIT)

- `schemas/*.schema.json` - Generated from Zod schemas via `tools/generateJsonSchemas.ts`

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
5. Run `bun run build:package` to regenerate JSON schemas
6. Run `bun test` to verify

## Adding a New Entity **Type** (schema)

Adding a whole new schema (not just rows in an existing file) needs three
hand-authored pieces — the Zod schema itself, the SURefEntity/SURefMetaEntity
type-union edits, and the `schemas/index.json` catalog entry — plus **one**
manifest entry in `lib/schemas/registry.ts`. Everything else (ModelFactory's
`dataLoaders` / `jsonSchemaLoaders` / `zodSchemaMap` / `schemaDisplayNames`,
`index.ts`'s `LazyModel` instances / `lazyModelMap` / `SchemaToEntityMap` /
`SCHEMA_REGISTRY`, and the `SalvageUnionReference` static accessors) is
generated from that manifest by `tools/generateRegistry.ts` — run via
`bun run build:package` (it runs before `generate:json-schemas`, since that
tool transitively imports the generated `zodSchemaMap`).

Run the scaffold generator to print an exact, ready-to-paste checklist for
the 3 manual steps plus the manifest entry, derived from the live registry —
it does not edit files, it tells you precisely what to add and where:

```bash
bun run scaffold:entity <schema-id> [Singular] [Plural] [--non-entity]
# e.g. bun run scaffold:entity power-cores "Power Core" "Power Cores"
```

See the header of `tools/scaffold-entity.ts` for full usage.

The generated files (`lib/generated/*.generated.ts`, and the marker-injected
static-accessor block inside `lib/index.ts` between the
`// GENERATED:BEGIN` / `// GENERATED:END` comments) are committed,
human-reviewable, and covered by the same `bun run build:package` drift check
as `schemas/*.schema.json` — never hand-edit them. `LazyModel` is generated
into the class body (not a runtime base class / mixin) specifically so every
static property stays a true _own_ property of `SalvageUnionReference`, which
`lib/index.test.ts` depends on via `Object.getOwnPropertyNames`.

`lib/registryConsistency.test.ts` independently re-verifies that every
generated registry still covers the same schema-id key set — it isn't
weakened by this generator, it's a second, structurally-different check on
the generator's output.

## Validation

- `bun run validate:all` - Check IDs, cross-references, action references
- `bun run validate:ids` - Unique ID check only
