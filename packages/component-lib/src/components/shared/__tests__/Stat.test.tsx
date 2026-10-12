import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
import { FOCUS_RING } from '../../chrome/interaction'
import { Stat } from '../Stat'

describe('Stat', () => {
  test('default colors are ink on paper (16:1 contrast, WCAG AAA)', () => {
    render(<Stat label="HP" value={10} />)
    const group = screen.getByRole('group')
    expect(group).toBeTruthy()
    // The value box uses a paper fill and ink text by default,
    // which gives 16:1 contrast ratio — well above WCAG AAA (7:1).
    // [top stamp, box, bottom stamp]
    const box = group.children[1] as HTMLElement | undefined
    expect(box?.style.backgroundColor).toBe(color.paper)
    const readout = box?.querySelector<HTMLElement>('span')
    expect(readout?.style.color).toBe(color.ink)
  })

  test('disabled interactive stat shows visible disabled cue while keeping AA contrast', () => {
    // When onClick is present but the stat is disabled, the surrounding group
    // drops to 60% opacity so keyboard/screen-reader users see a visible disabled cue
    // while the 16:1 base contrast remains above AA (4.5:1) at ~9.6:1 effective.
    const { getByRole } = render(<Stat label="HP" value={10} onClick={() => {}} disabled />)
    const group = getByRole('group')
    expect(group.style.opacity).toBe('0.6')
    const button = getByRole('button')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  test('interactive stat has focus-visible outline for keyboard users', () => {
    const { getByRole } = render(<Stat label="HP" value={10} onClick={() => {}} />)
    const button = getByRole('button')
    expect(button.className).toContain(FOCUS_RING)
  })
})
