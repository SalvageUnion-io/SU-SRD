/**
 * The embedded roll table (board E4): one bar in every state, the result as a
 * toast whether or not the table is open, and the rolled row marked. It is
 * the shared `RollTableInstrument`, banded in its surface's tone, and a
 * columns table is the same instrument.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Toaster } from '../../../containers/Toaster'
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
  test('hidden by default: the bar alone — the name, the Table toggle and the Roll the Die button', () => {
    render(
      <CardRollTable table={coreMechanic()} name="Core Mechanic" size="compact" disabled={false} />
    )
    expect(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }).textContent).toBe(
      'Roll the Die'
    )
    expect(screen.getByText('Core Mechanic')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: 'Show the Core Mechanic table' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  test('rolled and open: the matching row is marked, the same for every outcome', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="compact"
        defaultOpen
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
      <>
        <CardRollTable
          table={coreMechanic()}
          name="Core Mechanic"
          size="compact"
          disabled={false}
        />
        <Toaster />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    // The dice load on the first roll (`dieForTable`), so the toast is awaited.
    expect(await screen.findByText(/^Core Mechanic: rolled \d+ \(/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the Core Mechanic table' }))
    // The toast is a list item too: count the table's own rows.
    expect(document.querySelectorAll('.su-roll li')).toHaveLength(5)
  })

  test('open, the Table toggle names the bands it controls', () => {
    render(
      <CardRollTable table={coreMechanic()} name="Core Mechanic" size="compact" disabled={false} />
    )
    const toggle = screen.getByRole('button', { name: 'Show the Core Mechanic table' })
    fireEvent.click(toggle)
    const bands = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(bands?.classList.contains('su-roll__bands')).toBe(true)
  })

  test('nested and folded it is a Token, its buttons beside it; Table reveals the instrument', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="compact"
        framed
        nested
        disabled={false}
      />
    )
    const line = document.querySelector('.su-roll-token')
    expect(line?.querySelector('.su-entity-token__name')?.textContent).toContain('Core Mechanic')
    expect(document.querySelector('.su-roll')).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the Core Mechanic table' }))
    expect(document.querySelector('.su-roll-token')).toBeNull()
    expect(document.querySelectorAll('.su-roll li')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Hide the Core Mechanic table' })).toBeTruthy()
  })

  test('a damaged host reads the table but cannot roll it', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="compact"
        defaultOpen
        disabled
      />
    )
    expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull()
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })

  test('a roll raises its result as a toast: the die, the band, the outcome and its text', async () => {
    render(
      <>
        <CardRollTable
          table={coreMechanic()}
          name="Core Mechanic"
          size="full"
          defaultOpen
          disabled={false}
        />
        <Toaster />
      </>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }))
    // The dice load on the first roll (`dieForTable`), so the mark is awaited.
    const mark = await screen.findByText(/^Rolled \d+$/)
    const roll = mark.textContent?.replace('Rolled ', '')
    const title = await screen.findByText(
      new RegExp(`^Core Mechanic: rolled ${roll} \\(\\d+(–\\d+)?\\)$`)
    )
    const toast = title.closest('[data-sonner-toast]')
    expect(toast?.querySelector('[data-description]')?.textContent?.length ?? 0).toBeGreaterThan(0)
  })

  test('the rows are banded d20: paper, then the band (cream with no tone), in turn', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="compact"
        defaultOpen
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
        size="compact"
        defaultOpen
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

  test('a columns table is the same instrument: the bar, the grid, a marked cell', async () => {
    render(
      <>
        <CardRollTable
          table={callsigns()}
          name="Callsign Table"
          size="full"
          defaultOpen
          disabled={false}
          tone="var(--color-pilot)"
        />
        <Toaster />
      </>
    )
    const grid = screen.getByRole('table', { name: 'Callsign Table' })
    expect(grid.querySelectorAll('tbody tr')).toHaveLength(20)
    expect(screen.getByText('Sparkles')).toBeTruthy()
    const stamp = screen.getByRole('button', { name: 'Roll twice on Callsign Table' })
    expect(stamp.textContent).toBe('Roll twice')
    fireEvent.click(stamp)
    expect(await screen.findByText(/^Callsign Table: rolled \d+ \(column /)).toBeTruthy()
    expect(grid.querySelectorAll('td[aria-current="true"]')).toHaveLength(1)
    // Pressed again, the same button rolls again: there is no second Roll.
    expect(screen.queryAllByRole('button', { name: /^Roll/ })).toHaveLength(1)
  })
})
