/**
 * The two-roll columns table's page (Callsign Table): the first d20 picks the
 * column, the second the entry down it. Real SRD data throughout.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { columnsHit, rangeHolds } from '../../../lib/columnsTablePage'
import { recordRoll } from '../../../lib/rollTablePage'
import { ColumnsTableView } from '../../ColumnsTableView'
import { columnsTablePageData, rollTablePageData } from '../../RollTablePage'
import { ColumnsTableIsland } from '../ColumnsTableIsland'

const tableNamed = (name: string) => {
  const table = SalvageUnionReference.RollTables.getByName(name) as SURefEntity | undefined
  if (!table) throw new Error(`fixture missing: ${name}`)
  return table
}
const callsigns = () => {
  const data = columnsTablePageData(tableNamed('Callsign Table'))
  if (!data) throw new Error('fixture missing: Callsign Table data')
  return data
}

/** A die that shows these faces in turn. */
const dice = (...faces: number[]) => {
  let i = 0
  return () => faces[i++ % faces.length] ?? 1
}

describe('the columns table’s data', () => {
  test('Callsign Table has its own page; a banded table does not', () => {
    expect(rollTablePageData(tableNamed('Callsign Table'))).toBeNull()
    expect(callsigns().columns.map((column) => column.key)).toEqual([
      '1-4',
      '5-8',
      '9-12',
      '13-16',
      '17-20',
    ])
    expect(columnsTablePageData(tableNamed('Core Mechanic'))).toBeNull()
  })

  test('a pair of rolls lands on its column, then its entry', () => {
    expect(rangeHolds('9-12', 11)).toBe(true)
    expect(rangeHolds('9-12', 13)).toBe(false)
    expect(columnsHit(callsigns().columns, { column: 11, entry: 7 })?.entry.value).toBe(
      'Silverback'
    )
  })

  test('a new roll pushes the last onto the earlier rolls', () => {
    const first = recordRoll({ roll: null, history: [] }, { column: 1, entry: 1 })
    const second = recordRoll(first, { column: 20, entry: 20 })
    expect(second.roll).toEqual({ column: 20, entry: 20 })
    expect(second.history).toEqual([{ column: 1, entry: 1 }])
  })
})

describe('the columns table’s page', () => {
  test('prints every entry with its numbers on both edges, inert until mounted', () => {
    render(<ColumnsTableView data={callsigns()} state={{ roll: null, history: [] }} />)
    const table = screen.getByRole('table', { name: 'Callsign Table' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7)
    expect(within(table).getByText('Sparkles')).toBeTruthy()
    expect(within(table).getByText('Iceman')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Roll the dice' }).hasAttribute('disabled')).toBe(
      true
    )
  })

  test('Roll reads the callsign in the panel and marks its cell', async () => {
    render(<ColumnsTableIsland data={callsigns()} d20={dice(11, 7)} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the dice' }))
    })
    const panel = screen.getByRole('region', { name: 'You rolled' })
    expect(within(panel).getByText('Silverback')).toBeTruthy()
    expect(within(panel).getByText('Column 11')).toBeTruthy()
    const cell = screen.getByRole('cell', { name: 'Silverback' })
    expect(cell.getAttribute('aria-current')).toBe('true')
  })
})
