import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { StatColumn } from '../StatColumn'

const STATS = [
  { key: 'sp', label: 'Structure Points', value: '12' },
  { key: 'ep', label: 'Energy Points', value: '4', hoverText: 'Energy' },
]

describe('StatColumn', () => {
  test('reads label then value, in the given order', () => {
    const { container } = render(<StatColumn stats={STATS} label="Mule stats" />)
    const list = container.querySelector('dl[aria-label="Mule stats"]')
    const pairs = [...(list?.querySelectorAll('dt') ?? [])].map(
      (dt) => `${dt.textContent} ${dt.nextElementSibling?.textContent}`
    )
    expect(pairs).toEqual(['Structure Points 12', 'Energy Points 4'])
    expect(list?.children[1]?.getAttribute('title')).toBe('Energy')
  })

  test('renders nothing with no stats', () => {
    const { container } = render(<StatColumn stats={[]} label="None" />)
    expect(container.firstChild).toBeNull()
  })
})
