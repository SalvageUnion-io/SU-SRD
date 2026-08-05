import { describe, expect, it } from 'bun:test'
import { getEntitySchemas, getSchemaCatalog } from 'salvageunion-reference'
import { deepLinkTo, hasSRDPage } from '../srd-deep-link'

describe('srd-deep-link', () => {
  it('builds a chassis deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'chassis', slug: 'iron-mongrel' })
    expect(url).toBe('https://salvageunion.io/schema/chassis/item/iron-mongrel')
  })

  it('builds an equipment deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'equipment', slug: 'armor-plating' })
    expect(url).toBe('https://salvageunion.io/schema/equipment/item/armor-plating')
  })

  it('builds an abilities deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'abilities', slug: 'rapid-fire' })
    expect(url).toBe('https://salvageunion.io/schema/abilities/item/rapid-fire')
  })

  it('builds a classes deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'classes', slug: 'scrapyard-scrounger' })
    expect(url).toBe('https://salvageunion.io/schema/classes/item/scrapyard-scrounger')
  })

  it('builds a mech-systems deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'mech-systems', slug: 'comms-array' })
    expect(url).toBe('https://salvageunion.io/schema/mech-systems/item/comms-array')
  })

  it('uses the exact slug provided (no UUID processing)', () => {
    const url = deepLinkTo({ schemaName: 'roll-tables', slug: 'some-slug' })
    expect(url).toContain('some-slug')
    expect(url).not.toContain('uuid')
  })
})

describe('hasSRDPage', () => {
  it('recognizes catalog schemas as having SRD pages', () => {
    expect(hasSRDPage('chassis')).toBe(true)
    expect(hasSRDPage('equipment')).toBe(true)
    expect(hasSRDPage('abilities')).toBe(true)
    expect(hasSRDPage('classes')).toBe(true)
    expect(hasSRDPage('systems')).toBe(true)
    expect(hasSRDPage('modules')).toBe(true)
  })

  it('rejects names outside the schema catalog', () => {
    expect(hasSRDPage('not-a-schema')).toBe(false)
    expect(hasSRDPage('')).toBe(false)
  })

  // srd's getItemStaticPaths generates pages for entity schemas ONLY, so a
  // meta schema has no item page and a "View in SRD →" on one would 404.
  // `actions` is one of the most common entity kinds in play.
  it('rejects meta schemas, which srd never generates item pages for', () => {
    expect(hasSRDPage('actions')).toBe(false)
    expect(hasSRDPage('catalog-categories')).toBe(false)
    expect(hasSRDPage('ability-tree-requirements')).toBe(false)
  })

  it('agrees with the catalog filter srd generates from', () => {
    const metaIds = getSchemaCatalog()
      .schemas.filter((s) => s.meta)
      .map((s) => s.id)
    expect(metaIds.length).toBeGreaterThan(0)
    for (const id of metaIds) expect(hasSRDPage(id)).toBe(false)
    for (const schema of getEntitySchemas()) expect(hasSRDPage(schema.id)).toBe(true)
  })
})
