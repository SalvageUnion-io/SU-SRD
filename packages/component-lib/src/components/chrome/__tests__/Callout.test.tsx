/**
 * Callout composes DisplayCard, so its anatomy is now the product of another
 * component's layout rules rather than its own div stack. These pin the three
 * things that composition could silently change: the frame takes the tone's
 * ACCENT (not the derived band tint), a label-less callout paints NO header
 * band, and the body only exists when there is content for it.
 *
 * The tone axis is a closed token set — the accent is always a `var(--color-*)`
 * reference and the band tint is derived from it, so the closed-set law is
 * enforced by the type system; these tests pin the tone→accent mapping.
 * (The tint itself is a `color-mix()`, which happy-dom rejects as a style
 * value, so the band is asserted by presence rather than computed colour.)
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Callout } from '../Callout'

afterEach(cleanup)

const MECH_ACCENT = 'var(--color-sheet-mech)'

/** The outermost element — the framed card wrapper. */
function frame(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild as HTMLElement | null
  if (!el) throw new Error('callout rendered nothing')
  return el
}

/** The header band — identified by the callout's tightened padding pair. */
function bands(el: HTMLElement) {
  return el.querySelectorAll('.px-3.py-1\\.5')
}

describe('Callout', () => {
  test('the frame takes the tone accent, not the derived band tint', () => {
    const { container } = render(
      <Callout label="When Damaged" tone="mech">
        The Mech cannot move.
      </Callout>
    )
    // The whole point of the accent/tint split: a mech-green frame around a
    // pale mech band. Deriving the border from the band would paint it the mix.
    expect(frame(container).style.borderColor).toBe(MECH_ACCENT)
  })

  test('each tone maps to its token accent; ink is the default', () => {
    const cases: [React.ComponentProps<typeof Callout>['tone'], string][] = [
      ['pilot', 'var(--color-sheet-pilot)'],
      ['crawler', 'var(--color-sheet-crawler)'],
      ['bad', 'var(--color-status-bad)'],
    ]
    for (const [tone, accent] of cases) {
      const { container, unmount } = render(<Callout tone={tone}>body</Callout>)
      expect(frame(container).style.borderColor).toBe(accent)
      unmount()
    }
    const { container } = render(<Callout>Pick one of the following.</Callout>)
    expect(frame(container).style.borderColor).toBe('var(--color-ink)')
  })

  test('a label paints a header band carrying the stamp', () => {
    const { container } = render(
      <Callout label="When Damaged" tone="mech">
        The Mech cannot move.
      </Callout>
    )
    expect(screen.getByText('When Damaged')).toBeTruthy()
    expect(screen.getByText('The Mech cannot move.')).toBeTruthy()
    expect(bands(container).length).toBe(1)
  })

  test('a label-less callout paints NO header band — just a framed paper panel', () => {
    const { container } = render(<Callout tone="mech">Pick one of the following.</Callout>)
    expect(screen.getByText('Pick one of the following.')).toBeTruthy()
    // An empty band is the regression: the card must not reserve header height
    // for a header that has nothing in it.
    expect(bands(container).length).toBe(0)
    expect(frame(container).style.borderColor).toBe(MECH_ACCENT)
  })

  test('no children means no body panel', () => {
    render(<Callout label="When Damaged" tone="mech" />)
    expect(screen.getByText('When Damaged')).toBeTruthy()
    expect(screen.queryByText('The Mech cannot move.')).toBeNull()
  })
})
