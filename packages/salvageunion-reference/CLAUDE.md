# salvageunion-reference (Game Data Package)

The schema-validated JSON dataset, its TypeScript ORM and the pure rules math.
**Data first:** model game data here (Zod, JSON, resolution) before any UI or
consumer. All Zod goes through `lib/zod.ts` (jitless: CSP and workerd both ban
`new Function`).

## Generated files

`schemas/` and `lib/generated/` are gitignored and rebuilt by `ref-generate`
(`tools/ensureGenerated.ts`) whenever their inputs change, on install,
typecheck, test, build and dev; `bun run build:package` forces it. The one
committed output is `lib/index.ts`'s `GENERATED:BEGIN`/`END` block
(`bun run check generated`). Never hand-edit any of them.

## Barrels are explicit lists

`lib/index.ts` and `lib/rules/index.ts` re-export by name only what something
outside the package imports; expose a name in the same change as its first
outside consumer. Package code imports from the owning module, never the
barrel. `lib/schemas/objects.ts` is explicit on purpose too.

## Loading is trusted: keep the data parse-stable

`preload()` does not Zod-parse; `lib/__tests__/dataCanonical.test.ts` proves a
parse would return each file unchanged. So:

- **Write every default into the data** (`"flat": false` and the like).
- **Never import `lib/generated/zodSchemaMap.generated.ts` or `lib/zod.ts`
  from the runtime graph**: it puts Zod and every schema back in the client
  bundles (`loadPathBundle.test.ts` fails). Tools and tests may.

## Looking an entity up

`Model.getById` / `getByName` / `getBySlug`; by schema id:
`SalvageUnionReference.get(schema, id)`, `getByNameIn(schema, name)`,
`findEntityBySlug(schema, slug)`. A stored ref is a slug: read it with
`getBySlug` or a `/rules` resolver (`resolveChassisRef`, …). `find` /
`findAll` are for real predicates only.

## Data

`bun run edit-data add|set` (in this package) is the one writer of `data/`,
then `bun run check data`. Rules text is copied verbatim; `rules-fidelity`
holds it (`bun run rules:fidelity --update`; exceptions in
`lib/proseDeviations.ts`). Book text quoted in TypeScript is
`bookQuote({ source, page }, '…')`. A new schema type:
`.claude/rules/reference-new-schema.md`.

Test: `bun --filter salvageunion-reference test`; `bun run validate -- --only=<ids>`
reruns some data checks.
