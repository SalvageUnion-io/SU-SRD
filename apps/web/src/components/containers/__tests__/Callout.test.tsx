/**
 * Callout's two shapes: labelled, it is a `TitledBox` (the cut-out head in the
 * accent's band, the label on the paper tab); label-less, the bare `Box`
 * whose frame takes the tone's accent. The tone axis is a closed
 * token set, pinned here as tone→token.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Callout } from '../Callout'

const MECH_ACCENT = 'var(--color-sheet-mech)'

/** The box's frame. */
function root(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.su-entity-row__frame')
  if (!(el instanceof HTMLElement)) throw new Error('callout rendered nothing')
  return el
}

describe('Callout', () => {
  test('a label puts it on the cut-out head, in the band of its tone', () => {
    const { container } = render(
      <Callout label="Reminder" tone="mech">
        The Mech cannot move.
      </Callout>
    )
    const head = container.querySelector<HTMLElement>('.su-entity-row__head[data-notch]')
    expect(head?.querySelector('.su-entity-row__notch')?.textContent).toBe('Reminder')
    expect(head?.style.backgroundColor).toBe(MECH_ACCENT)
    expect(container.querySelector('.su-box__body')?.textContent).toBe('The Mech cannot move.')
  })

  test('each label-less tone maps to its token accent; ink is the default', () => {
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

  test('a label-less callout paints no band — just a framed paper panel', () => {
    const { container } = render(<Callout tone="mech">Pick one of the following.</Callout>)
    expect(screen.getByText('Pick one of the following.')).toBeTruthy()
    expect(container.querySelector('.su-entity-row__head')).toBeNull()
  })

  test('no children means it closes on its head', () => {
    const { container } = render(<Callout label="Reminder" tone="mech" />)
    expect(screen.getByText('Reminder')).toBeTruthy()
    expect(container.querySelector('[data-bodyless]')).not.toBeNull()
    expect(container.querySelector('.su-box__body')).toBeNull()
  })
})
