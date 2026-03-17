import { describe, expect, it } from 'bun:test'
import { getSchemaCatalog } from 'salvageunion-reference'
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
      // If this fails, add the missing schema IDs to schemaColors in catalogColors.ts
      []
    )
  })
})
