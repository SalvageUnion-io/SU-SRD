/**
 * An encounter table's roster, read (the Workshop Manual's region tables,
 * p.270): every line the books print resolves to something the Mediator can
 * field, but for the weather.
 */

import { describe, expect, test } from 'bun:test'
import { readRosterLine as readLineIn, rosterIndex } from 'game-domain/rules/encounterRoster'
import { SalvageUnionReference } from 'salvageunion-reference'
import { readRoster } from '../encounterRoster.model'
import { OPPOSITION_SCHEMAS } from '../opposition.model'

const index = rosterIndex(OPPOSITION_SCHEMAS.map((s) => s.schema))
const readRosterLine = (text: string) => readLineIn(text, index)

/** Every roster line in the data, with the table and row it is on. */
function everyLine(): { table: string; key: string; line: string }[] {
  return SalvageUnionReference.RollTables.all().flatMap((t) =>
    Object.entries(t.table).flatMap(([key, row]) =>
      typeof row === 'object' && row !== null && 'roster' in row && Array.isArray(row.roster)
        ? row.roster.map((line: string) => ({ table: t.name, key, line }))
        : []
    )
  )
}

describe('the region encounter tables (Workshop Manual pp.270-274)', () => {
  test('ten region tables, each six rows with a roster', () => {
    const encounter = SalvageUnionReference.RollTables.all().filter(
      (t) => t.table.type === 'encounter'
    )
    expect(encounter).toHaveLength(10)
    for (const t of encounter) {
      const rows = Object.entries(t.table).filter(([key]) => key !== 'type')
      expect(rows).toHaveLength(6)
    }
  })

  test('every line names a unit to field, but for the weather', () => {
    const unread = everyLine()
      .filter(({ line }) => readRosterLine(line)?.draw == null)
      .map(({ line }) => line)
    expect(unread).toEqual(['1 × Radiation Storm', '1 × Ice Storm'])
  })

  test('every "X Pattern Y" line is drawn as that pattern', () => {
    const unpatterned = everyLine()
      .filter(({ line }) => line.includes(' Pattern '))
      .filter(({ line }) => !readRosterLine(line)?.draw?.pattern)
    expect(unpatterned).toEqual([])
  })
})

describe('reading a line', () => {
  test('count, host and pattern', () => {
    const line = readRosterLine('2 × Contour Pattern Drop Bear')
    expect(line?.count).toBe(2)
    expect(line?.draw?.schema).toBe('chassis')
    expect(line?.draw?.entity).toMatchObject({ name: 'Drop Bear' })
    expect(line?.draw?.pattern?.name).toBe('Contour')
  })

  test('the book’s shorthand: plurals, a missing hyphen, a host by its last word', () => {
    expect(readRosterLine('3 × Shepherd Pattern Threshers')?.draw?.entity).toMatchObject({
      name: 'Thresher',
    })
    expect(readRosterLine('3 × Ascension Pattern NeuraPhage')?.draw?.entity).toMatchObject({
      name: 'Neura-Phage',
    })
    expect(readRosterLine('2 × Surveyor Pattern Sestra')?.draw?.entity).toMatchObject({
      name: 'Little Sestra',
    })
  })

  test('a d20 count, a Bio-Titan, a drone', () => {
    const artl = readRosterLine('d20 × Wasteland Artl')
    expect(artl?.count).toBe('d20')
    expect(artl?.draw?.entity).toMatchObject({ name: 'Artl' })
    expect(readRosterLine('1 × Scylla Bio-Titan')?.draw?.schema).toBe('bio-titans')
    expect(readRosterLine('2 × Heavy Combat Drone')?.draw?.schema).toBe('drones')
  })

  test('what is no roster line is dropped', () => {
    expect(readRosterLine('Safe travel between the areas.')).toBeNull()
    expect(readRoster(['1 × Waster Mob', 'not a line'])).toHaveLength(1)
  })
})
