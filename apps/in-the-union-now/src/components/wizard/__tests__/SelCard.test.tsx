/**
 * SelCard `disabledReason` tests (wizard-refresh Phase 2): the reason renders
 * as a cond-caps footMeta chip and dims the card. Phase 3 adds the
 * count-stepper trio (`count`/`onCountChange`/`maxCount`, mockup `.ctr`) —
 * a [− n +] control through the entity card's footActions band.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { SelCard } from '../SelCard'

beforeAll(async () => {
  // ReferenceEntityDisplay renders trait keywords inline, so preload 'all'
  // like the wizard integration tests do.
  await SalvageUnionReference.preload('all')
})

afterEach(cleanup)

function firstEquipment() {
  const item = SalvageUnionReference.Equipment.all()[0]
  if (!item) throw new Error('no equipment loaded')
  return item
}

describe('SelCard disabledReason', () => {
  test('renders the reason as a footMeta chip and dims/inerts the card', () => {
    const entity = firstEquipment()
    const { container } = render(
      <SelCard
        entity={entity}
        name={entity.name}
        selected={false}
        onToggle={() => {}}
        disabledReason="Needs 6 Slots · 2 Left"
      />
    )
    expect(screen.getByText('Needs 6 Slots · 2 Left')).toBeTruthy()
    // Dimmed + pointer-inert wrapper (happy-dom has no layout engine — assert
    // the classes, per the repo's responsive-test convention).
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('opacity-50')
    expect(wrapper?.className).toContain('pointer-events-none')
    expect(wrapper?.className).toContain('saturate-50')
  })

  test('without a reason the card stays interactive and shows no chip', () => {
    const entity = firstEquipment()
    let toggled = false
    const { container } = render(
      <SelCard
        entity={entity}
        name={entity.name}
        selected={false}
        onToggle={() => {
          toggled = true
        }}
      />
    )
    expect(screen.queryByText(/Needs 6 Slots/i)).toBeNull()
    expect(container.firstElementChild?.className ?? '').not.toContain('opacity-50')
    const ring = screen.getByRole('button', { name: entity.name })
    ring.click()
    expect(toggled).toBe(true)
  })
})

describe('SelCard count-stepper', () => {
  test('renders [− n +] through footActions and steps the count', () => {
    const entity = firstEquipment()
    const changes: number[] = []
    render(
      <SelCard
        entity={entity}
        name={entity.name}
        selected
        onToggle={() => {}}
        count={1}
        maxCount={2}
        onCountChange={(next) => changes.push(next)}
      />
    )
    const value = screen.getByRole('spinbutton', { name: `${entity.name} count` })
    expect(value.getAttribute('aria-valuenow')).toBe('1')
    expect(value.getAttribute('aria-valuemax')).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: `Add one ${entity.name}` }))
    fireEvent.click(screen.getByRole('button', { name: `Remove one ${entity.name}` }))
    expect(changes).toEqual([2, 0])
  })

  test('+ disables at maxCount and − disables at zero', () => {
    const entity = firstEquipment()
    const { rerender } = render(
      <SelCard
        entity={entity}
        name={entity.name}
        selected
        onToggle={() => {}}
        count={2}
        maxCount={2}
        onCountChange={() => {}}
      />
    )
    const plus = screen.getByRole('button', { name: `Add one ${entity.name}` })
    expect((plus as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: `Remove one ${entity.name}` }) as HTMLButtonElement)
        .disabled
    ).toBe(false)

    rerender(
      <SelCard
        entity={entity}
        name={entity.name}
        selected={false}
        onToggle={() => {}}
        count={0}
        maxCount={2}
        onCountChange={() => {}}
      />
    )
    expect(
      (screen.getByRole('button', { name: `Remove one ${entity.name}` }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: `Add one ${entity.name}` }) as HTMLButtonElement).disabled
    ).toBe(false)
  })

  test('stepper clicks do not bubble into the Sel ring toggle', () => {
    const entity = firstEquipment()
    let toggled = 0
    render(
      <SelCard
        entity={entity}
        name={entity.name}
        selected
        onToggle={() => {
          toggled += 1
        }}
        count={1}
        maxCount={2}
        onCountChange={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: `Add one ${entity.name}` }))
    fireEvent.click(screen.getByRole('button', { name: `Remove one ${entity.name}` }))
    expect(toggled).toBe(0)
  })

  test('without the counter props no spinbutton renders (toggle mode unchanged)', () => {
    const entity = firstEquipment()
    render(<SelCard entity={entity} name={entity.name} selected={false} onToggle={() => {}} />)
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })
})
