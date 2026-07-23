/**
 * Static-path generation (audit item 5): item pages exist ONLY for entity
 * (non-meta) schemas. Meta schemas (actions, ability-tree-requirements,
 * catalog-categories) have no /schema/<id>/ listing page, so item pages for
 * them would be sitemap orphans whose breadcrumbs 404.
 */
import { describe, expect, it } from 'bun:test'

import { getSchemaCatalog } from '../gameData'
import { getItemStaticPaths, getSchemaStaticPaths } from '../staticPaths'

describe('getItemStaticPaths', () => {
  const itemPaths = getItemStaticPaths()
  const schemaPaths = getSchemaStaticPaths()

  it('emits no item pages for meta schemas', () => {
    const metaIds = new Set(
      getSchemaCatalog()
        .schemas.filter((s) => s.meta)
        .map((s) => s.id)
    )
    expect(metaIds.size).toBeGreaterThan(0)
    const offenders = itemPaths.filter((p) => metaIds.has(p.params.schemaId))
    expect(offenders).toHaveLength(0)
  })

  it('every item page has a parent schema listing page (no orphan breadcrumbs)', () => {
    const listedSchemaIds = new Set(schemaPaths.map((p) => p.params.schemaId))
    const orphans = itemPaths.filter((p) => !listedSchemaIds.has(p.params.schemaId))
    expect(orphans).toHaveLength(0)
  })

  it('still emits item pages for every entity schema with data', () => {
    const itemSchemaIds = new Set(itemPaths.map((p) => p.params.schemaId))
    // Spot-check the big entity schemas are all present.
    for (const id of ['chassis', 'systems', 'modules', 'equipment', 'roll-tables']) {
      expect(itemSchemaIds.has(id)).toBe(true)
    }
  })
})
