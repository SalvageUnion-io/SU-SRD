import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { Tag } from '../Tag'

afterEach(cleanup)

// Tag is a single-label keyword chip. Split label/value content is a Stat —
// render it with StatDisplay orientation="horizontal" (see StatDisplay tests).
describe('Tag', () => {
  test('renders an ink-on-paper stamped chip by default', () => {
    const { container } = render(<Tag label="Turn Action" />)
    expect(screen.getByText('Turn Action')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('bg-ink')
  })

  test('ghost inverts the chip (paper bg, ink text)', () => {
    const { container } = render(<Tag label="Passive" ghost />)
    expect(screen.getByText('Passive')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('bg-paper')
  })
})
