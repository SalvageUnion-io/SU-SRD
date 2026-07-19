/**
 * Tests for the rotary Dial — ▲▼ stepping, wrap, and click-to-jump, all
 * reflected in the active slot. Controlled: a wrapper owns the active index
 * (the app persists it via the store in production). Plain item fixtures, no ORM.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { useState } from 'react'

import { Dial, type DialItem } from '../Dial'

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

// biome-ignore lint/style/useComponentExportOnlyModules: local test harness component, not a module export
function ControlledDial() {
  const [idx, setIdx] = useState(0)
  return <Dial items={items} activeIndex={idx} onActiveIndexChange={setIdx} />
}

afterEach(cleanup)

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

  test('clicking a track item jumps the active slot to it', () => {
    const { container, getByRole } = render(<ControlledDial />)
    fireEvent.click(getByRole('button', { name: 'Tables' }))
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Tables')
  })
})
