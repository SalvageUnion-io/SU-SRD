import { describe, expect, it } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import {
  getEntitySchemas,
  getEntitySlug,
  getSchemaCatalog,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { entityHref, hasPage, itemHref, patternHref, schemaHref } from '../entityHref'
import { ogImagePath } from '../ogCard'

/**
 * These assertions ARE the route contract. The three builders were extracted
 * from eight hand-built copies of the same template literal; if a future edit
 * drops a trailing slash or reorders a segment, every internal link and every
 * canonical URL moves at once — so pin the exact strings here.
 */
describe('srd route grammar', () => {
  it('builds a schema listing href', () => {
    expect(schemaHref('chassis')).toBe('/chassis/')
  })

  it('builds an item show-page href from a SLUG, never a uuid', () => {
    expect(itemHref('chassis', 'iron-mongrel')).toBe('/chassis/iron-mongrel/')
  })

  it('nests a pattern under the item it belongs to', () => {
    expect(patternHref('chassis', 'iron-mongrel', 'mk8')).toBe('/chassis/iron-mongrel/pattern/mk8/')
  })

  it('composes: an item href extends its schema href', () => {
    expect(itemHref('traits', 'reliable').startsWith(schemaHref('traits'))).toBe(true)
    expect(patternHref('chassis', 'atlas', 'mk8').startsWith(itemHref('chassis', 'atlas'))).toBe(
      true
    )
  })

  it('keeps the og:image path a mirror of the page href', () => {
    expect(ogImagePath('classes', 'engineer')).toBe(
      `${itemHref('classes', 'engineer').slice(0, -1)}.og.png`
    )
    expect(ogImagePath('chassis', 'atlas', 'mk8')).toBe(
      `${patternHref('chassis', 'atlas', 'mk8').slice(0, -1)}.og.png`
    )
  })
})

describe('entityHref', () => {
  // A REAL entity off the ORM (preloaded by apps/web/test/preload-reference.ts).
  // A hand-built literal cannot be used here: `schemaName` is stamped on by the
  // ORM, not declared on `RefEntity`, so a fake either fails to typecheck or
  // stops testing the property the builder actually reads.
  const [chassis] = SalvageUnionReference.Chassis.all()
  if (!chassis) throw new Error('reference data was not preloaded')

  it('resolves an entity to its show page via schemaName + slug', () => {
    expect(entityHref(chassis)).toBe(itemHref('chassis', getEntitySlug(chassis)))
  })

  it('returns undefined when the entity carries no schemaName', () => {
    // `schemaName` is NOT part of `RefEntity` — the ORM stamps it on. So a
    // record that never went through the ORM is a real, reachable input here,
    // and the builder must decline it rather than emit `/undefined/...`.
    const { schemaName: _stampedByTheOrm, ...bare } = chassis
    expect(entityHref(bare)).toBeUndefined()
  })

  it('declines a record assembled for display, which has no page', () => {
    // A crawler bay's commander: its bay's embedded `npc` object, dressed as an
    // `npcs` entity by `resolveNestedEntities`. It has no `id` and no page, so
    // a name-built link (`/npcs/princeps/`) would 404.
    const bay = SalvageUnionReference.CrawlerBays.all().find((b) => 'npc' in b && b.npc)
    if (!bay || !('npc' in bay) || !bay.npc) throw new Error('no crawler bay carries an npc')
    // Built exactly as `resolveNestedEntities` builds it, cast included.
    const commander = {
      ...bay.npc,
      name: 'position' in bay.npc ? bay.npc.position : 'NPC',
      schemaName: 'npcs',
    } as unknown as RefEntity
    expect(entityHref(commander)).toBeUndefined()
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

describe('hasPage', () => {
  it('agrees with the catalog filter the pages are generated from', () => {
    const metaIds = getSchemaCatalog()
      .schemas.filter((s) => s.meta)
      .map((s) => s.id)
    expect(metaIds.length).toBeGreaterThan(0)
    for (const id of metaIds) expect(hasPage(id)).toBe(false)
    for (const schema of getEntitySchemas()) expect(hasPage(schema.id)).toBe(true)
  })

  it('rejects names outside the schema catalog', () => {
    expect(hasPage('not-a-schema')).toBe(false)
    expect(hasPage('')).toBe(false)
  })

  // A meta schema has no item page, so a link on one (an action, among the
  // most common entities in play) would 404.
  it('keeps entityHref off a meta schema or an unknown one', () => {
    expect(entityHref(taggedAs('chassis'))).toBe('/chassis/bolster/')
    expect(entityHref(taggedAs('actions'))).toBeUndefined()
    expect(entityHref(taggedAs('catalog-categories'))).toBeUndefined()
    expect(entityHref(taggedAs('ability-tree-requirements'))).toBeUndefined()
    expect(entityHref(taggedAs('not-a-schema'))).toBeUndefined()
  })
})
