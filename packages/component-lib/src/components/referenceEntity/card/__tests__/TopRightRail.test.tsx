/**
 * The top-right rail — every seal and the controls cluster share ONE row.
 *
 * These were four independent `absolute right-{0,2}` nodes at z-30, all pinned
 * to the same coordinate: a card carrying two of them (controls + a condition
 * status, or a multi-select stepper + controls) painted them ON TOP of one
 * another. The regression is invisible to a "did it render" assertion — both
 * nodes are in the DOM either way — so these tests assert the LAYOUT
 * relationship instead: a common flex-row parent, and no stray absolute
 * positioning on the individual cells.
 */
import { beforeAll, describe, expect, test, afterEach } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const equipment = () => {
  const found = SalvageUnionReference.Equipment.all()[0]
  if (!found) throw new Error('no equipment in fixtures')
  return found
}

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(cleanup)

/** The nearest ancestor that lays its children out in a row. */
function rail(el: HTMLElement): HTMLElement {
  const parent = el.closest('div.flex') as HTMLElement | null
  if (!parent) throw new Error('no flex ancestor — the cell is not in a row')
  return parent
}

describe('top-right rail', () => {
  test('a status seal and a control share one flex row', () => {
    render(
      <ReferenceEntityCard
        data={equipment()}
        status="damaged"
        onStatusClick={() => {}}
        controls={[{ key: 'remove', ariaLabel: 'Remove', label: 'Remove', onClick: () => {} }]}
      />
    )

    const status = screen.getByRole('button', { name: /damaged/i })
    const control = screen.getByRole('button', { name: 'Remove' })

    // The whole point: one shared row, not two overlapping absolute nodes.
    expect(rail(status).contains(control)).toBe(true)
  })

  test('the rail is the only absolutely-positioned node — cells are static', () => {
    const { container } = render(
      <ReferenceEntityCard
        data={equipment()}
        status="intact"
        onStatusClick={() => {}}
        controls={[{ key: 'swap', ariaLabel: 'Swap', label: 'Swap', onClick: () => {} }]}
      />
    )

    const status = screen.getByRole('button', { name: /intact/i })
    const row = rail(status)

    expect(row.className).toContain('absolute')
    expect(row.className).toContain('flex-wrap')
    // A cell that re-grows its own `absolute` is the exact regression: it would
    // leave the row and re-stack on whatever else claims that coordinate.
    for (const cell of Array.from(row.children)) {
      expect(cell.className).not.toContain('absolute')
    }
    expect(container.querySelectorAll('.z-30').length).toBeLessThanOrEqual(2)
  })
})
