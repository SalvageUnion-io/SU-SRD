/**
 * Registry consistency (audit item 23).
 *
 * Adding a schema touches several hand-maintained registries: ModelFactory's
 * dataLoaders / zodSchemaMap / schemaDisplayNames, plus
 * index.ts's LazyModel instances (SCHEMA_REGISTRY / lazyModelMap / static
 * accessors). The loader maps must stay static-literal (bundler-analyzable
 * dynamic imports), so they cannot be derived — instead this test pins every
 * registry to the same key set, turning silent drift (a schema present in
 * one map and missing from another) into a loud failure.
 *
 * The JSON-schema generator (tools/generateJsonSchemas.ts) imports
 * zodSchemaMap directly, so it is covered transitively.
 */
import { beforeAll, describe, expect, test } from 'bun:test'

import { SalvageUnionReference } from './index.js'
import { _registryKeySets, getSchemaCatalog, schemaDisplayNames } from './ModelFactory.js'

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort()
}

describe('schema registry consistency', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('every ModelFactory registry covers the same schema ids', () => {
    const canonical = sorted(_registryKeySets.dataLoaders)
    expect(canonical.length).toBeGreaterThan(20)
    expect(sorted(_registryKeySets.zodSchemaMap)).toEqual(canonical)
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
