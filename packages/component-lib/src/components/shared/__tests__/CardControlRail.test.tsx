/**
 * THE CORNER CONTROL RAIL — position must not cost overflow containment.
 *
 * The rail rides the card's top-RIGHT corner (`right-2` + `justify-end`). It was
 * briefly centred; centring laid the controls over the card's title, which is
 * the one thing a reader scans a collapsed listing for.
 *
 * Containment is NOT provided by the alignment either way — it comes from
 * `flex-wrap` + `max-w-[calc(100%-1rem)]`, which cap the row at the card width
 * and wrap a crowded rail onto stacked lines. These tests pin both facts on the
 * WORST CASE a card can carry — a status seal, a selection seal, a count seal
 * and three action controls — so a re-position that drops the max-width (and
 * lets the rail spill) fails here.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { CardControlRail } from '../CardControlRail'
import type { ReferenceEntityControl } from '../../referenceEntity/referenceEntityControlTypes'

// The crowded worst case: a condition status + three action buttons on the
// controls axis, plus two bespoke seals (selection + count) between them.
const crowdedControls: ReferenceEntityControl[] = [
  { key: 'status', status: { value: 'damaged', subject: 'Laser', onClick: () => {} } },
  { key: 'edit', ariaLabel: 'Edit', label: 'Edit', onClick: () => {} },
  { key: 'swap', ariaLabel: 'Swap', label: 'Swap', onClick: () => {} },
  { key: 'remove', ariaLabel: 'Remove', label: 'Remove', onClick: () => {} },
]

const crowdedSeals = [
  <span key="sel" data-testid="selection-seal">
    Selected
  </span>,
  <span key="count" data-testid="count-seal">
    2 / 3
  </span>,
]

function railEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector('div.absolute')
  if (!(el instanceof HTMLElement)) throw new Error('no absolute rail rendered')
  return el
}

afterEach(cleanup)

describe('CardControlRail — corner-pinned, still contained', () => {
  test('the rail is right-pinned (not centred)', () => {
    const { container } = render(
      <CardControlRail controls={crowdedControls} seals={crowdedSeals} />
    )
    const rail = railEl(container)
    expect(rail.className).toContain('right-2')
    expect(rail.className).toContain('justify-end')
    // The centred anchor must be gone.
    expect(rail.className).not.toContain('left-1/2')
    expect(rail.className).not.toContain('-translate-x-1/2')
    expect(rail.className).not.toContain('justify-center')
  })

  test('the overflow bound is position-independent — flex-wrap + max-w survive', () => {
    const { container } = render(
      <CardControlRail controls={crowdedControls} seals={crowdedSeals} />
    )
    const rail = railEl(container)
    // These two together are what actually contain a crowded rail; the alignment
    // does not. If a re-position change drops either, a full rail spills.
    expect(rail.className).toContain('flex-wrap')
    expect(rail.className).toContain('max-w-[calc(100%-1rem)]')
  })

  test('positioning does not reorder cells — status stays leftmost', () => {
    render(<CardControlRail controls={crowdedControls} seals={crowdedSeals} />)
    const status = screen.getByRole('button', { name: /damaged/i })
    const selection = screen.getByTestId('selection-seal')
    // DOM order == visual order in a flex row: status precedes the seals.
    expect(status.compareDocumentPosition(selection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  test('no cell re-grows its own absolute — every descendant stays static', () => {
    const { container } = render(
      <CardControlRail controls={crowdedControls} seals={crowdedSeals} />
    )
    const rail = railEl(container)
    for (const cell of Array.from(rail.querySelectorAll('*'))) {
      expect(cell.classList.contains('absolute')).toBe(false)
    }
  })
})
