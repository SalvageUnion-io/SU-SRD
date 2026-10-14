import { describe, expect, it } from 'bun:test'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { getEntitySchemas, getModel, SalvageUnionReference } from 'salvageunion-reference'
import { getSchemaPreloadList } from '../schemaPreloadDeps'

/**
 * The render-equivalence test draws each card closed, so a catalog choice's
 * "Show options" list, resolved only when opened, never runs there. This
 * holds every catalog a page can open to its preload list: each schema it
 * picks from must be loaded, or the open list comes up empty.
 */

/** Every schema a catalog choice inside `value` picks from. */
function catalogSchemas(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) catalogSchemas(item, out)
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const source = record.source as { kind?: string; schema?: string[] } | undefined
    if (source?.kind === 'catalog') for (const name of source.schema ?? []) out.add(name)
    for (const child of Object.values(record)) catalogSchemas(child, out)
  }
  return out
}

describe('schemaPreloadDeps: catalog choices', () => {
  for (const schema of getEntitySchemas()) {
    const preloadList = getSchemaPreloadList(schema.id)
    if (preloadList === 'all') continue

    it(`${schema.id}: every catalog its pages open is preloaded`, () => {
      const needed = new Set<string>()
      for (const entity of (getModel(schema.id)?.all() ?? []) as SURefMetaEntity[]) {
        catalogSchemas(entity, needed)
        catalogSchemas(SalvageUnionReference.resolveActions(entity) ?? [], needed)
      }
      expect([...needed].filter((name) => !preloadList.includes(name))).toEqual([])
    })
  }
})
