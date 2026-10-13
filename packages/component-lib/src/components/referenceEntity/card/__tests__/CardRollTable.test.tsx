/**
 * The embedded roll table (board E4): one bar in every state, the result as a
 * readout whether or not the table is open, and the rolled row marked. It is
 * the shared `RollTableInstrument`, banded in its surface's tone, and a
 * columns table is the same instrument.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../../../entity/EntitySurface'
import type { AnnouncedRoll } from '../../../../entity/entitySurfaceContext'
import { CardRollTable } from '../CardRollTable'

const callsigns = () => {
  const table = SalvageUnionReference.RollTables.getByName('Callsign Table')?.table
  if (!table) throw new Error('Callsign Table fixture missing')
  return table
}

const coreMechanic = () => {
  const table = SalvageUnionReference.RollTables.getByName('Core Mechanic')?.table
  if (!table) throw new Error('Core Mechanic fixture missing')
  return table
}

describe('CardRollTable', () => {
  test('collapsed: the bar alone — the ROLL THE DIE stamp (the roll), the name and the Table toggle', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible
        disabled={false}
      />
    )
    expect(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }).textContent).toBe(
      'Roll the Die:'
    )
    expect(screen.getByText('Core Mechanic')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: 'Show the Core Mechanic table' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  test('rolled while collapsed: the readout, without the table', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible
        disabled={false}
        defaultRoll={14}
      />
    )
    expect(screen.getByText('14')).toBeTruthy()
    expect(screen.getByText('You rolled · lands on 11–19')).toBeTruthy()
    expect(screen.getByText('Success')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })).toBeTruthy()
  })

  test('rolled and open: the matching row is marked, the same for every outcome', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible={false}
        disabled={false}
        defaultRoll={14}
      />
    )
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBe(5)
    const marked = rows.filter((row) => row.getAttribute('aria-current') === 'true')
    expect(marked).toHaveLength(1)
    expect(marked[0]?.textContent).toContain('Rolled 14')
  })

  test('rolling never needs the table open, and the toggle opens it', async () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible
        disabled={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    // The dice load on the first roll (`dieForTable`), so the readout is awaited.
    expect(await screen.findByText(/You rolled · lands on/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the Core Mechanic table' }))
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })

  test('a damaged host reads the table but cannot roll it', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible={false}
        disabled
      />
    )
    expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull()
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })

  test('a surface that announces rolls gets the result, and the card keeps no readout', async () => {
    const announced: AnnouncedRoll[] = []
    render(
      <EntitySurfaceProvider value={{ announceRoll: (roll) => announced.push(roll) }}>
        <CardRollTable
          table={coreMechanic()}
          name="Core Mechanic"
          size="large"
          collapsible={false}
          disabled={false}
        />
      </EntitySurfaceProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    // The dice load on the first roll (`d20ForTable`), so the mark is awaited.
    expect(await screen.findByText(/^Rolled \d+$/)).toBeTruthy()
    expect(announced).toHaveLength(1)
    const [roll] = announced
    expect(roll?.table).toBe('Core Mechanic')
    expect(roll?.roll).toBeGreaterThanOrEqual(1)
    expect(roll?.roll).toBeLessThanOrEqual(20)
    expect(roll?.text.length).toBeGreaterThan(0)
    expect(screen.queryByText(/You rolled · lands on/)).toBeNull()
  })

  test('the rows are banded d20: paper, then the band (cream with no tone), in turn', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible={false}
        disabled={false}
      />
    )
    const fills = screen.getAllByRole('listitem').map((row) => row.style.backgroundColor)
    expect(fills).toEqual([
      'var(--color-paper)',
      'var(--su-roll-band)',
      'var(--color-paper)',
      'var(--su-roll-band)',
      'var(--color-paper)',
    ])
    const instrument = screen.getAllByRole('listitem')[0]?.closest('.su-roll') as HTMLElement
    expect(instrument.style.getPropertyValue('--su-roll-band')).toBe('var(--color-band-cream)')
  })

  test('on a toned surface the band is the tone’s, cut into paper', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="medium"
        collapsible={false}
        disabled={false}
        tone="var(--color-pilot)"
      />
    )
    const fills = screen.getAllByRole('listitem').map((row) => row.style.backgroundColor)
    expect(fills[0]).toBe('var(--color-paper)')
    expect(fills[1]).toBe('var(--su-roll-band)')
    const instrument = screen.getAllByRole('listitem')[0]?.closest('.su-roll') as HTMLElement
    expect(instrument.style.getPropertyValue('--su-roll-band')).toBe(
      'color-mix(in srgb, var(--color-pilot) 25%, var(--color-paper))'
    )
  })

  test('a columns table is the same instrument: the bar, the grid, a marked cell', () => {
    render(
      <CardRollTable
        table={callsigns()}
        name="Callsign Table"
        size="large"
        collapsible={false}
        disabled={false}
        tone="var(--color-pilot)"
      />
    )
    const grid = screen.getByRole('table', { name: 'Callsign Table' })
    expect(grid.querySelectorAll('tbody tr')).toHaveLength(20)
    expect(screen.getByText('Sparkles')).toBeTruthy()
    const stamp = screen.getByRole('button', { name: 'Roll twice on Callsign Table' })
    expect(stamp.textContent).toBe('Roll twice:')
    fireEvent.click(stamp)
    expect(screen.getByText(/You rolled · column/)).toBeTruthy()
    expect(grid.querySelectorAll('td[aria-current="true"]')).toHaveLength(1)
    // Pressed again, the same stamp rolls again: there is no second Roll.
    expect(screen.queryAllByRole('button', { name: /^Roll/ })).toHaveLength(1)
  })
})
