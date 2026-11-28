import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { firstParagraphText, SalvageUnionReference } from 'salvageunion-reference'
import { listingEntries } from '../listingEntries'

const rollTables = () => SalvageUnionReference.RollTables.all() as RefEntity[]

describe('listingEntries', () => {
  test('a listing lists every entry of its schema', () => {
    const keywords = SalvageUnionReference.Keywords.all() as RefEntity[]
    expect(listingEntries('keywords', keywords)).toBe(keywords)
  })

  test('the roll tables list their top-level tables, not the ones an entry prints', () => {
    const names = listingEntries('roll-tables', rollTables()).map((table) => table.name)
    expect(names).toHaveLength(64)
    expect(names).toContain('Core Mechanic')
    expect(names).not.toContain('Mechapult') // a System's own roll
    expect(names).not.toContain('Trading Bay') // a crawler bay's
  })

  test('the equipment index leaves out granted-only gear; its pages stay (R63)', () => {
    const equipment = SalvageUnionReference.Equipment.all() as RefEntity[]
    const names = listingEntries('equipment', equipment).map((item) => item.name)
    expect(names).toContain('First Aid Kit')
    expect(names).not.toContain('Camo Suit')
    expect(names).not.toContain('Mecha Companion')
    expect(names).toHaveLength(equipment.length - 13)
    expect(SalvageUnionReference.Equipment.getByName('Camo Suit')).toBeDefined()
  })

  test('every listed table leads with a description', () => {
    const bare = listingEntries('roll-tables', rollTables()).filter(
      (table) => !firstParagraphText('content' in table ? table.content : undefined)
    )
    expect(bare.map((table) => table.name)).toEqual([])
  })
})
