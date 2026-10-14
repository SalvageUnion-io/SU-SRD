import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Avatar } from '../Avatar'

/**
 * The fallback is the part an Avatar can get wrong: with no picture it must
 * still show who it is — two initials — and with no name either, a generic
 * glyph rather than a blank chip. It is always decorative (the name is
 * printed beside it or carried by its control), so it is hidden from the
 * accessibility tree.
 */

describe('Avatar', () => {
  test('with no picture it shows the first letters of the first two words, uppercased', () => {
    const { container } = render(<Avatar name="rae  voss the third" />)
    expect(container.textContent).toBe('RV')
  })

  test('a one-word name gives its first two letters', () => {
    const { container } = render(<Avatar name=" beefcake " />)
    expect(container.textContent).toBe('BE')
  })

  test('a one-character name gives one initial', () => {
    const { container } = render(<Avatar name="Q" />)
    expect(container.textContent).toBe('Q')
  })

  test('takes whole characters, not half a surrogate pair', () => {
    const { container } = render(<Avatar name="🦀 Crab" />)
    expect(container.textContent).toBe('🦀C')
  })

  test('is a square chip on the 3px canon radius, not a circle', () => {
    const { container } = render(<Avatar name="Rae Voss" />)
    expect((container.firstElementChild as HTMLElement).style.borderRadius).toBe('3px')
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
