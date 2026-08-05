/**
 * Unit tests for the shared EntitySearcher.
 *
 * Focus: the legibility contract that motivated the component — equipped items
 * are unmistakable (rail + Equipped tag), the Status facet splits equipped vs.
 * available, the budget track renders honestly, and toggle/count emit the
 * caller's identity. Renders against real SalvageUnionReference data (the
 * searcher reads the ORM directly).
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'

afterEach(() => {
  cleanup()
})

type Equip = { id: string; name: string; techLevel: number | 'B' | 'N' }

function allEquipment(): Equip[] {
  return SalvageUnionReference.Equipment.all()
}

function nth(list: Equip[], i: number): Equip {
  const item = list[i]
  if (!item) throw new Error(`No equipment at index ${i} in reference data`)
  return item
}

describe('EntitySearcher — equipment (toggle mode)', () => {
  it('renders a Tech level and a Show facet', () => {
    render(
      <EntitySearcher schema="equipment" selected={[]} onToggle={() => {}} idOf={(i) => i.id} />
    )
    expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /filter by show/i })).toBeTruthy()
  })

  it('lists an equipped item in the rail with an Equipped tag', () => {
    const eq = nth(allEquipment(), 0)
    render(
      <EntitySearcher
        schema="equipment"
        selected={[eq.id]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        chosenLabel="Equipped"
      />
    )
    const rail = screen.getByTestId('rail-entry')
    expect(within(rail).getByText(eq.name)).toBeTruthy()
    expect(screen.getByText(/Equipped ✓/)).toBeTruthy()
  })

  it('clicking an unselected card toggles with idOf(item)', () => {
    const eq = nth(allEquipment(), 0)
    const toggled: string[] = []
    render(
      <EntitySearcher
        schema="equipment"
        selected={[]}
        onToggle={(ref) => toggled.push(ref)}
        idOf={(i) => i.id}
      />
    )
    const toggleBtn = screen.getAllByRole('button', { name: eq.name })[0]
    if (!toggleBtn) throw new Error('no toggle button rendered')
    fireEvent.click(toggleBtn)
    expect(toggled).toEqual([eq.id])
  })

  it('removing from the rail emits the matched stored ref', () => {
    const eq = nth(allEquipment(), 0)
    const toggled: string[] = []
    render(
      <EntitySearcher
        schema="equipment"
        selected={[eq.id]}
        onToggle={(ref) => toggled.push(ref)}
        idOf={(i) => i.id}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Remove ${eq.name}`, 'i') }))
    expect(toggled).toEqual([eq.id])
  })

  it('the Status facet filters to selected-only', () => {
    const a = nth(allEquipment(), 0)
    const b = nth(allEquipment(), 1)
    render(
      <EntitySearcher schema="equipment" selected={[a.id]} onToggle={() => {}} idOf={(i) => i.id} />
    )
    expect(screen.getAllByRole('button', { name: a.name }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /selected only/i }))
    expect(screen.getAllByRole('button', { name: a.name }).length).toBeGreaterThan(0)
    if (b.id !== a.id) {
      expect(screen.queryByRole('button', { name: b.name })).toBeNull()
    }
  })

  it('renders a soft budget track when budget is provided', () => {
    render(
      <EntitySearcher
        schema="equipment"
        selected={[]}
        onToggle={() => {}}
        idOf={(i) => i.id}
        budget={{ label: 'Inventory slots', used: 2, max: 5 }}
      />
    )
    expect(screen.getByText('2 / 5')).toBeTruthy()
  })
})

describe('EntitySearcher — systems (count mode)', () => {
  it('shows an Add affordance and emits idOf on add', () => {
    const sys = SalvageUnionReference.Systems.all()
    const first = sys[0]
    if (!first) throw new Error('No systems in reference data')
    const added: string[] = []
    render(
      <EntitySearcher
        schema="systems"
        mode="count"
        selected={[]}
        onAdd={(ref) => added.push(ref)}
        idOf={(i) => i.name}
        chosenLabel="Installed"
      />
    )
    const addBtn = screen.getAllByRole('button', {
      name: new RegExp(`Add ${first.name}`, 'i'),
    })[0]
    if (!addBtn) throw new Error('no Add button rendered')
    fireEvent.click(addBtn)
    expect(added).toEqual([first.name])
  })
})
