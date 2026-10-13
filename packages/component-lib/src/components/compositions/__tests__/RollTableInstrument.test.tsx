/**
 * The "ROLL THE DIE:" stamp is the roll (refit2 preview-fixes): given
 * `onRoll`, the stamp is the table's one roll control, a real button named
 * for its table; without it, or in server markup, it is the plain label, so
 * static HTML never carries a dead button.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RollTableInstrument } from '../RollTableInstrument'

const rows = [
  { key: '20', label: 'Nailed it', value: 'You succeed.' },
  { key: '1-19', label: 'Not quite', value: 'You do not.' },
]

const instrument = (onRoll?: () => void) => (
  <RollTableInstrument
    name="Core Mechanic"
    size="large"
    onRoll={onRoll}
    table={{ kind: 'bands', rows }}
  />
)

describe('RollTableInstrument — the stamp is the roll', () => {
  test('with onRoll, the stamp is the one roll control, named for its table', () => {
    let rolled = 0
    render(instrument(() => rolled++))
    const controls = screen.getAllByRole('button')
    expect(controls).toHaveLength(1)
    const stamp = screen.getByRole('button', { name: 'Roll the die on Core Mechanic' })
    expect(stamp.textContent).toBe('Roll the Die:')
    expect(stamp.className).toContain('su-roll__stamp')
    expect(stamp.className).toContain('su-focus-ring')
    fireEvent.click(stamp)
    expect(rolled).toBe(1)
  })

  test('a columns table names its stamp by its own words', () => {
    render(
      <RollTableInstrument
        name="Callsign Table"
        size="large"
        stamp="Roll twice:"
        onRoll={() => {}}
        table={{ kind: 'columns', columns: [] }}
      />
    )
    expect(screen.getByRole('button', { name: 'Roll twice on Callsign Table' })).toBeTruthy()
  })

  test('without onRoll, the stamp is a plain label', () => {
    render(instrument())
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText('Roll the Die:').tagName).toBe('SPAN')
  })

  test('server markup prints the label, never a dead button, even with onRoll', () => {
    const html = renderToStaticMarkup(instrument(() => {}))
    expect(html).toContain('<span class="su-roll__stamp">Roll the Die:</span>')
    expect(html).not.toContain('<button')
  })
})
