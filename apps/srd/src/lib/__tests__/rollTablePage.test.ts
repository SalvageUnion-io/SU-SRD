import { describe, expect, test } from 'bun:test'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { rollTablePageData } from '../../components/RollTablePage'
import type { RollTableRow } from '../rollTablePage'
import {
  outcomeLabel,
  plainText,
  rangeLabel,
  recordRoll,
  refText,
  rollTableDensity,
  rowForRoll,
  splitRows,
} from '../rollTablePage'

const need = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}

const tableNamed = (name: string) =>
  need(SalvageUnionReference.RollTables.getByName(name), name) as SURefEntity
const firstOfType = (type: string) =>
  need(
    SalvageUnionReference.RollTables.all().find((t) => t.table.type === type),
    `a ${type} table`
  ) as SURefEntity

describe('refText', () => {
  test('a band’s trait markup becomes references, resolved where the trait exists', () => {
    const vulnerable = {
      schemaName: 'traits' as const,
      id: 'vulnerable-id',
      slug: 'vulnerable',
      name: 'Vulnerable',
    }
    const resolve = (name: string) => (name === 'Vulnerable' ? vulnerable : null)
    const parts = refText('It gains the [[Vulnerable]] Trait and [[[Burn](X)]].', resolve)
    expect(parts).toEqual([
      'It gains the ',
      { text: 'Vulnerable', ref: vulnerable },
      ' Trait and ',
      { text: 'Burn (X)', ref: null },
      '.',
    ])
    expect(plainText(parts)).toBe('It gains the Vulnerable Trait and Burn (X).')
  })
})

describe('splitRows', () => {
  const rowsOf = (name: string) => need(rollTablePageData(tableNamed(name)) ?? undefined, name).rows

  test('a long or wordy table splits in two; a short one stays one column', () => {
    expect(splitRows(rowsOf('Mechapult'))).toBe(true)
    expect(splitRows(rowsOf('Motto'))).toBe(true)
    expect(splitRows(rowsOf('Crawler Destruction'))).toBe(true)
    expect(splitRows(rowsOf('Core Mechanic'))).toBe(false)
  })
})

describe('rollTableDensity', () => {
  const densityOf = (name: string) => {
    const data = need(rollTablePageData(tableNamed(name)) ?? undefined, name)
    return rollTableDensity(data.rows, data.description)
  }
  const row = (label: string | null, value: string): RollTableRow => ({
    key: '1',
    label,
    value: [value],
  })

  test('bands that run long even in two columns set dense', () => {
    expect(densityOf('Mechapult')).toBe('dense')
    expect(densityOf('Anomalous Zone')).toBe('dense')
    expect(densityOf('Background')).toBe('dense')
  })

  test('a split table, or a long note over short bands, sets compact', () => {
    expect(densityOf('Motto')).toBe('compact')
    expect(densityOf('Crawler Destruction')).toBe('compact')
    expect(densityOf('Morale')).toBe('compact')
  })

  test('a short table under a short note keeps the board’s setting', () => {
    expect(densityOf('Area Salvage')).toBe('roomy')
  })

  test('labels count toward the bands, and the note toward compact only', () => {
    const bands = [row('x'.repeat(900), 'y'.repeat(900))]
    expect(rollTableDensity(bands, [])).toBe('dense')
    const short = [row(null, 'y'.repeat(600))]
    expect(rollTableDensity(short, [])).toBe('roomy')
    expect(rollTableDensity(short, ['z'.repeat(600)])).toBe('compact')
    expect(rollTableDensity(short, ['z'.repeat(5000)])).toBe('compact')
  })
})

describe('rollTablePageData', () => {
  test('the Core Mechanic: its prose and its five bands, highest first', () => {
    const data = need(rollTablePageData(tableNamed('Core Mechanic')) ?? undefined, 'data')
    expect(data.name).toBe('Core Mechanic')
    expect(data.description.length).toBeGreaterThan(0)
    expect(data.rows.map((row) => row.key)).toEqual(['20', '11-19', '6-10', '2-5', '1'])
    expect(data.rows[1]?.label).toBe('Success')
  })

  test('a two-roll columns table keeps the card’s view', () => {
    expect(rollTablePageData(firstOfType('columns'))).toBeNull()
  })

  test('anything that is not a roll table has no roll page', () => {
    const chassis = need(SalvageUnionReference.Chassis.getByName('Gopher'), 'gopher')
    expect(rollTablePageData(chassis)).toBeNull()
  })
})

describe('rowForRoll', () => {
  const data = need(rollTablePageData(tableNamed('Core Mechanic')) ?? undefined, 'data')

  test('a roll lands on the band whose range holds it', () => {
    expect(rowForRoll(data.table, data.rows, 14)?.key).toBe('11-19')
    expect(rowForRoll(data.table, data.rows, 20)?.label).toBe('Nailed it')
    expect(rowForRoll(data.table, data.rows, 1)?.label).toBe('Cascade Failure')
  })

  test('a table that prints only its 20 has no row for anything else', () => {
    const dramatic = need(rollTablePageData(firstOfType('dramatic')) ?? undefined, 'dramatic')
    expect(rowForRoll(dramatic.table, dramatic.rows, 20)?.key).toBe('20')
    expect(rowForRoll(dramatic.table, dramatic.rows, 5)).toBeUndefined()
  })
})

describe('outcomeLabel — the earlier rolls', () => {
  test('a table with no row labels reads "Roll N" for a hit, not a miss', () => {
    const data = need(rollTablePageData(tableNamed('Crawler Damage')) ?? undefined, 'data')
    expect(data.rows.some((row) => row.label === null)).toBe(true)
    for (const roll of [9, 13, 15]) {
      const row = rowForRoll(data.table, data.rows, roll)
      expect(row).toBeDefined()
      if (row?.label === null)
        expect(outcomeLabel(data.table, data.rows, roll)).toBe(`Roll ${roll}`)
    }
  })

  test('a labelled row reads its label; a roll with no row reads "No effect"', () => {
    const core = need(rollTablePageData(tableNamed('Core Mechanic')) ?? undefined, 'core')
    expect(outcomeLabel(core.table, core.rows, 20)).toBe('Nailed it')
    const dramatic = need(rollTablePageData(firstOfType('dramatic')) ?? undefined, 'dramatic')
    expect(outcomeLabel(dramatic.table, dramatic.rows, 5)).toBe('No effect')
  })
})

describe('the roll log', () => {
  test('a new roll pushes the previous one onto the earlier rolls, newest first', () => {
    let state = recordRoll({ roll: null, history: [] }, 7)
    expect(state).toEqual({ roll: 7, history: [] })
    state = recordRoll(state, 20)
    state = recordRoll(state, 3)
    expect(state).toEqual({ roll: 3, history: [20, 7] })
  })

  test('keeps the last five earlier rolls', () => {
    let state = { roll: null as number | null, history: [] as number[] }
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) state = recordRoll(state, n)
    expect(state.history).toEqual([7, 6, 5, 4, 3])
  })
})

describe('reading the page', () => {
  test('a range reads with an en dash, as the book sets it', () => {
    expect(rangeLabel('11-19')).toBe('11–19')
    expect(rangeLabel('20')).toBe('20')
  })
})
