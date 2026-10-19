import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { StatColumn } from '../StatColumn'

const STATS = [
  { key: 'sp', label: 'Structure Points', value: '12' },
  { key: 'ep', label: 'Energy Points', value: '4', hoverText: 'Energy' },
]

describe('StatColumn', () => {
  test('a layout of Stats: label then value, in the given order', () => {
    const { container } = render(<StatColumn stats={STATS} label="Mule stats" />)
    const list = container.querySelector('ul[aria-label="Mule stats"]')
    const pairs = [...(list?.querySelectorAll('li > .su-stat-cell') ?? [])].map((cell) =>
      [...cell.querySelectorAll('.su-stat-plate')].map((plate) => plate.textContent).join(' ')
    )
    expect(pairs).toEqual(['Structure Points 12', 'Energy Points 4'])
    expect(list?.children[1]?.getAttribute('title')).toBe('Energy')
    // No hand-built description list (ruleset §6.2, hard rule R36).
    expect(container.querySelector('dl, dt, dd')).toBeNull()
  })

  test('renders nothing with no stats', () => {
    const { container } = render(<StatColumn stats={[]} label="None" />)
    expect(container.firstChild).toBeNull()
  })
})
