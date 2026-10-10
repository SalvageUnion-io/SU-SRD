import { describe, expect, test } from 'bun:test'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { rollTablePageData } from '../../components/RollTablePage'
import { parseTypedRoll, rangeLabel, recordRoll, rowForRoll } from '../rollTablePage'

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

  test('a typed roll is a whole number a d20 can show', () => {
    expect(parseTypedRoll(' 14 ')).toBe(14)
    expect(parseTypedRoll('0')).toBeUndefined()
    expect(parseTypedRoll('21')).toBeUndefined()
    expect(parseTypedRoll('3.5')).toBeUndefined()
    expect(parseTypedRoll('')).toBeUndefined()
  })
})
