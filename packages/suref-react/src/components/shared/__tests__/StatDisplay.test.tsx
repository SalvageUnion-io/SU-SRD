import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { StatDisplay } from '../StatDisplay'

describe('StatDisplay', () => {
  afterEach(cleanup)

  test('default colors are text-su-black on bg-su-white (16:1 contrast, WCAG AAA)', () => {
    render(<StatDisplay label="HP" value={10} />)
    const group = screen.getByRole('group')
    expect(group).toBeTruthy()
    // The value box uses bg-su-white and text-su-black by default,
    // which gives 16:1 contrast ratio — well above WCAG AAA (7:1).
    const box = group.querySelector('.bg-su-white')
    expect(box).toBeTruthy()
    expect(box!.querySelector('.text-su-black')).toBeTruthy()
  })
})
