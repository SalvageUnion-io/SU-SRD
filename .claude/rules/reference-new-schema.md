---
paths:
  - 'packages/salvageunion-reference/lib/schemas/**'
  - 'packages/salvageunion-reference/data/**'
---

# salvageunion-reference — adding a schema type

New rows in an existing schema need none of this (the package's `edit-data`
script). For a new schema `<id>` (kebab-case, not already in `lib/schemas/registry.ts`):

1. **Zod schema** in `lib/schemas/entities.ts`:
   `export const WidgetSchema = BaseEntitySchema.extend({ … })`. Put the
   catalog prose in `.describe()`. Do not write the `SURef*` type or touch the
   `SURefEntity` / `SURefMetaEntity` unions — both are generated.
   - A rules-metadata schema (like actions) that stays out of `SURefEntity`
     gets `excludeFromEntityUnion: true` AND a `SURefMeta*` type name
     (`lib/__tests__/registryConsistency.test.ts` requires both), and joins that test's
     `MetaOnly` union.
   - A non-entity schema (`entity: false`, like catalog-categories) also joins
     the test's hard-coded non-entity list and its
     `SURefMetaEntity | SURefCatalogCategory` equality check.
2. **Data file** `data/<id>.json`, starting as `[]`.
3. **One registry entry** in `lib/schemas/registry.ts`:
   `{ id, typeName: 'SURefWidget', zodExportName: 'WidgetSchema', singular, plural }`
   (plus `entity: false` or `excludeFromEntityUnion: true` from step 1, and
   `meta: true` to keep the schema out of search and the catalog listing).
   Then `bun run build:package` regenerates the rest, all gitignored:
   `schemas/<id>.schema.json` and its `schemas/index.json` entry (prose from
   the `.describe()`). One part of that entry is still by hand:
   - `displayName` comes from the id → name chain in `parseSchemaFile`
     (`packages/salvageunion-reference/tools/generateDocs.ts`); add the id
     there, or it falls back to the raw id.
4. **Verify:** `bun --filter salvageunion-reference typecheck`,
   `bun --filter salvageunion-reference test` (the registry-consistency guard:
   a failure there means a missed or mistyped registry entry), and
   `bun run check data` from the root.
