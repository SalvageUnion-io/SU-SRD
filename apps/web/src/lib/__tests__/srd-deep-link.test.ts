import { describe, expect, it } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { getEntitySchemas, getSchemaCatalog, SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../components/__tests__/must'
import { cantinaEntityHref, deepLinkTo, deepLinkToSchema, hasSRDPage } from '../srd-deep-link'
import { srdOrigin } from '../srdOrigin'

describe('srd-deep-link', () => {
  it('builds a chassis deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'chassis', slug: 'iron-mongrel' })
    expect(url).toBe(`${srdOrigin()}/chassis/iron-mongrel/`)
  })

  it('builds an equipment deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'equipment', slug: 'armor-plating' })
    expect(url).toBe(`${srdOrigin()}/equipment/armor-plating/`)
  })

  it('builds an abilities deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'abilities', slug: 'rapid-fire' })
    expect(url).toBe(`${srdOrigin()}/abilities/rapid-fire/`)
  })

  it('builds a classes deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'classes', slug: 'scrapyard-scrounger' })
    expect(url).toBe(`${srdOrigin()}/classes/scrapyard-scrounger/`)
  })

  it('builds a mech-systems deep-link URL', () => {
    const url = deepLinkTo({ schemaName: 'mech-systems', slug: 'comms-array' })
    expect(url).toBe(`${srdOrigin()}/mech-systems/comms-array/`)
  })

  it('builds a category deep-link URL', () => {
    expect(deepLinkToSchema('chassis')).toBe(`${srdOrigin()}/chassis/`)
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
  // meta schema has no item page and a "View in SRD" on one would 404.
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

/** A complete entity that only differs in the schema it claims to come from. */
function taggedAs(schemaName: string): RefEntity & { schemaName: string } {
  return {
    id: 'x',
    name: 'Bolster',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    blackMarket: false,
    schemaName,
  }
}

/**
 * The nested-entity href builder applies the same `hasSRDPage` guard as
 * `srdEntityExternalLink`: an unguarded link on a meta-schema entity (an
 * action) renders as a link and 404s.
 */
describe('cantinaEntityHref', () => {
  it('links entities whose schema has an SRD page', () => {
    // ORM entities carry their own `schemaName`, so this is the real shape
    // every card passes to the provider.
    const chassis = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(cantinaEntityHref(chassis)).toBe(`${srdOrigin()}/chassis/mule/`)
  })

  it('emits no href for a meta schema srd never generates pages for', () => {
    expect(cantinaEntityHref(taggedAs('actions'))).toBeUndefined()
    expect(cantinaEntityHref(taggedAs('catalog-categories'))).toBeUndefined()
    expect(cantinaEntityHref(taggedAs('ability-tree-requirements'))).toBeUndefined()
  })

  it('emits no href for a schema outside the catalog, or none at all', () => {
    expect(cantinaEntityHref(taggedAs('not-a-schema'))).toBeUndefined()
    const untagged: RefEntity = {
      id: 'x',
      name: 'No Schema',
      source: 'Salvage Union Workshop Manual',
      page: 1,
      blackMarket: false,
    }
    expect(cantinaEntityHref(untagged)).toBeUndefined()
  })
})
