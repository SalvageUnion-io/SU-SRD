/**
 * Callout is the unlabelled note: the bare `Box` whose frame takes the tone's
 * accent. The tone axis is a closed token set, pinned here as tone→token.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Callout } from '../Callout'

const MECH_ACCENT = 'var(--color-sheet-mech)'

/** The box's frame. */
function root(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.su-entity-compact__frame')
  if (!(el instanceof HTMLElement)) throw new Error('callout rendered nothing')
  return el
}

describe('Callout', () => {
  test('each tone maps to its token accent; ink is the default', () => {
    const cases: [React.ComponentProps<typeof Callout>['tone'], string][] = [
      ['pilot', 'var(--color-sheet-pilot)'],
      ['crawler', 'var(--color-sheet-crawler)'],
      ['bad', 'var(--color-status-bad)'],
      ['mech', MECH_ACCENT],
    ]
    for (const [tone, accent] of cases) {
      const { container, unmount } = render(<Callout tone={tone}>body</Callout>)
      expect(root(container).style.borderColor).toBe(accent)
      unmount()
    }
    const { container } = render(<Callout tone="ink">Pick one of the following.</Callout>)
    expect(root(container).style.borderColor).toBe('var(--color-ink)')
  })

  test('it paints no band — just a framed paper panel', () => {
    const { container } = render(<Callout tone="mech">Pick one of the following.</Callout>)
    expect(screen.getByText('Pick one of the following.')).toBeTruthy()
    expect(container.querySelector('.su-entity-compact__head')).toBeNull()
  })
})
