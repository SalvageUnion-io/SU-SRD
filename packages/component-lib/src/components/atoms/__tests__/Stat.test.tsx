import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Stat } from '../Stat'

describe('Stat', () => {
  test('reads label first, then value over its max', () => {
    const { container } = render(<Stat label="HP" value={10} max={12} />)
    const cell = container.querySelector('.su-stat-cell')
    expect(cell?.textContent).toBe('HP10/12')
    expect(cell?.firstElementChild?.textContent).toBe('HP')
  })
})
