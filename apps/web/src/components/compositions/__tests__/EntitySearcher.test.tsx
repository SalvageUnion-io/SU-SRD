/**
 * Unit tests for the shared EntitySearcher.
 *
 * Focus: the contract that motivated the component — the pool is a list of
 * Tokens, each with a box that chooses it without opening it; opening a Token
 * shows that entity's Card with an action bar that adds or removes it; what is
 * chosen is unmistakable (the rail, the ticked box, the Card's stamp); the
 * Status facet splits chosen vs. available; budgets render honestly; and
 * toggle/count emit the caller's identity. The rail's own contract (a column
 * on a wide screen, a bar on a narrow one) is EntitySearcher.rail.test.tsx.
 * Renders against real SalvageUnionReference data (the searcher reads the ORM
 * directly).
 *
 * happy-dom's viewport is 1024px wide, exactly the 64rem breakpoint, so every
 * test renders the WIDE layout unless it narrows the window itself.
 */

import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySearcher } from '../EntitySearcher'
import { allEquipment, nth, POOL_RENDER_MS, rail } from './entitySearcherHarness'

/** The focused entity's action bar. */
function actions(name: string): HTMLElement {
  return screen.getByRole('group', { name: `${name} actions` })
}

describe('EntitySearcher — equipment (toggle mode)', () => {
  it(
    'puts Tech level beside the search, and the Show facet behind Filters',
    () => {
      render(
        <EntitySearcher schema="equipment" selected={[]} onToggle={() => {}} idOf={(i) => i.id} />
      )
      expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
      const filters = screen.getByRole('button', { name: /^filters/i })
      expect(filters.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(filters)
      expect(screen.getByRole('group', { name: /filter by show/i })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'lists an equipped item in the rail, ticks its box and stamps its Card',
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
      expect(
        screen.getByRole('button', { name: `Select ${eq.name}` }).getAttribute('aria-pressed')
      ).toBe('true')
      // Wide, the first chosen entity is focused when the picker opens.
      expect(
        within(actions(eq.name)).getByText('Equipped', { selector: '.su-badge-stamp' })
      ).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'a box toggles with idOf(item), without opening the entity',
    () => {
      const b = nth(allEquipment(), 1)
      const toggled: string[] = []
      render(
        <EntitySearcher
          schema="equipment"
          selected={[]}
          onToggle={(ref) => toggled.push(ref)}
          idOf={(i) => i.id}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: `Select ${b.name}` }))
      expect(toggled).toEqual([b.id])
      // The box chose it; it did not open it.
      expect(screen.queryByRole('group', { name: `${b.name} actions` })).toBeNull()
    },
    POOL_RENDER_MS
  )

  it(
    'opening a Token shows its Card, whose ADD names the sheet',
    () => {
      const b = nth(allEquipment(), 1)
      const toggled: string[] = []
      render(
        <EntitySearcher
          schema="equipment"
          selected={[]}
          onToggle={(ref) => toggled.push(ref)}
          idOf={(i) => i.id}
          railName="Bonesaw"
        />
      )
      fireEvent.click(screen.getByRole('button', { name: b.name }))
      fireEvent.click(within(actions(b.name)).getByRole('button', { name: 'Add to Bonesaw' }))
      expect(toggled).toEqual([b.id])
    },
    POOL_RENDER_MS
  )

  it(
    'removing from the rail or the Card emits the matched stored ref',
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
      fireEvent.click(within(rail(/selected/i)).getByRole('button', { name: `Remove ${eq.name}` }))
      fireEvent.click(within(actions(eq.name)).getByRole('button', { name: `Remove ${eq.name}` }))
      expect(toggled).toEqual([eq.id, eq.id])
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
      expect(screen.getByRole('button', { name: `Select ${b.name}` })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /^filters/i }))
      fireEvent.click(screen.getByRole('button', { name: /selected only/i }))
      expect(screen.getByRole('button', { name: `Select ${a.name}` })).toBeTruthy()
      if (b.id !== a.id) {
        expect(screen.queryByRole('button', { name: `Select ${b.name}` })).toBeNull()
      }
    },
    POOL_RENDER_MS
  )

  it(
    'shows a soft budget in the rail, over its max as critical',
    () => {
      render(
        <EntitySearcher
          schema="equipment"
          selected={[]}
          onToggle={() => {}}
          idOf={(i) => i.id}
          budget={[
            { label: 'Inventory slots', used: 2, max: 5 },
            { label: 'Weight', used: 6, max: 5 },
          ]}
        />
      )
      const region = rail(/selected/i)
      expect(within(region).getByText('Inventory slots')).toBeTruthy()
      expect(within(region).getByText('Weight')).toBeTruthy()
    },
    POOL_RENDER_MS
  )
})

describe('EntitySearcher — systems (count mode)', () => {
  it(
    'a box adds a copy and shows the count; the Card adds another or removes the last',
    () => {
      const first = SalvageUnionReference.Systems.all()[0]
      if (!first) throw new Error('No systems in reference data')
      const added: string[] = []
      const removed: number[] = []
      render(
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={[first.name, 'Not a system', first.name]}
          onAdd={(ref) => added.push(ref)}
          onRemove={(index) => removed.push(index)}
          idOf={(i) => i.name}
          chosenLabel="Installed"
        />
      )
      const box = screen.getByRole('button', { name: `Add ${first.name}` })
      expect(box.textContent).toBe('2')
      fireEvent.click(box)
      const bar = actions(first.name)
      expect(within(bar).getByText('2 Installed')).toBeTruthy()
      fireEvent.click(within(bar).getByRole('button', { name: 'Add another' }))
      fireEvent.click(within(bar).getByRole('button', { name: `Remove ${first.name}` }))
      expect(added).toEqual([first.name, first.name])
      expect(removed).toEqual([2])
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
