/**
 * Tests for the rotary Dial — ▲▼ stepping, wrap, and click-to-jump, all
 * reflected in the active slot. Controlled: a wrapper owns the active index
 * (the app persists it via the store in production). Plain item fixtures, no ORM.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import type { DialItem } from '../Dial'
import { Dial } from '../Dial'

const items: DialItem[] = [
  { key: 'actions', statless: true, label: 'Actions', sublabel: 'deck' },
  {
    key: 'pilot',
    statless: false,
    label: 'Pilot · Vesh',
    tone: 'pilot',
    gauges: [{ label: 'HP', value: 8, max: 10, tone: 'pilot' }],
  },
  { key: 'tables', statless: true, label: 'Tables', sublabel: 'roll' },
]

function ControlledDial() {
  const [idx, setIdx] = useState(0)
  return <Dial items={items} activeIndex={idx} onActiveIndexChange={setIdx} />
}

describe('Dial', () => {
  test('active slot starts on the first item', () => {
    const { container } = render(<ControlledDial />)
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Actions')
  })

  test('▼ advances, ▲ goes back', () => {
    const { container, getByLabelText } = render(<ControlledDial />)
    const slot = () => container.querySelector('.pc-cell-active')?.textContent ?? ''
    fireEvent.click(getByLabelText('Dial down'))
    expect(slot()).toContain('Pilot · Vesh')
    fireEvent.click(getByLabelText('Dial up'))
    expect(slot()).toContain('Actions')
  })

  test('▲ from the first item wraps to the last', () => {
    const { container, getByLabelText } = render(<ControlledDial />)
    fireEvent.click(getByLabelText('Dial up'))
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Tables')
  })

  // Queried as `option`, not `button`: the dial container is a listbox
  // (dashboard.md §10.2), so each cell carries role="option" — which OVERRIDES
  // the implicit button role even though the clickable cell is still a <button>
  // element. Asserting the option role here is the stronger test anyway: it pins
  // the listbox semantics the spec requires, not just that something is
  // clickable.
  test('clicking a track item jumps the active slot to it', () => {
    const { container, getByRole } = render(<ControlledDial />)
    fireEvent.click(getByRole('option', { name: 'Tables' }))
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Tables')
  })

  test('the dial exposes its cells as listbox options with selection state', () => {
    const { getAllByRole, getByRole } = render(<ControlledDial />)
    expect(getByRole('listbox')).toBeTruthy()
    const options = getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    // Exactly one option is selected at a time.
    expect(options.filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1)
  })
})
