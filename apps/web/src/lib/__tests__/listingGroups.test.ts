import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { getPageReference, getSource, SalvageUnionReference } from 'salvageunion-reference'
import { listingEntries } from '../listingEntries'
import { defaultGroups, resolveGroupBy } from '../listingGroups'

const rollTables = () => SalvageUnionReference.RollTables.all() as RefEntity[]
const listed = () => listingEntries('roll-tables', rollTables())

/**
 * The roll-table listing lists its top-level tables (`listingEntries`) by the
 * book each comes from: the core book's first, then each supplement's.
 */
describe('roll tables by source', () => {
  const groups = defaultGroups(listed(), [], [], 'roll-tables')

  test('the roll tables group by source; other listings keep their own grouping', () => {
    expect(resolveGroupBy(listed(), [], [], 'roll-tables')).toBe('source')
    expect(resolveGroupBy(rollTables(), [], [], 'keywords')).toBe('none')
  })

  test('the core book under its cite name, then the supplements by name, each with its tables', () => {
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Workshop Manual', 22],
      ['False Flag', 4],
      ['Reclamation of the Wastes', 11],
      ['Relics of a Time Gone By', 2],
      ["Thatcher's Mech Base", 1],
      ['The Hive', 2],
      ['We Were Here First!', 9],
    ])
  })

  test('every listed table is in exactly one group, under its own book', () => {
    const grouped = groups.flatMap((group) => group.items.map((item) => item.id))
    expect([...grouped].sort()).toEqual(
      listed()
        .map((table) => table.id)
        .sort()
    )
    for (const group of groups)
      for (const item of group.items) expect(group.key).toBe(`source:${getSource(item)}`)
  })

  test('within a group, the book’s order: by page', () => {
    for (const group of groups) {
      const pages = group.items.map((item) => getPageReference(item) ?? 0)
      expect(pages).toEqual([...pages].sort((a, b) => a - b))
    }
  })
})

describe('crawler bay listing groups', () => {
  test('groups the bays into Standard, then Expansion', () => {
    const groups = defaultGroups(SalvageUnionReference.CrawlerBays.all(), [], [5], 'crawler-bays')
    expect(groups.map((group) => [group.label, group.items.length])).toEqual([
      ['Standard Bays', 10],
      ['Expansion Bays', 4],
    ])
    expect(groups[0]?.items.map((bay) => bay.name)).toContain('Med Bay')
  })
})
