import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

/** A die that shows these faces in turn, served the way `dieForTable` serves one. */
const dice = (...faces: number[]) => {
  let i = 0
  const die = () => faces[i++ % faces.length] ?? 1
  return async () => die
}

/** The table's one roll control: its ROLL THE DIE stamp. */
const STAMP = 'Roll the die on Core Mechanic'

/** Press the stamp and let the (async) die land. */
async function roll(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: STAMP }))
  })
}

describe('the roll-table page, before a roll (the server markup)', () => {
  test('prints every band for a crawler, under the ROLL THE DIE stamp', () => {
    const data = coreMechanic()
    render(<RollTableView data={data} state={{ roll: null, history: [] }} />)
    expect(screen.getByText('Roll the Die:')).toBeTruthy()
    const table = screen.getByRole('list', { name: 'Core Mechanic table' })
    expect(within(table).getAllByRole('listitem')).toHaveLength(data.rows.length)
    expect(within(table).getByText('11–19')).toBeTruthy()
  })

  test('is the shared instrument, banded in the page’s tone', () => {
    render(
      <RollTableView
        data={coreMechanic()}
        tone="var(--color-wk-line)"
        state={{ roll: null, history: [] }}
      />
    )
    const table = screen.getByRole('list', { name: 'Core Mechanic table' })
    const instrument = table.closest('.su-roll') as HTMLElement
    expect(instrument.style.getPropertyValue('--su-roll-band')).toBe(
      'color-mix(in srgb, var(--color-wk-line) 25%, var(--color-paper))'
    )
    const fills = within(table)
      .getAllByRole('listitem')
      .map((row) => row.style.backgroundColor)
    expect(fills.slice(0, 2)).toEqual(['var(--color-paper)', 'var(--su-roll-band)'])
  })

  test('has no button until the island mounts: the stamp is a plain label', () => {
    render(<RollTableView data={coreMechanic()} state={{ roll: null, history: [] }} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Roll the Die:').tagName).toBe('SPAN')
  })

  test('a dense table splits in two, ranges outside, and sets the page dense', () => {
    const table = SalvageUnionReference.RollTables.getByName('Mechapult') as SURefEntity | undefined
    const data = table ? rollTablePageData(table) : null
    if (!data) throw new Error('fixture missing: Mechapult')
    const { container } = render(<RollTableView data={data} state={{ roll: null, history: [] }} />)
    expect(container.querySelector('.srd-roll')?.getAttribute('data-density')).toBe('dense')
    const left = screen.getByRole('list', { name: 'Mechapult table' })
    const right = screen.getByRole('list', { name: 'Mechapult table, continued' })
    expect(right.getAttribute('data-side')).toBe('right')
    expect(within(left).getAllByRole('listitem')).toHaveLength(10)
    expect(within(right).getAllByRole('listitem')).toHaveLength(10)
  })

  test('a short table stays one column at the board’s setting', () => {
    const { container } = render(
      <RollTableView data={coreMechanic()} state={{ roll: null, history: [] }} />
    )
    expect(container.querySelector('.srd-roll')?.getAttribute('data-density')).toBe('roomy')
    expect(screen.getAllByRole('list', { name: /^Core Mechanic table/ })).toHaveLength(1)
  })

  test('credits Randsum at the panel’s foot', () => {
    render(<RollTableView data={coreMechanic()} state={{ roll: null, history: [] }} />)
    const credit = screen.getByRole('link', { name: 'Randsum.dev' })
    expect(credit.getAttribute('href')).toBe('https://randsum.dev')
  })
})

describe('RollTableIsland', () => {
  test('the ROLL THE DIE stamp is its one roll control', () => {
    render(<RollTableIsland data={coreMechanic()} dieFor={dice(14)} />)
    const controls = screen.getAllByRole('button')
    expect(controls).toHaveLength(1)
    expect(controls[0]?.getAttribute('aria-label')).toBe(STAMP)
    expect(controls[0]?.textContent).toBe('Roll the Die:')
  })

  test('the stamp reads the result in the panel and marks the row it lands on', async () => {
    render(<RollTableIsland data={coreMechanic()} dieFor={dice(14)} />)
    await roll()

    const panel = screen.getByRole('region', { name: 'You rolled' })
    // Announced in the panel's polite live region.
    const live = panel.querySelector('[aria-live="polite"]') as HTMLElement
    expect(within(live).getByText('Success')).toBeTruthy()
    expect(within(panel).getByText('14')).toBeTruthy()
    expect(within(panel).getByText('Success')).toBeTruthy()
    expect(within(panel).getByText('11–19')).toBeTruthy()

    const rolled = screen.getByText('Rolled 14').closest('li')
    expect(rolled?.getAttribute('aria-current')).toBe('true')
    expect(rolled?.textContent).toContain('Success')
  })

  test('rolls the die for this table, by its name', async () => {
    const asked: string[] = []
    const die = dice(14)
    render(
      <RollTableIsland
        data={coreMechanic()}
        dieFor={(tableName) => {
          asked.push(tableName)
          return die()
        }}
      />
    )
    await roll()
    expect(asked).toEqual(['Core Mechanic'])
  })

  test('pressing the stamp again keeps the earlier rolls, newest first', async () => {
    render(<RollTableIsland data={coreMechanic()} dieFor={dice(7, 20, 3)} />)
    await roll()
    await roll()
    await roll()

    const earlier = screen.getByRole('heading', { name: 'Earlier rolls' }).parentElement
    const items = within(earlier as HTMLElement).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['20Nailed it', '7Tough Choice'])
  })
})
