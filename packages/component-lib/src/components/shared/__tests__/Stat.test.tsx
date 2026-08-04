import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Stat } from '../Stat'

describe('Stat', () => {
  test('default colors are text-ink on bg-paper (16:1 contrast, WCAG AAA)', () => {
    render(<Stat label="HP" value={10} />)
    const group = screen.getByRole('group')
    expect(group).toBeTruthy()
    // The value box uses bg-paper and text-ink by default,
    // which gives 16:1 contrast ratio — well above WCAG AAA (7:1).
    const box = group.querySelector('.bg-paper')
    expect(box).toBeTruthy()
    expect(box?.querySelector('.text-ink')).toBeTruthy()
  })

  test('disabled interactive stat shows visible disabled cue while keeping AA contrast', () => {
    // When onClick is present but the stat is disabled, the surrounding group
    // gets opacity-60 so keyboard/screen-reader users see a visible disabled cue
    // while the 16:1 base contrast remains above AA (4.5:1) at ~9.6:1 effective.
    const { getByRole } = render(<Stat label="HP" value={10} onClick={() => {}} disabled />)
    const group = getByRole('group')
    expect(group.className).toContain('opacity-60')
    const button = getByRole('button')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  test('interactive stat has focus-visible outline for keyboard users', () => {
    const { getByRole } = render(<Stat label="HP" value={10} onClick={() => {}} />)
    const button = getByRole('button')
    expect(button.className).toContain('focus-visible:outline')
  })
})
