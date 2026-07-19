import { describe, expect, it } from 'bun:test'
import { getSchemaCatalog, SalvageUnionReference } from 'salvageunion-reference'
import { resolveSchemaDomain } from 'component-lib'
import { getCatalogBg } from '../catalogColors'

const FALLBACK_COLOR = 'var(--color-su-orange)'

describe('getCatalogBg', () => {
  it('returns a non-fallback color for every non-meta schema', () => {
    const { schemas } = getSchemaCatalog()
    const nonMetaSchemas = schemas.filter((s) => !s.meta)

    expect(nonMetaSchemas.length).toBeGreaterThan(0)

    const missing: string[] = []
    for (const schema of nonMetaSchemas) {
      const color = getCatalogBg(schema.id)
      if (color === FALLBACK_COLOR) {
        missing.push(schema.id)
      }
    }

    expect(missing).toEqual(
      // If this fails, the schema has no domain in component-lib's SCHEMA_DOMAIN
      // — declare it there (the card resolves its tone from the same map).
      []
    )
  })

  it('derives its colour from the canonical schema domain, not a local list', () => {
    const { schemas } = getSchemaCatalog()
    // Every non-meta schema must resolve to a domain in component-lib. A schema
    // the map doesn't know would fall back to pilot-orange here AND mis-tone its
    // card — the drift this indirection exists to prevent.
    const undomained = schemas
      .filter((s) => !s.meta)
      .map((s) => s.id)
      .filter((id) => resolveSchemaDomain(id) === undefined)

    expect(undomained).toEqual([])
  })
})

describe('catalog category coverage', () => {
  it('lists every non-meta schema under exactly one catalog category', () => {
    const { schemas } = getSchemaCatalog()
    const nonMetaIds = new Set(schemas.filter((s) => !s.meta).map((s) => s.id))
    const categories = SalvageUnionReference.CatalogCategories.all()

    const placements = new Map<string, string[]>()
    for (const cat of categories) {
      for (const id of cat.schemas) {
        const list = placements.get(id) ?? []
        list.push(cat.id)
        placements.set(id, list)
      }
    }

    const missing = [...nonMetaIds].filter((id) => !placements.has(id))
    const duplicated = [...placements.entries()].filter(([, cats]) => cats.length > 1)

    expect(missing).toEqual(
      // If this fails, add the missing schema IDs to data/catalog-categories.json
      []
    )
    expect(duplicated).toEqual([])
  })
})
