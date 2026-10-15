/**
 * The Cantina's nested-entity href builder must apply the same `hasSRDPage` guard as
 * `srdEntityExternalLink` — srd generates item pages for entity schemas only,
 * so an unguarded link on a meta-schema entity (an action) renders as a link
 * and 404s.
 */
import { describe, expect, it } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../components/__tests__/must'
import { cantinaEntityHref } from '../entityHref'

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

describe('cantinaEntityHref', () => {
  it('links entities whose schema has an SRD page', () => {
    // ORM entities carry their own `schemaName`, so this is the real shape
    // every card passes to the provider.
    const chassis = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(cantinaEntityHref(chassis)).toBe('https://salvageunion.io/chassis/mule')
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
