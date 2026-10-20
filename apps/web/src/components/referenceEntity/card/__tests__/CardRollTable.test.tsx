/**
 * The embedded roll table (board E4): one bar in every state, the result as a
 * toast whether or not the table is open, and the rolled row marked. It is
 * the shared `RollTableInstrument`, banded in its surface's tone, and a
 * columns table is the same instrument.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ToasterMount } from '../../../containers/Toaster'
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
  // R8: open on its Page, its stamp the one roll control, no toggle.
  test('open: the bar (the name and the Roll the Die stamp) over its bands, no toggle', () => {
    render(
      <CardRollTable table={coreMechanic()} name="Core Mechanic" size="compact" disabled={false} />
    )
    expect(screen.getByRole('button', { name: 'Roll the die on Core Mechanic' }).textContent).toBe(
      'Roll the Die'
    )
    expect(screen.getByText('Core Mechanic')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(document.querySelector('.su-roll')?.getAttribute('data-frame')).toBe('rule')
  })

  test('rolled and open: the matching row is marked, the same for every outcome', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="compact"
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

  test('nested it is a Mini: Roll the Die in its strip, its name Peeking the rows', () => {
    render(
      <CardRollTable
        table={coreMechanic()}
        name="Core Mechanic"
        size="compact"
        nested
        disabled={false}
        peekAt="roll-tables:core-mechanic/table"
      />
    )
    const token = document.querySelector('.su-roll-token')
    expect(token?.querySelector('.su-entity-mini__name')?.textContent).toContain('Core Mechanic')
    expect(document.querySelector('.su-roll')).toBeNull()
    // Its one control, in the pill after the name at the Mini's rung (C1a, C8).
    const roll = screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })
    expect(token?.querySelector('.su-entity-mini__pill')?.contains(roll)).toBe(true)
    expect(roll.classList.contains('su-btn--mini')).toBe(true)
    expect(screen.queryByRole('button', { name: /^Show the .* table$/ })).toBeNull()
    // The rows are its name's Peek, focusable so a keyboard opens it too.
    const trigger = token?.querySelector('[data-peek]')
    expect(trigger?.getAttribute('data-peek')).toBe('roll-tables:core-mechanic/table')
    expect(trigger?.getAttribute('tabindex')).toBe('0')
  })

  test('a damaged host reads the table but cannot roll it', () => {
    render(<CardRollTable table={coreMechanic()} name="Core Mechanic" size="compact" disabled />)
    expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull()
    expect(screen.getAllByRole('listitem').length).toBe(5)
  })

  test('a roll raises its result as a toast: the die, the band, the outcome and its text', async () => {
    render(
      <>
        <CardRollTable table={coreMechanic()} name="Core Mechanic" size="full" disabled={false} />
        <ToasterMount />
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
      <CardRollTable table={coreMechanic()} name="Core Mechanic" size="compact" disabled={false} />
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
          disabled={false}
          tone="var(--color-pilot)"
        />
        <ToasterMount />
      </>
    )
    const grid = screen.getByRole('table', { name: 'Callsign Table' })
    expect(grid.querySelectorAll('tbody tr')).toHaveLength(20)
    expect(within(grid).getByText('Sparkles')).toBeTruthy()
    const stamp = screen.getByRole('button', { name: 'Roll the dice on Callsign Table' })
    expect(stamp.textContent).toBe('Roll the Dice')
    fireEvent.click(stamp)
    expect(await screen.findByText(/^Callsign Table: rolled \d+ \(column /)).toBeTruthy()
    expect(grid.querySelectorAll('td[aria-current="true"]')).toHaveLength(1)
    // Pressed again, the same button rolls again: there is no second Roll.
    expect(screen.queryAllByRole('button', { name: /^Roll/ })).toHaveLength(1)
  })
})
