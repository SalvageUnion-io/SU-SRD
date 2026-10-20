/**
 * A card's controls, condition and seal live in its head (`chips-and-actions.md`
 * C8, hard rule R6, ruleset §7.2): the condition and a count's stepper in the
 * chip group's state slot, every other control its last slot, the select seal
 * on the band's right. Nothing rides the frame, and nothing sits under the
 * strip or in the body.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const equipment = () => {
  const found = SalvageUnionReference.Equipment.all()[0]
  if (!found) throw new Error('no equipment in fixtures')
  return found
}

const lane = (el: HTMLElement) => el.closest('[data-chip-class]')?.getAttribute('data-chip-class')
const head = (el: HTMLElement) => el.closest('.su-entity-compact__head')

describe("a card's head carries its controls", () => {
  test('a control is the chip group last slot; the seal sits on the band', () => {
    const { container } = render(
      <ReferenceEntityCard
        data={equipment()}
        selected
        selectionSeal="Equipped"
        controls={[{ key: 'swap', ariaLabel: 'Swap', label: 'Swap', onClick: () => {} }]}
      />
    )
    const seal = screen.getByText('Equipped')
    const control = screen.getByRole('button', { name: 'Swap' })
    expect(lane(control)).toBe('menu')
    expect(head(seal)).not.toBeNull()
    expect(head(seal)).toBe(head(control))
    // No rail rides the frame.
    expect(container.querySelector('[data-card-rail]')).toBeNull()
  })

  test('the condition and a danger control sit in the head, not in a body rail', () => {
    render(
      <ReferenceEntityCard
        data={equipment()}
        status="damaged"
        controls={[
          { key: 'status', status: { value: 'damaged', onClick: () => {}, subject: 'Kit' } },
          {
            key: 'remove',
            ariaLabel: 'Remove',
            label: 'Remove',
            variant: 'danger',
            onClick: () => {},
          },
        ]}
      />
    )
    const status = screen.getByRole('button', { name: /^Kit status: Damaged/ })
    const remove = screen.getByRole('button', { name: 'Remove' })
    expect(lane(status)).toBe('state')
    expect(lane(remove)).toBe('menu')
    expect(head(status)).toBe(head(remove))
  })

  test('a status control names the state its cycle leads to', () => {
    render(
      <ReferenceEntityCard
        data={equipment()}
        status="damaged"
        controls={[
          {
            key: 'status',
            status: { value: 'damaged', onClick: () => {}, subject: 'Bay', next: 'intact' },
          },
        ]}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Bay status: Damaged. Activate to mark Intact' })
    ).toBeTruthy()
  })

  test('a stepper is the state slot, a Mini Stat in edit mode', () => {
    render(
      <ReferenceEntityCard
        data={equipment()}
        controls={[
          {
            key: 'qty',
            stepper: { label: 'Qty', value: 1, onChange: () => {}, subject: 'quantity' },
          },
        ]}
      />
    )
    const plus = screen.getByRole('button', { name: 'Increase quantity' })
    expect(lane(plus)).toBe('state')
  })
})

// Print reads, pencil writes (ruleset §1): a card with no status control is a
// read, so its condition is a read-out, never a control.
describe('read-state condition', () => {
  test.each(['head', 'full'] as const)('Intact prints nothing on a read %s card', (extent) => {
    render(<ReferenceEntityCard data={equipment()} extent={extent} status="intact" />)
    expect(screen.queryByText('Intact')).toBeNull()
    expect(screen.queryByText('Damaged')).toBeNull()
    expect(screen.queryByText('Destroyed')).toBeNull()
  })

  test('a damaged read card prints one StatusBadge in the state slot, nothing to press', () => {
    render(<ReferenceEntityCard data={equipment()} status="damaged" />)
    const badge = screen.getByText('Damaged')
    expect(lane(badge)).toBe('state')
    expect(screen.queryByText('Intact')).toBeNull()
    expect(screen.queryByRole('button', { name: /status/i })).toBeNull()
  })
})
