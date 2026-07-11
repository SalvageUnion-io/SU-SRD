/**
 * Unit tests for CraftItemsStep (wizard-refresh Phase 4): the create-mode
 * Craft your Systems / Modules grid. Pins the two enforcement mechanics —
 * the per-copy `+` clamp (maxCount from the SHARED scrap pool + the step's
 * slot budget) and the dimmed-with-reason card (mockup Screen 02) — plus the
 * Tech-1 filter and the SUGGESTED pill.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CraftItemsStep } from '../CraftItemsStep'
import { must } from '../../__tests__/must'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

afterEach(cleanup)

function tl1System(predicate: (s: { salvageValue: number; slotsRequired: number }) => boolean) {
  const found = SalvageUnionReference.Systems.find((s) => s.techLevel === 1 && predicate(s))
  return must(found, 'expected a Tech 1 system matching the fixture predicate')
}

describe('CraftItemsStep — Tech-1 filter', () => {
  test('renders only Tech 1 items; higher tiers are never shown', () => {
    render(
      <CraftItemsStep
        kind="systems"
        selected={[]}
        onCountChange={() => {}}
        scrapRemaining={20}
        slotsRemaining={20}
      />
    )
    const higher = SalvageUnionReference.Systems.find((s) => s.techLevel === 2)
    expect(higher).toBeDefined()
    expect(screen.queryByRole('button', { name: `Add one ${must(higher).name}` })).toBeNull()
    const legal = tl1System(() => true)
    expect(screen.getByRole('button', { name: `Add one ${legal.name}` })).toBeTruthy()
  })
})

describe('CraftItemsStep — budget clamps (single source of truth)', () => {
  test('+ enabled at 0 with one affordable copy, disabled once it is taken', () => {
    const item = tl1System((s) => s.salvageValue === 2)
    // scrapRemaining 3 fits ONE sv-2 copy (maxCount = count + 1), not two.
    const { rerender } = render(
      <CraftItemsStep
        kind="systems"
        selected={[]}
        onCountChange={() => {}}
        scrapRemaining={3}
        slotsRemaining={20}
      />
    )
    expect(
      (screen.getByRole('button', { name: `Add one ${item.name}` }) as HTMLButtonElement).disabled
    ).toBe(false)

    // With the one copy taken (scrap now 1, sv 2), a second overspends → + off.
    rerender(
      <CraftItemsStep
        kind="systems"
        selected={[item.id]}
        onCountChange={() => {}}
        scrapRemaining={1}
        slotsRemaining={18}
      />
    )
    expect(
      (screen.getByRole('button', { name: `Add one ${item.name}` }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  test('an unaffordable-first-copy card dims with the SCRAP reason chip', () => {
    // Slots don't bind (20 remaining) — only the scrap pool blocks the copy.
    const item = tl1System((s) => s.salvageValue > 2)
    render(
      <CraftItemsStep
        kind="systems"
        selected={[]}
        onCountChange={() => {}}
        scrapRemaining={2}
        slotsRemaining={20}
      />
    )
    expect(screen.getAllByText(`Needs ${item.salvageValue} scrap · 2 left`).length).toBeGreaterThan(
      0
    )
  })

  test('a card that no longer fits the slot budget carries the SLOTS reason chip', () => {
    const item = tl1System((s) => s.slotsRequired >= 2)
    render(
      <CraftItemsStep
        kind="systems"
        selected={[]}
        onCountChange={() => {}}
        scrapRemaining={20}
        slotsRemaining={1}
      />
    )
    expect(
      screen.getAllByText(
        `Needs ${item.slotsRequired} slot${item.slotsRequired === 1 ? '' : 's'} · 1 left`
      ).length
    ).toBeGreaterThan(0)
  })

  test('a card with copies keeps its stepper active even when + is exhausted', () => {
    const item = tl1System((s) => s.salvageValue >= 1)
    render(
      <CraftItemsStep
        kind="systems"
        selected={[item.id]}
        onCountChange={() => {}}
        scrapRemaining={0}
        slotsRemaining={0}
      />
    )
    const plus = screen.getByRole('button', {
      name: `Add one ${item.name}`,
    }) as HTMLButtonElement
    const minus = screen.getByRole('button', {
      name: `Remove one ${item.name}`,
    }) as HTMLButtonElement
    expect(plus.disabled).toBe(true) // maxCount === count
    expect(minus.disabled).toBe(false) // refunds stay available
  })
})

describe('CraftItemsStep — SUGGESTED pill', () => {
  test('recommended items carry the pill', () => {
    const recommended = SalvageUnionReference.Systems.find(
      (s) => s.techLevel === 1 && s.recommended === true
    )
    expect(recommended, 'expected a recommended Tech 1 system in the catalog').toBeDefined()
    render(
      <CraftItemsStep
        kind="systems"
        selected={[]}
        onCountChange={() => {}}
        scrapRemaining={20}
        slotsRemaining={20}
      />
    )
    expect(screen.getAllByText('Suggested').length).toBeGreaterThan(0)
  })
})
