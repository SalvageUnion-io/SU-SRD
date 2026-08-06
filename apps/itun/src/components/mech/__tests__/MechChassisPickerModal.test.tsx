/**
 * Unit tests for MechChassisPickerModal's wiring onto the shared EntitySearcher.
 *
 * Focus: the identity contract, which is the part the migration off the bespoke
 * master/detail panes could silently get wrong. The mech record stores a chassis
 * SLUG, so the picker must emit `nameToSlug(name)` and not the searcher's default
 * (the entity name) — a mismatch here would write an unresolvable `chassisRef`
 * while every surface still rendered as if the swap had worked.
 *
 * Also pins the destructive-flow gate: Apply is inert until a DIFFERENT chassis
 * is chosen, and `onConfirm` fires only after the danger dialog is confirmed.
 *
 * Renders against real SalvageUnionReference data (preloaded via bunfig.toml);
 * the searcher reads the ORM directly, so no DB scaffolding is needed.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { MechChassisPickerModal } from '../MechChassisPickerModal'

afterEach(() => {
  cleanup()
})

/** Two distinct real chassis — the current one and the one we swap to. */
function twoChassis(): [{ name: string }, { name: string }] {
  const all = SalvageUnionReference.Chassis.all()
  const [first, second] = all
  if (!first || !second) throw new Error('Need two chassis in reference data')
  return [first, second]
}

function renderPicker(onConfirm: (ref: string) => void = () => {}) {
  const [current, other] = twoChassis()
  render(
    <MechChassisPickerModal
      open
      currentChassisRef={nameToSlug(current.name)}
      onOpenChange={() => {}}
      onConfirm={onConfirm}
    />
  )
  return { current, other }
}

describe('MechChassisPickerModal', () => {
  it('renders the shared searcher, not a bespoke master/detail pane', () => {
    renderPicker()
    // The searcher's own affordances: a text search and the pool summary.
    expect(screen.getByLabelText('Search')).toBeDefined()
    expect(screen.getByText(/showing \d+ of \d+/i)).toBeDefined()
  })

  it('pre-selects the mech’s current chassis in the rail', () => {
    const { current } = renderPicker()
    const rail = screen.getByTestId('rail-entry')
    expect(rail.textContent).toContain(current.name)
  })

  it('keeps Apply disabled until a different chassis is chosen', () => {
    const { other } = renderPicker()
    const apply = screen.getByRole('button', { name: /apply chassis/i })
    expect(apply.hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: other.name }))
    expect(screen.getByRole('button', { name: /apply chassis/i }).hasAttribute('disabled')).toBe(
      false
    )
  })

  it('confirms with the chassis SLUG, and only after the danger dialog', () => {
    const seen: string[] = []
    const { other } = renderPicker((ref) => seen.push(ref))

    fireEvent.click(screen.getByRole('radio', { name: other.name }))
    fireEvent.click(screen.getByRole('button', { name: /apply chassis/i }))
    // Apply opens the confirm; it must not have written anything yet.
    expect(seen).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: /^change chassis$/i }))
    expect(seen).toEqual([nameToSlug(other.name)])
  })
})
