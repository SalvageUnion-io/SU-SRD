import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference, getEntitySlug } from 'salvageunion-reference'
import { itemHref, patternHref, schemaHref, srdEntityHref } from '../entityHref'
import { ogImagePath } from '../ogCard'

/**
 * These assertions ARE the route contract. The three builders were extracted
 * from eight hand-built copies of the same template literal; if a future edit
 * drops a trailing slash or reorders a segment, every internal link and every
 * canonical URL moves at once — so pin the exact strings here.
 */
describe('srd route grammar', () => {
  it('builds a schema listing href', () => {
    expect(schemaHref('chassis')).toBe('/schema/chassis/')
  })

  it('builds an item show-page href from a SLUG, never a uuid', () => {
    expect(itemHref('chassis', 'iron-mongrel')).toBe('/schema/chassis/item/iron-mongrel/')
  })

  it('nests a pattern under the item it belongs to', () => {
    expect(patternHref('chassis', 'iron-mongrel', 'mk8')).toBe(
      '/schema/chassis/item/iron-mongrel/pattern/mk8/'
    )
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

describe('srdEntityHref', () => {
  // A REAL entity off the ORM (preloaded by apps/srd/test/preload-reference.ts).
  // A hand-built literal cannot be used here: `schemaName` is stamped on by the
  // ORM, not declared on `SURefEntity`, so a fake either fails to typecheck or
  // stops testing the property the builder actually reads.
  const [chassis] = SalvageUnionReference.Chassis.all()
  if (!chassis) throw new Error('reference data was not preloaded')

  it('resolves an entity to its show page via schemaName + slug', () => {
    expect(srdEntityHref(chassis)).toBe(itemHref('chassis', getEntitySlug(chassis)))
  })

  it('returns undefined when the entity carries no schemaName', () => {
    // `schemaName` is NOT part of `SURefEntity` — the ORM stamps it on. So a
    // record that never went through the ORM is a real, reachable input here,
    // and the builder must decline it rather than emit `/schema/undefined/...`.
    const { schemaName: _stampedByTheOrm, ...bare } = chassis
    expect(srdEntityHref(bare)).toBeUndefined()
  })
})
