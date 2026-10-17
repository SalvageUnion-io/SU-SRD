#!/usr/bin/env bun
/**
 * generateRegistry — codegen for the schema registration mechanism.
 *
 * Reads the single manifest (lib/schemas/registry.ts) and emits four
 * gitignored, human-readable generated files (`tools/ensureGenerated.ts` runs
 * this):
 *
 *   - lib/generated/modelFactoryRegistry.generated.ts
 *       dataLoaders (literal per-id `import()` calls — required for bundler
 *       code-splitting to statically analyze them) plus schemaDisplayNames.
 *       It imports NO Zod: this module is on every consumer's load path.
 *
 *       It also emits listDataLoaders, the same for each entry marked
 *       `listProjection`, pointing at that entry's projection file:
 *
 *   - lib/generated/<id>.list.generated.json
 *       the entry's rows without their prose (lib/listProjection.ts), which
 *       `preload(ids, { projection: 'list' })` loads for listings.
 *
 *   - lib/generated/zodSchemaMap.generated.ts
 *       zodSchemaMap — the entity Zod schemas keyed by schema id. Kept in its
 *       own module because only tools and tests import it; the runtime loader
 *       never does, so the entity schemas stay out of client chunks.
 *
 *   - lib/generated/entityTypes.generated.ts
 *       the Ref* entity type aliases (`z.infer` of each registry schema)
 *       and the RefEntity / RefMetaEntity unions, whose membership comes
 *       from each entry's `entity` / `excludeFromEntityUnion` flags. Type-only: it imports the
 *       schemas with `import type`, so it adds nothing to any bundle. The
 *       lib/schemas barrel re-exports it.
 *
 *   - lib/generated/schemaRegistry.generated.ts
 *       the SchemaToEntityMap type, the LazyModel instances (inlined
 *       directly into lazyModelMap — no intermediate per-schema consts, so
 *       there's nothing here for knip to flag as an unused export), and
 *       SCHEMA_REGISTRY.
 *
 * It also injects the ~N `static X: ModelWithMetadata<...> = lazyModelMap[...]`
 * lines for the SalvageUnionReference class directly into lib/index.ts,
 * between the `// GENERATED:BEGIN` / `// GENERATED:END` marker comments
 * (which must already exist in that file). This — rather than a runtime
 * mixin/base-class trick — keeps every static property a true *own* property
 * of the class, which lib/__tests__/index.test.ts depends on via
 * `Object.getOwnPropertyNames(SalvageUnionReference)`.
 *
 * Run via `bun run build:package` (before tools/generateJsonSchemas.ts, which
 * imports zodSchemaMap from the generated file this script produces).
 */
export {};
