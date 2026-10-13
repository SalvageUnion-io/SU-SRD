# salvageunion-reference (Game Data Package)

TypeScript ORM + schema-validated JSON dataset for Salvage Union game data.
Design rationale: [ADR-005](../../docs/ARCHITECTURE.md#decisions) (Zod →
generated JSON Schema, BaseModel/ModelFactory, lazy data loading). All Zod usage
goes through `lib/zod.ts` for CSP-safe (jitless) parsing
([ADR-013](../../docs/ARCHITECTURE.md#decisions)). Pure rules math lives
here too ([ADR-006](../../docs/ARCHITECTURE.md#decisions)).

**Data first.** When encoding any game data, model it here first — Zod schema,
JSON data, resolution logic — before building UI or consumers elsewhere. This
package is the single source of truth for game data.

## Build & generated files

No compile step. `schemas/` and `lib/generated/` are **gitignored**: never
commit them. `tools/ensureGenerated.ts`, the package's `su-ref-generate` bin,
runs the registry, JSON-schema and docs generators when its input hash (Zod,
registry, data, generators) is stale; it runs once per run on postinstall, the
root `typecheck`/`test`/`build`, each app's `dev`, the test preload and
`bun run check` — never pasted into another workspace's `typecheck`. `bun run build:package` forces it.
`bun run check generated` diffs the one committed output, `lib/index.ts`'s
generated block.

**Generated — never hand-edit** (an `Edit(...)` deny rule in
`.claude/settings.json` blocks it):

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

Everything else in `lib/` is hand-written (Zod in `lib/schemas/`, JSON in
`data/`). Import types from `lib/schemas/index.ts`.

### The public barrels are explicit lists

`lib/index.ts` and `lib/rules/index.ts` re-export **by name**, and list only
names that something outside the package imports. There is no `export *` on
either (the one exception is the generated entity-type family). Package-internal
code imports from the module that owns the function — `entityFields.ts`,
`actionResolution.ts`, `entityGuards.ts`, `patterns.ts`, `assets.ts`,
`traitText.ts`, `inventorySlots.ts`, `helpers.ts` — never through the barrel.

To expose a new name, add it to the barrel's list in the same change as its
first outside consumer. Outside tests and stories count (the exports map blocks
deep imports); knip cannot see a re-export whose original is used internally.

`lib/schemas/objects.ts` is a re-export barrel over
`lib/schemas/objects/*.ts`, one file per schema family. Its list is **explicit on purpose** — a submodule may
export a helper its siblings need without that helper joining the package's
public surface.

### Loading is trusted — keep the data parse-stable

`preload()` does **not** Zod-parse: the committed files are
validated in CI, and `lib/__tests__/dataCanonical.test.ts` proves that parsing each one
would return it unchanged. Two consequences:

- **Write every default into the data.** A `.default()` value missing from a
  file, or a key a non-strict object would strip, fails that test — the trusted
  load would hand consumers a row a parse would not. Spell the value out
  (`catalog-categories.json` carries `"flat": false` for this reason).
- **Never import `lib/generated/zodSchemaMap.generated.ts` or `lib/zod.ts`
  from the runtime graph, statically or dynamically.** Either puts Zod and
  every entity schema back in both client bundles (srd then ships Zod again;
  itun keeps a Zod chunk regardless for its own `src/lib/schemas`, but regains
  every entity schema), and `lib/__tests__/loadPathBundle.test.ts` fails. Tools and tests
  may import them directly.

`BaseModel` stamps `schemaName` on a shallow copy of each row, never on the
row it was given — the rows are the imported JSON module's own objects.

### Looking an entity up

`BaseModel` indexes `id` (eagerly) plus `name` and `slug` (lazily, on first
use). Every way a caller can arrive has an indexed accessor, so there is no
case that needs a predicate (Biome's `noModelFindByKey` plugin,
`packages/gates/biome/noModelFindByKey.grit`, rejects an identity `find` on a model):

| You hold                                     | Use                                               |
| -------------------------------------------- | ------------------------------------------------- |
| a model + an id / name / slug                | `Model.getById` / `.getByName` / `.getBySlug`     |
| a schema **id** + a name                     | `SalvageUnionReference.getByNameIn(schema, name)` |
| a schema **id** + an id                      | `SalvageUnionReference.get(schema, id)`           |
| a schema **id** + a slug                     | `findEntityBySlug(schema, slug)`                  |

A ref an app stores (a mech's chassis, a crawler's bays, a pilot's abilities)
is a slug, and only a slug: read it with `Model.getBySlug` or the `/rules`
resolvers (`resolveChassisRef`, `resolveCrawlerBayRef`, …). `find` / `findAll`
remain the right tool for a genuine PREDICATE over some other field
(`findAll((e) => e.techLevel === 3)`), not an identity lookup.

## Adding New Data

**Rows in an existing schema need no code:** `bun run edit-data add|set` (in
this package; `add` mints the id) is the one writer of `data/`, then
`bun run check data`. A **new schema** is the next section. Copy rules text
from the source word-for-word: descriptions and effects are verbatim, never
paraphrased. Gate `rules-fidelity` enforces it: run
`bun run check:rules-fidelity --update`; exceptions go in
`lib/proseDeviations.ts`. Book text quoted in TypeScript (a wizard rule, a stat
hint) is wrapped in `bookQuote({ source, page }, '…')` (`lib/bookQuote.ts`), so
the same gate holds it to the book.

## Adding a New Entity **Type** (schema)

The checklist is `.claude/rules/reference-new-schema.md`.

`LazyModel` is generated into the class body, not a runtime base class or
mixin, so every static stays an _own_ property of `SalvageUnionReference`
(`lib/__tests__/index.test.ts` relies on it). `lib/__tests__/registryConsistency.test.ts` is an
independent second check that every generated registry covers the same
schema ids.

## Testing & validation

- `bun --filter salvageunion-reference test` — schema compliance
  (`lib/__tests__/dataCanonical.test.ts`) and data integrity
- `bun run check data` (from the root) — every data check: IDs, slugs,
  cross-references, action references, orphans, traits, parity
- `bun run validate -- --only=ids,slugs` (in this package) — just the named
  checks; `tools/validate.ts` is the one validation CLI
