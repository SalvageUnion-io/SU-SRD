/**
 * SelCard `disabledReason` tests (wizard-refresh Phase 2): the reason renders
 * as a cond-caps footMeta chip and dims the card. Inert chrome this phase —
 * nothing drives it until the Phase 3–5 rules engines land.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
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
