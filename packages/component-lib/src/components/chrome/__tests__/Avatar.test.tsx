import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Avatar } from '../Avatar'

/**
 * The fallback is the part an Avatar can get wrong: with no picture it must
 * still show who it is — an initial — and with no name either, a generic
 * glyph rather than a blank circle. It is always decorative (the name is
 * printed beside it or carried by its control), so it is hidden from the
 * accessibility tree.
 */

describe('Avatar', () => {
  test('with no picture it shows the initial, uppercased', () => {
    const { container } = render(<Avatar name="beefcake" />)
    expect(container.textContent).toBe('B')
  })

  test('takes a whole character, not half a surrogate pair', () => {
    const { container } = render(<Avatar name="🦀 Crab" />)
    expect(container.textContent).toBe('🦀')
  })

  test('with no name it falls back to a glyph, not an empty circle', () => {
    const { container } = render(<Avatar name="  " />)
    expect(container.textContent).toBe('')
    expect(container.querySelector('svg')).toBeTruthy()
  })

  test('is decorative: hidden from assistive technology', () => {
    const { container } = render(<Avatar name="Beefcake" src="https://cdn.example/a.png" />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})
