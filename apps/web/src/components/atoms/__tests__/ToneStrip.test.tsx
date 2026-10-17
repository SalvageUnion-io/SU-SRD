/** ToneStrip: a decorative band in the colour it is given. */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { ToneStrip } from '../ToneStrip'

describe('ToneStrip', () => {
  test('is hidden from assistive tech and painted in its colour', () => {
    const { container } = render(<ToneStrip color="var(--color-pilot)" />)
    const strip = container.firstElementChild as HTMLElement
    expect(strip.getAttribute('aria-hidden')).toBe('true')
    expect(strip.className).toContain('su-tone-strip')
    expect(strip.style.backgroundColor).toBe('var(--color-pilot)')
  })
})
