import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { rollTablePageData } from '../../RollTablePage'
import { RollTableView } from '../../RollTableView'
import { RollTableIsland } from '../RollTableIsland'

const coreMechanic = () => {
  const table = SalvageUnionReference.RollTables.getByName('Core Mechanic') as
    | SURefEntity
    | undefined
  const data = table ? rollTablePageData(table) : null
  if (!data) throw new Error('fixture missing: Core Mechanic')
  return data
}

/** A die that shows these faces in turn. */
const dice = (...faces: number[]) => {
  let i = 0
  return () => faces[i++ % faces.length] ?? 1
}

describe('the roll-table page, before a roll (the server markup)', () => {
  test('prints every band for a crawler, under the ROLL THE DIE stamp', () => {
    const data = coreMechanic()
    render(<RollTableView data={data} state={{ roll: null, history: [] }} />)
    expect(screen.getByText('Roll the die:')).toBeTruthy()
    const table = screen.getByRole('list', { name: 'Core Mechanic table' })
    expect(within(table).getAllByRole('listitem')).toHaveLength(data.rows.length)
    expect(within(table).getByText('11–19')).toBeTruthy()
  })

  test('its controls are inert until the island mounts', () => {
    render(<RollTableView data={coreMechanic()} state={{ roll: null, history: [] }} />)
    expect(screen.getByRole('button', { name: 'Roll the die' }).hasAttribute('disabled')).toBe(true)
  })

  test('credits Randsum at the panel’s foot', () => {
    render(<RollTableView data={coreMechanic()} state={{ roll: null, history: [] }} />)
    const credit = screen.getByRole('link', { name: 'Randsum.dev' })
    expect(credit.getAttribute('href')).toBe('https://randsum.dev')
  })
})

describe('RollTableIsland', () => {
  test('Roll reads the result in the panel and marks the row it lands on', () => {
    render(<RollTableIsland data={coreMechanic()} rollD20={dice(14)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }))

    const panel = screen.getByRole('region', { name: 'You rolled' })
    expect(within(panel).getByText('14')).toBeTruthy()
    expect(within(panel).getByText('Success')).toBeTruthy()
    expect(within(panel).getByText('11–19')).toBeTruthy()

    const rolled = screen.getByText('Rolled 14').closest('li')
    expect(rolled?.getAttribute('aria-current')).toBe('true')
    expect(rolled?.textContent).toContain('Success')
  })

  test('Roll again keeps the earlier rolls, newest first', () => {
    render(<RollTableIsland data={coreMechanic()} rollD20={dice(7, 20, 3)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roll again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Roll again' }))

    const earlier = screen.getByRole('heading', { name: 'Earlier rolls' }).parentElement
    const items = within(earlier as HTMLElement).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['20Nailed it', '7Tough Choice'])
  })

  test('a roll made with real dice is recorded when the field is left', () => {
    render(<RollTableIsland data={coreMechanic()} rollD20={dice(14)} />)
    const field = screen.getByLabelText('Rolled real dice?')
    fireEvent.change(field, { target: { value: '1' } })
    fireEvent.blur(field)
    expect(screen.getByText('Rolled 1')).toBeTruthy()
    expect(screen.getAllByText('Cascade Failure').length).toBeGreaterThan(0)
  })

  test('a typed roll no d20 can show is ignored', () => {
    render(<RollTableIsland data={coreMechanic()} rollD20={dice(14)} />)
    const field = screen.getByLabelText('Rolled real dice?')
    fireEvent.change(field, { target: { value: '25' } })
    fireEvent.blur(field)
    expect(screen.queryByText(/^Rolled \d+$/)).toBeNull()
  })
})
