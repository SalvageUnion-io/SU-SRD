/**
 * Registry consistency (audit item 23).
 *
 * Adding a schema touches several hand-maintained registries: ModelFactory's
 * dataLoaders / schemaDisplayNames, the generated zodSchemaMap module, plus
 * index.ts's LazyModel instances (SCHEMA_REGISTRY / lazyModelMap / static
 * accessors). The loader maps must stay static-literal (bundler-analyzable
 * dynamic imports), so they cannot be derived — instead this test pins every
 * registry to the same key set, turning silent drift (a schema present in
 * one map and missing from another) into a loud failure.
 *
 * The JSON-schema generator (tools/generateJsonSchemas.ts) imports
 * zodSchemaMap directly, so it is covered transitively.
 */
import { describe, expect, test } from 'bun:test'
import type { SchemaToEntityMap } from './generated/schemaRegistry.generated.js'
import { zodSchemaMap } from './generated/zodSchemaMap.generated.js'
import { _registryKeySets, getSchemaCatalog, schemaDisplayNames } from './ModelFactory.js'
import type {
  SURefCatalogCategory,
  SURefEntity,
  SURefMetaAbilityTreeRequirement,
  SURefMetaAction,
  SURefMetaCrawlerTechLevel,
  SURefMetaEntity,
} from './schemas/index.js'
import { registry } from './schemas/registry.js'

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort()
}

describe('schema registry consistency', () => {
  test('every ModelFactory registry covers the same schema ids', () => {
    const canonical = sorted(_registryKeySets.dataLoaders)
    expect(canonical.length).toBeGreaterThan(20)
    expect(sorted(Object.keys(zodSchemaMap))).toEqual(canonical)
    expect(sorted(Object.keys(schemaDisplayNames))).toEqual(canonical)
  })

  test('the schema catalog (SCHEMA_REGISTRY surface) covers the same ids', async () => {
    const catalog = await getSchemaCatalog()
    expect(sorted(catalog.schemas.map((schema) => schema.id))).toEqual(
      sorted(_registryKeySets.dataLoaders)
    )
  })

  test('every schema id has a real display name (breadcrumbs render it raw otherwise)', () => {
    for (const id of _registryKeySets.dataLoaders) {
      const names = schemaDisplayNames[id]
      expect(names?.singular, `schemaDisplayNames missing "${id}"`).toBeTruthy()
      expect(names?.plural, `schemaDisplayNames missing plural for "${id}"`).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// The SURef* entity types and unions are GENERATED from the registry (audit
// PK-10). These pin the generated unions to the registry's flags, so a flag
// edited without regenerating — or a generator bug — fails here rather than
// silently widening or narrowing every consumer's types.
// ---------------------------------------------------------------------------

/** Exact type equality (not mutual assignability, which unions can fake). */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type MetaOnly = SURefMetaAbilityTreeRequirement | SURefMetaAction | SURefMetaCrawlerTechLevel

describe('generated entity unions', () => {
  test('SURefMetaEntity is every registry type except the non-entity catalog', () => {
    const exact: Equal<
      SchemaToEntityMap[keyof SchemaToEntityMap],
      SURefMetaEntity | SURefCatalogCategory
    > = true
    expect(exact).toBe(true)
  })

  test('SURefEntity is SURefMetaEntity minus the excludeFromEntityUnion schemas', () => {
    const exact: Equal<SURefEntity | MetaOnly, SURefMetaEntity> = true
    expect(exact).toBe(true)
  })

  test('the flags that drive the unions are set where the type names say they are', () => {
    // SURefMeta* is the naming convention for the rules-metadata schemas; the
    // flag is what the generator actually reads. They must agree.
    for (const entry of registry) {
      expect(
        entry.typeName.startsWith('SURefMeta'),
        `"${entry.id}": typeName and excludeFromEntityUnion disagree`
      ).toBe(entry.excludeFromEntityUnion === true)
    }
    expect(registry.filter((e) => e.entity === false).map((e) => e.id)).toEqual([
      'catalog-categories',
    ])
  })
})
