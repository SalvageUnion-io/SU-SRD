import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { Tag } from '../Tag'

afterEach(cleanup)

/** Narrow a possibly-null query result, failing the test loudly if absent. */
function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected element to be present')
  return value
}

describe('Tag', () => {
  test('renders an ink-on-paper stamped chip by default', () => {
    const { container } = render(<Tag label="Turn Action" />)
    expect(screen.getByText('Turn Action')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('bg-ink')
  })

  test('value form renders an inverted value box after the label', () => {
    const { container } = render(<Tag label="Range" value="Close" />)
    const b = must(container.querySelector('b'))
    expect(b.textContent).toBe('Close')
    expect(b.className).toContain('bg-paper')
    // value renders after the label
    expect(container.firstElementChild?.lastElementChild).toBe(b)
  })

  test('pre puts the value box before the label ([1] AP)', () => {
    const { container } = render(<Tag label="AP" value={1} pre />)
    const root = must(container.firstElementChild)
    expect(root.firstElementChild?.tagName).toBe('B')
  })

  test('ghost inverts the chip and flips the value box back to ink', () => {
    const { container } = render(<Tag label="Passive" value="X" ghost />)
    const root = must(container.firstElementChild)
    expect(root.className).toContain('bg-paper')
    expect(container.querySelector('b')?.className).toContain('bg-ink')
  })
})
