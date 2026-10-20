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

  const lone = (groups: (string | undefined)[]) => {
    const { container } = render(
      <StatColumn
        stats={groups.map((group, index) => ({
          key: String(index),
          label: `Stat ${index}`,
          value: '1',
          ...(group ? { group: group as 'vitals' } : {}),
        }))}
        label="Stats"
      />
    )
    return [...container.querySelectorAll('li')].map((li) =>
      li.classList.contains('su-stat-column__cell--lone')
    )
  }

  test('cells pair off within their group; one without a partner spans its row', () => {
    const mech = ['vitals', 'vitals', 'capacity', 'capacity', 'capacity', 'capacity']
    expect(lone(mech)).toEqual([false, false, false, false, false, false])
    // No Energy Points: Structure spans, the capacity pairs hold.
    expect(lone(mech.slice(1))).toEqual([true, false, false, false, false])
    // A capacity short: its last cell spans.
    expect(lone(mech.slice(0, 5))).toEqual([false, false, false, false, true])
    expect(lone([undefined, undefined, undefined])).toEqual([false, false, true])
  })
})
