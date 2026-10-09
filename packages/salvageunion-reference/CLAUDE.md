# salvageunion-reference (Game Data Package)

TypeScript ORM + schema-validated JSON dataset for Salvage Union game data.
Design rationale: [ADR-005](../../docs/ARCHITECTURE.md#adr-005) (Zod →
generated JSON Schema, BaseModel/ModelFactory, lazy data loading). All Zod usage
goes through `lib/zod.ts` for CSP-safe (jitless) parsing
([ADR-013](../../docs/ARCHITECTURE.md#adr-013)). Pure rules math lives
here too ([ADR-006](../../docs/ARCHITECTURE.md#adr-006)).

**Data first.** When encoding any game data, model it here first — Zod schema,
JSON data, resolution logic — before building UI or consumers elsewhere. This
package is the single source of truth for game data.

## Build & generated files

The package ships TypeScript source — there is no compile step.
`bun run build:package` (from the repo root) regenerates everything generated,
in order: `generate:registry` (`tools/generateRegistry.ts`), then
`generate:json-schemas` (which imports the generated `zodSchemaMap`, so the
registry must come first), then the docs and API-report generators.
`bun run check generated` (`tools/check-generated.ts`, also at pre-push and in
CI) re-runs them and fails on any drift, including a new untracked file.

**Generated — never hand-edit** (`.claude/hooks/protect-generated-files.sh`
blocks it):

- `schemas/*.schema.json` and the `schemas/index.json` catalog entries
- `lib/generated/modelFactoryRegistry.generated.ts`,
  `lib/generated/zodSchemaMap.generated.ts`,
  `lib/generated/entityTypes.generated.ts` (every `SURef*` entity type and the
  `SURefEntity` / `SURefMetaEntity` unions — membership comes from each
  registry entry's `entity` / `excludeFromEntityUnion` flag) and
  `lib/generated/schemaRegistry.generated.ts`, from the manifest in
  `lib/schemas/registry.ts`
- the static-accessor block inside `lib/index.ts` between
  `// GENERATED:BEGIN` / `// GENERATED:END` (the rest of the file is
  hand-written)

Everything else in `lib/` is hand-written: `lib/schemas/` (Zod), `lib/index.ts`,
`lib/BaseModel.ts`, `lib/ModelFactory.ts`, `lib/LazyModel.ts`, `lib/naming.ts`,
`lib/search.ts`, `lib/helpers.ts`, `lib/slug.ts`. Import types from
`lib/schemas/index.ts`.

### The public barrels are explicit lists

`lib/index.ts` and `lib/rules/index.ts` re-export **by name**, and list only
names that something outside the package imports. There is no `export *` on
either (the one exception is the generated entity-type family). Package-internal
code imports from the module that owns the function — `entityFields.ts`,
`actionResolution.ts`, `entityGuards.ts`, `patterns.ts`, `assets.ts`,
`traitText.ts`, `inventorySlots.ts`, `helpers.ts` — never through the barrel.

To expose a new name, add it to the barrel's list in the same change as its
first outside consumer.

`lib/schemas/objects.ts` → `lib/schemas/objects/*.ts` is still a re-export
barrel, one file per schema family (`primitives`, `content`, `tables`,
`sources`, `contributions`, `effects`, `systemModule`, `choices`, `npc`,
`patterns`, `actions`, `entityBase`, `references`, `crawlerMutations`,
`guides`). Its re-export list is **explicit on purpose** — a submodule may
export a helper its siblings need without that helper joining the package's
public surface.

### Loading is trusted — keep the data parse-stable

`preload()` does **not** Zod-parse (audit PK-04): the committed files are
validated in CI, and `lib/dataCanonical.test.ts` proves that parsing each one
would return it unchanged. Two consequences:

- **Write every default into the data.** A `.default()` value missing from a
  file, or a key a non-strict object would strip, fails that test — the trusted
  load would hand consumers a row a parse would not. Spell the value out
  (`catalog-categories.json` carries `"flat": false` for this reason).
- **Never import `lib/generated/zodSchemaMap.generated.ts` or `lib/zod.ts`
  from the runtime graph, statically or dynamically.** Either puts Zod and
  every entity schema back in both client bundles (srd then ships Zod again;
  itun keeps a Zod chunk regardless for its own `src/lib/schemas`, but regains
  every entity schema), and `lib/loadPathBundle.test.ts` fails. Tools and tests
  may import them directly.

`BaseModel` stamps `schemaName` on a shallow copy of each row, never on the
row it was given — the rows are the imported JSON module's own objects now.

### Looking an entity up

`BaseModel` indexes `id` (eagerly) plus `name` and `slug` (lazily, on first
use). Every way a caller can arrive has an indexed accessor, so there is no
case that needs a predicate (Biome's `noModelFindByKey` plugin,
`tools/biome/noModelFindByKey.grit`, rejects an identity `find` on a model):

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

- `lib/` - TypeScript source (hand-written except `lib/generated/`)
- `lib/schemas/` - Zod schemas, plus `registry.ts`, the manifest that drives codegen
- `data/` - JSON data files
- `schemas/` - JSON Schema files (generated)
- `tools/` - validation and generation scripts

## Model Access Pattern

```typescript
import { SalvageUnionReference, type SURefChassis } from 'salvageunion-reference'

// All models extend BaseModel<T>, created via ModelFactory.
// Address an entity through an INDEX — see "Looking an entity up" above.
const chassis = SalvageUnionReference.Chassis.getById('some-id')
const ironMongrel = SalvageUnionReference.Chassis.getBySlug('iron-mongrel')
const allWeapons = SalvageUnionReference.Equipment.all()
```

`find` / `findAll` remain the right tool for a genuine PREDICATE — a filter over
some other field (`findAll((e) => e.techLevel === 3)`), not an identity lookup.

## Adding New Data

**Rows in an existing schema need no code:** `bun run edit-data add|set` (in
this package; `add` mints the id) is the one writer of `data/`, then
`bun run check data`. A **new schema** is the next section.

## Adding a New Entity **Type** (schema)

Adding a whole new schema (not just rows in an existing file) needs one
hand-authored piece — the Zod schema itself — plus **one** manifest entry in
`lib/schemas/registry.ts`. The `SURef*` type and its SURefEntity /
SURefMetaEntity union membership are generated from that entry.

The `schemas/index.json` catalog entry is **generated** by
`tools/generateDocs.ts` (`itemCount`, `requiredFields`, `title`,
`displayName`). Write the prose in the Zod schema's `.describe()` — it flows
Zod → `schemas/<id>.schema.json` → `schemas/index.json`. Only the `meta` flag is
carried over from the existing entry.

Everything else (ModelFactory's
`dataLoaders` / `zodSchemaMap` / `schemaDisplayNames`,
`index.ts`'s `LazyModel` instances / `lazyModelMap` / `SchemaToEntityMap` /
`SCHEMA_REGISTRY`, the `SURef*` entity types and unions, and the
`SalvageUnionReference` static accessors) is
generated from that manifest by `tools/generateRegistry.ts` — run via
`bun run build:package` (it runs before `generate:json-schemas`, since that
tool transitively imports the generated `zodSchemaMap`).

Run the scaffold generator to print an exact, ready-to-paste checklist for
the manual steps plus the manifest entry, derived from the live registry —
it does not edit files, it tells you precisely what to add and where:

```bash
bun --filter salvageunion-reference scaffold:entity <schema-id> [Singular] [Plural] [--non-entity]
# e.g. … scaffold:entity power-cores "Power Core" "Power Cores"
```

See the header of `tools/scaffold-entity.ts` for full usage.

`LazyModel` is generated
into the class body (not a runtime base class / mixin) specifically so every
static property stays a true _own_ property of `SalvageUnionReference`, which
`lib/index.test.ts` depends on via `Object.getOwnPropertyNames`.

`lib/registryConsistency.test.ts` independently re-verifies that every
generated registry still covers the same schema-id key set — it isn't
weakened by this generator, it's a second, structurally-different check on
the generator's output.

## Testing & validation

- `bun --filter salvageunion-reference test` — schema compliance and data integrity
- `bun run check data` (from the root) — every data check: IDs, slugs,
  cross-references, action references, orphans, traits, parity, schemas
- `bun run validate -- --only=ids,slugs` (in this package) — just the named
  checks; `tools/validate.ts` is the one validation CLI
