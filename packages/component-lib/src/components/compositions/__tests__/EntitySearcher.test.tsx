/**
 * Unit tests for the shared EntitySearcher.
 *
 * Focus: the legibility contract that motivated the component — equipped items
 * are unmistakable (rail + Equipped tag), the Status facet splits equipped vs.
 * available, the budget track renders honestly, and toggle/count emit the
 * caller's identity. Then the rail's own contract: it is a named region that
 * never sits over the results — a collapsed disclosure band on a narrow screen,
 * an always-open column on a wide one, a one-line bar in single mode — and a
 * Remove hands focus on instead of dropping it. Renders against real
 * SalvageUnionReference data (the searcher reads the ORM directly).
 *
 * happy-dom's viewport is 1024px wide, below the rail's 80rem breakpoint, so
 * every test renders the NARROW rail unless it widens the window itself.
 */

import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { allEquipment, expand, nth, POOL_RENDER_MS, rail } from './entitySearcherHarness'

describe('EntitySearcher — equipment (toggle mode)', () => {
  it(
    'renders a Tech level and a Show facet',
    () => {
      render(
        <EntitySearcher schema="equipment" selected={[]} onToggle={() => {}} idOf={(i) => i.id} />
      )
      expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
      expect(screen.getByRole('group', { name: /filter by show/i })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'lists an equipped item in the rail with an Equipped tag',
    () => {
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
      const entry = screen.getByTestId('rail-entry')
      expect(within(entry).getByText(eq.name)).toBeTruthy()
      expect(screen.getByText('Equipped', { selector: '.su-badge-stamp' })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'clicking an unselected card toggles with idOf(item)',
    () => {
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
    },
    POOL_RENDER_MS
  )

  it(
    'removing from the rail emits the matched stored ref',
    () => {
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
      const region = rail(/selected/i)
      expand(region)
      fireEvent.click(within(region).getByRole('button', { name: `Remove ${eq.name}` }))
      expect(toggled).toEqual([eq.id])
    },
    POOL_RENDER_MS
  )

  it(
    'the Status facet filters to selected-only',
    () => {
      const a = nth(allEquipment(), 0)
      const b = nth(allEquipment(), 1)
      render(
        <EntitySearcher
          schema="equipment"
          selected={[a.id]}
          onToggle={() => {}}
          idOf={(i) => i.id}
        />
      )
      expect(screen.getAllByRole('button', { name: a.name }).length).toBeGreaterThan(0)
      fireEvent.click(screen.getByRole('button', { name: /selected only/i }))
      expect(screen.getAllByRole('button', { name: a.name }).length).toBeGreaterThan(0)
      if (b.id !== a.id) {
        expect(screen.queryByRole('button', { name: b.name })).toBeNull()
      }
    },
    POOL_RENDER_MS
  )

  it(
    'renders a soft budget track when budget is provided',
    () => {
      render(
        <EntitySearcher
          schema="equipment"
          selected={[]}
          onToggle={() => {}}
          idOf={(i) => i.id}
          budget={{ label: 'Inventory slots', used: 2, max: 5 }}
        />
      )
      expand(rail(/selected/i))
      expect(screen.getByText('2 / 5')).toBeTruthy()
      expect(screen.getByRole('img', { name: 'Inventory slots 2 of 5' })).toBeTruthy()
    },
    POOL_RENDER_MS
  )
})

describe('EntitySearcher — systems (count mode)', () => {
  it(
    'shows an Add affordance and emits idOf on add',
    () => {
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
    },
    POOL_RENDER_MS
  )

  it(
    'names each duplicate copy’s Remove, and removes that copy by index',
    () => {
      const first = SalvageUnionReference.Systems.all()[0]
      if (!first) throw new Error('No systems in reference data')
      const removed: number[] = []
      render(
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={[first.name, first.name]}
          onRemove={(index) => removed.push(index)}
          chosenLabel="Installed"
        />
      )
      const region = rail(/installed/i)
      expand(region)
      expect(
        within(region).getByRole('button', { name: `Remove ${first.name}, copy 1 of 2` })
      ).toBeTruthy()
      fireEvent.click(
        within(region).getByRole('button', { name: `Remove ${first.name}, copy 2 of 2` })
      )
      expect(removed).toEqual([1])
    },
    POOL_RENDER_MS
  )
})
