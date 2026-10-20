/**
 * The two-roll columns table's page (Callsign Table): the first d20 picks the
 * column, the second the entry down it. Real SRD data throughout.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { columnsAnnouncement, columnsHit, rangeHolds } from '../../../lib/columnsTablePage'
import { columnsTablePageData, rollTablePageData } from '../../../lib/rollTablePageData'
import { ColumnsTableView } from '../../ColumnsTableView'
import { ColumnsTableIsland } from '../ColumnsTableIsland'

const tableNamed = (name: string) => {
  const table = SalvageUnionReference.RollTables.getByName(name) as RefEntity | undefined
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

  test('a pair of rolls reads as its toast: the entry’s die, its column, the callsign', () => {
    expect(columnsAnnouncement(callsigns(), { column: 11, entry: 7 })).toEqual({
      table: 'Callsign Table',
      roll: 7,
      range: 'column 9–12',
      text: 'Silverback',
    })
    expect(columnsAnnouncement(callsigns(), { column: 11, entry: 99 })).toBeUndefined()
  })
})

describe('the columns table’s page', () => {
  test('prints every entry with its numbers on both edges, inert until mounted', () => {
    render(<ColumnsTableView data={callsigns()} roll={null} />)
    const table = screen.getByRole('table', { name: 'Callsign Table' })
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7)
    expect(within(table).getByText('Sparkles')).toBeTruthy()
    expect(within(table).getByText('Iceman')).toBeTruthy()
    // No dead button: before the island mounts the stamp is a plain label.
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Roll the Dice:').tagName).toBe('SPAN')
  })

  test('its Roll the Dice button is its one roll control', () => {
    render(<ColumnsTableIsland data={callsigns()} d20={dice(11, 7)} />)
    const controls = screen.getAllByRole('button')
    expect(controls).toHaveLength(1)
    expect(controls[0]?.getAttribute('aria-label')).toBe('Roll the dice on Callsign Table')
  })

  test('the button raises the callsign as a toast and marks its cell', async () => {
    render(<ColumnsTableIsland data={callsigns()} d20={dice(11, 7)} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the dice on Callsign Table' }))
    })
    const title = await screen.findByText('Callsign Table: rolled 7 (column 9–12)')
    const toast = title.closest('[data-sonner-toast]')
    expect(toast?.querySelector('[data-description]')?.textContent).toBe('Silverback')
    const cell = screen.getByRole('cell', { name: 'Silverback' })
    expect(cell.getAttribute('aria-current')).toBe('true')
    // The narrow stack marks the same entry and its column's head.
    const stacked = screen.getByRole('region', { name: 'Callsign Table, column 9–12' })
    const entry = within(stacked).getByText('Silverback').closest('li')
    expect(entry?.getAttribute('aria-current')).toBe('true')
    expect(stacked.querySelector('.su-roll__stack-head')?.hasAttribute('data-rolled')).toBe(true)
    expect(screen.queryByRole('region', { name: 'You rolled' })).toBeNull()
  })

  test('a narrow frame stacks each column, its entries two up', () => {
    render(<ColumnsTableView data={callsigns()} roll={null} />)
    const columns = screen.getAllByRole('region', { name: /^Callsign Table, column / })
    expect(columns).toHaveLength(5)
    const first = within(columns[0] as HTMLElement).getAllByRole('listitem')
    expect(first).toHaveLength(20)
    // Entry 11 heads the right half, level with entry 1.
    expect(first[10]?.getAttribute('data-side')).toBe('right')
    expect(first[9]?.hasAttribute('data-side')).toBe(false)
  })
})
