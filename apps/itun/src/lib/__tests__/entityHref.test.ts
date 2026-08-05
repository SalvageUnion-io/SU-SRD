/**
 * ITUN's nested-entity href builder must apply the same `hasSRDPage` guard as
 * `srdEntityExternalLink` — srd generates item pages for entity schemas only,
 * so an unguarded link on a meta-schema entity (an action) renders as a link
 * and 404s.
 */
import { describe, expect, it } from 'bun:test'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../components/__tests__/must'
import { itunEntityHref } from '../entityHref'

/** A complete entity that only differs in the schema it claims to come from. */
function taggedAs(schemaName: string): SURefEntity & { schemaName: string } {
  return {
    id: 'x',
    name: 'Bolster',
    source: 'Salvage Union Workshop Manual',
    page: 1,
    blackMarket: false,
    schemaName,
  }
}

describe('itunEntityHref', () => {
  it('links entities whose schema has an SRD page', () => {
    // ORM entities carry their own `schemaName`, so this is the real shape
    // every card passes to the provider.
    const chassis = must(SalvageUnionReference.Chassis.find((c) => c.name === 'Mule'))
    expect(itunEntityHref(chassis)).toBe('https://salvageunion.io/schema/chassis/item/mule')
  })

  it('emits no href for a meta schema srd never generates pages for', () => {
    expect(itunEntityHref(taggedAs('actions'))).toBeUndefined()
    expect(itunEntityHref(taggedAs('catalog-categories'))).toBeUndefined()
    expect(itunEntityHref(taggedAs('ability-tree-requirements'))).toBeUndefined()
  })

  it('emits no href for a schema outside the catalog, or none at all', () => {
    expect(itunEntityHref(taggedAs('not-a-schema'))).toBeUndefined()
    const untagged: SURefEntity = {
      id: 'x',
      name: 'No Schema',
      source: 'Salvage Union Workshop Manual',
      page: 1,
      blackMarket: false,
    }
    expect(itunEntityHref(untagged)).toBeUndefined()
  })
})
