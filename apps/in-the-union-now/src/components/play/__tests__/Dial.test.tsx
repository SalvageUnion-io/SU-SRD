/**
 * Tests for the rotary Dial — ▲▼ stepping, wrap, and click-to-jump, all
 * reflected in the active slot. Uses plain item fixtures (no ORM needed).
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'

import { usePlayStateStore } from '../../../stores/playStateStore'
import { Dial } from '../Dial'
import type { DialItem } from '../dialItems'

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

describe('Dial', () => {
  beforeEach(() => {
    usePlayStateStore.setState({ mount: 'mech', wheel: 0 })
  })

  test('active slot starts on the first item', () => {
    const { container } = render(<Dial items={items} />)
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Actions')
  })

  test('▼ advances, ▲ goes back', () => {
    const { container, getByLabelText } = render(<Dial items={items} />)
    const slot = () => container.querySelector('.pc-cell-active')?.textContent ?? ''
    fireEvent.click(getByLabelText('Dial down'))
    expect(slot()).toContain('Pilot · Vesh')
    fireEvent.click(getByLabelText('Dial up'))
    expect(slot()).toContain('Actions')
  })

  test('▲ from the first item wraps to the last', () => {
    const { container, getByLabelText } = render(<Dial items={items} />)
    fireEvent.click(getByLabelText('Dial up'))
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Tables')
  })

  test('clicking a track item jumps the active slot to it', () => {
    const { container, getByRole } = render(<Dial items={items} />)
    fireEvent.click(getByRole('button', { name: 'Tables' }))
    expect(container.querySelector('.pc-cell-active')?.textContent).toContain('Tables')
  })
})
