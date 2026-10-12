import { describe, expect, test } from 'bun:test'
import type { SURefEntity } from 'salvageunion-reference'
import { getPageReference, SalvageUnionReference } from 'salvageunion-reference'
import { chapterOf, defaultGroups, resolveGroupBy } from '../listingGroups'

const need = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}

const rollTables = () => SalvageUnionReference.RollTables.all() as SURefEntity[]
const tableNamed = (name: string) =>
  need(SalvageUnionReference.RollTables.getByName(name), name) as SURefEntity

/**
 * The roll tables listing groups its tables by where the book prints them
 * (Workshop Manual Contents, p. 7), then each supplement under its source.
 */
describe('roll tables by chapter', () => {
  const groups = defaultGroups(rollTables(), [], [], 'roll-tables')

  test('the roll tables group by chapter; other listings keep their own grouping', () => {
    expect(resolveGroupBy(rollTables(), [], [], 'roll-tables')).toBe('chapter')
    expect(resolveGroupBy(rollTables(), [], [], 'keywords')).toBe('none')
  })

  test('the core book’s chapters in its order, then the supplements by name', () => {
    expect(groups.map((group) => group.label)).toEqual([
      'Pilot Bay',
      'Mech Workshop',
      'Union Crawler',
      'Core Rules',
      'Denizens of the Wasteland',
      'False Flag',
      'Reclamation of the Wastes',
      'Relics of a Time Gone By',
      "Thatcher's Mech Base",
      'The Hive',
      'We Were Here First!',
    ])
  })

  test('every table is in exactly one group', () => {
    const grouped = groups.flatMap((group) => group.items.map((item) => item.id))
    expect([...grouped].sort()).toEqual(
      rollTables()
        .map((table) => table.id)
        .sort()
    )
  })

  test('a chapter’s tables are by its pages (Pilot Bay p. 18, Mech Workshop p. 94, Union Crawler p. 212, Core Rules p. 232, Denizens of the Wasteland p. 266)', () => {
    expect(chapterOf(tableNamed('Callsign Table')).label).toBe('Pilot Bay') // p. 88
    expect(chapterOf(tableNamed('Quirks')).label).toBe('Mech Workshop') // p. 208
    expect(chapterOf(tableNamed('Crawler Name')).label).toBe('Union Crawler') // p. 226
    expect(chapterOf(tableNamed('Core Mechanic')).label).toBe('Core Rules') // p. 232
    expect(chapterOf(tableNamed('Reaction Roll')).label).toBe('Denizens of the Wasteland') // p. 268
    expect(chapterOf(tableNamed('Meteor Encounter')).label).toBe('We Were Here First!')
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
