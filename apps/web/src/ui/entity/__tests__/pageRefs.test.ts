/**
 * Page references: a "p. N" resolves to the entity on that page the prose just
 * named (its kind's noun breaking a tie), else the one guide starting there,
 * else nothing.
 */
import { describe, expect, test } from 'bun:test'
import type { EntityRef, EntitySchemaName } from 'salvageunion-reference'
import type { PageRefIndex } from '../pageRefs'
import { findPageRefs, resolvePageRef } from '../pageRefs'

const ref = (schemaName: EntitySchemaName, name: string): EntityRef => ({
  schemaName,
  id: `${schemaName}-${name}`,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
})

// The Workshop Manual's p. 248, 249, 212 and 172, as the SRD indexes them.
const index: PageRefIndex = {
  172: [
    { ref: ref('systems', 'Torpedo Tubes'), noun: 'system' },
    { ref: ref('systems', 'Welding Laser'), noun: 'system' },
  ],
  212: [{ ref: ref('guides', 'Create a Crawler'), noun: 'guide', guide: true }],
  248: [
    { ref: ref('roll-tables', 'Area Salvage'), noun: 'roll table' },
    { ref: ref('abilities', 'Area Salvage'), noun: 'ability' },
  ],
  249: [
    { ref: ref('abilities', 'Mount'), noun: 'ability' },
    { ref: ref('abilities', 'Patch Up'), noun: 'ability' },
  ],
}

describe('findPageRefs', () => {
  test('finds "p. N" and "p.N", not a word ending in p', () => {
    const text = 'roll on the table p. 235, as in step. 4 (see p.181)'
    expect(findPageRefs(text).map((m) => [m.page, text.slice(m.start, m.end)])).toEqual([
      [235, 'p. 235'],
      [181, 'p.181'],
    ])
  })
})

describe('resolvePageRef', () => {
  test('the entity the prose names', () => {
    expect(resolvePageRef(index, 172, 'For example, the Welding Laser System (see ')?.name).toBe(
      'Welding Laser'
    )
  })

  test("a same-named entity of the cited kind wins ('… Ability')", () => {
    expect(resolvePageRef(index, 248, 'The Area Salvage Ability on ')?.schemaName).toBe('abilities')
    expect(resolvePageRef(index, 248, 'roll on the Area Salvage Table, ')?.schemaName).toBe(
      'roll-tables'
    )
  })

  test('a name matches whole words only ("Mount" is not in "amount")', () => {
    expect(resolvePageRef(index, 249, 'an amount of SP (see ')).toBeUndefined()
    expect(resolvePageRef(index, 249, 'use the Patch Up Ability to restore SP (see ')?.name).toBe(
      'Patch Up'
    )
  })

  test('else the one guide starting on the page', () => {
    expect(
      resolvePageRef(index, 212, 'Full details on The Union Crawler can be found on ')?.name
    ).toBe('Create a Crawler')
  })

  test('else nothing: an unnamed page with no guide stays text', () => {
    expect(resolvePageRef(index, 172, 'The System list can be found on ')).toBeUndefined()
    expect(resolvePageRef(index, 24, 'Make a copy of the Character Sheet on ')).toBeUndefined()
  })
})
