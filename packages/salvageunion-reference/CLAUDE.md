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
- `lib/search.ts`, `lib/helpers.ts`, `lib/slug.ts`, `lib/contentBlockHelpers.ts`

### Two re-export barrels — edit the module, not the barrel

`lib/utilities.ts` and `lib/schemas/objects.ts` are **pure re-export barrels**.
They exist so no consumer import breaks; put new code in the module that owns
the responsibility, not in the barrel.

- `lib/utilities.ts` → `entityFields.ts` (plain property readers),
  `actionResolution.ts` (the action map + every self-action fallback getter),
  `entityGuards.ts`, `patterns.ts`, `assets.ts`, `traitText.ts`,
  `inventorySlots.ts`.
- `lib/schemas/objects.ts` → `lib/schemas/objects/*.ts`, one file per schema
  family (`primitives`, `content`, `tables`, `sources`, `contributions`,
  `effects`, `systemModule`, `choices`, `npc`, `patterns`, `actions`,
  `entityBase`, `references`, `crawlerMutations`, `guides`). Its re-export list
  is **explicit on purpose** — a submodule may export a helper its siblings
  need without that helper joining the package's public surface.

### Looking an entity up

`BaseModel` indexes `id` (eagerly) plus `name` and `slug` (lazily, on first
use). Use `getById` / `getByName` / `getBySlug` — never
`model.find((e) => e.id === x)` or `model.find((e) => e.name === x)`, which are
linear scans of the whole schema.

Every way a caller can arrive has an indexed accessor, so there is no case that
needs a predicate:

| You hold                                     | Use                                               |
| -------------------------------------------- | ------------------------------------------------- |
| a model + an id / name / slug                | `Model.getById` / `.getByName` / `.getBySlug`     |
| a model + a ref (id **or** name **or** slug) | `resolveRef(Model, ref)` (`/rules`)               |
| a schema **id** + a name                     | `SalvageUnionReference.getByNameIn(schema, name)` |
| a schema **id** + an id                      | `SalvageUnionReference.get(schema, id)`           |
| a schema **id** + a slug                     | `findEntityBySlug(schema, slug)`                  |

`matchesRef` is for TESTING a candidate you already hold (is this row selected?
how many picks match?). `SomeModel.find((e) => matchesRef(e, ref))` is a SEARCH
wearing a predicate's clothes — use `resolveRef(SomeModel, ref)`.

## Package Structure

- `lib/` - TypeScript source (all hand-written)
- `lib/schemas/` - Zod schema definitions
- `data/` - JSON data files
- `schemas/` - JSON Schema files (generated from Zod schemas)
- `tools/` - Validation and generation scripts

## Model Access Pattern

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

// All models extend BaseModel<T>, created via ModelFactory.
// Address an entity through an INDEX — see "Looking an entity up" above. This
// example used to be `.find((c) => c.id === 'some-id')`, which is precisely the
// linear scan that section bans; the demonstration outweighed the rule, and the
// scan spread from here.
const chassis = SalvageUnionReference.Chassis.getById('some-id')
const ironMongrel = SalvageUnionReference.Chassis.getBySlug('iron-mongrel')
const allWeapons = SalvageUnionReference.Equipment.all()
```

`find` / `findAll` remain the right tool for a genuine PREDICATE — a filter over
some other field (`findAll((e) => e.techLevel === 3)`), not an identity lookup.

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
`dataLoaders` / `zodSchemaMap` / `schemaDisplayNames`,
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
