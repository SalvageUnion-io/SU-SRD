/**
 * Unit tests for the shared EntitySearcher.
 *
 * Focus: the contract that motivated the component — the pool is a list of
 * Tokens, nothing open until one is; opening a Token shows that entity's Page
 * with an action bar that adds it; removing is the rail's; what is chosen is
 * unmistakable (the rail, the Token's chosen label, the Page's stamp); the
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

/** Open the list's Token for `name` (the first match: the list leads the rail). */
function openToken(name: string) {
  const [token] = screen.getAllByRole('button', { name })
  if (!token) throw new Error(`No Token named ${name}`)
  fireEvent.click(token)
}

/** The list line holding the Token for `name`. */
function line(name: string): HTMLElement {
  const el = screen.getAllByRole('button', { name })[0]?.closest<HTMLElement>('.su-searcher__item')
  if (!el) throw new Error(`No list line for ${name}`)
  return el
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
    'lists an equipped item in the rail, labels its Token and stamps its Page',
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
      const chosen = line(eq.name)
      expect(chosen.hasAttribute('data-selected')).toBe(true)
      expect(within(chosen).getByText('Equipped')).toBeTruthy()
      // Nothing is open until a Token is.
      expect(screen.queryByRole('group', { name: `${eq.name} actions` })).toBeNull()
      openToken(eq.name)
      expect(
        within(actions(eq.name)).getByText('Equipped', { selector: '.su-badge-stamp' })
      ).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'opens nothing until a Token is opened, and has no box to choose from the list',
    () => {
      const b = nth(allEquipment(), 1)
      render(
        <EntitySearcher schema="equipment" selected={[]} onToggle={() => {}} idOf={(i) => i.id} />
      )
      expect(screen.queryByRole('group', { name: /actions$/ })).toBeNull()
      expect(screen.queryByRole('button', { name: `Select ${b.name}` })).toBeNull()
      expect(line(b.name).hasAttribute('data-selected')).toBe(false)
    },
    POOL_RENDER_MS
  )

  it(
    'opening a Token shows its Page, whose ADD names the sheet',
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
      openToken(b.name)
      expect(screen.getByRole('article', { name: b.name }).querySelector('h2')).toBeTruthy()
      fireEvent.click(within(actions(b.name)).getByRole('button', { name: 'Add to Bonesaw' }))
      expect(toggled).toEqual([b.id])
    },
    POOL_RENDER_MS
  )

  it(
    'removing is the rail’s, and emits the matched stored ref',
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
      expect(toggled).toEqual([eq.id])
      // The opened Page offers no Remove (and no second Add).
      openToken(eq.name)
      expect(within(actions(eq.name)).queryAllByRole('button')).toHaveLength(0)
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
      const list = () => document.querySelector<HTMLElement>('.su-searcher__list') as HTMLElement
      expect(within(list()).getByRole('button', { name: b.name })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /^filters/i }))
      fireEvent.click(screen.getByRole('button', { name: /selected only/i }))
      expect(within(list()).getByRole('button', { name: a.name })).toBeTruthy()
      if (b.name !== a.name) {
        expect(within(list()).queryByRole('button', { name: b.name })).toBeNull()
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
    'a Token shows its count; the Page adds another',
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
      expect(within(line(first.name)).getByText('2 Installed')).toBeTruthy()
      openToken(first.name)
      const bar = actions(first.name)
      expect(within(bar).getByText('2 Installed')).toBeTruthy()
      fireEvent.click(within(bar).getByRole('button', { name: 'Add another' }))
      expect(within(bar).queryByRole('button', { name: `Remove ${first.name}` })).toBeNull()
      expect(added).toEqual([first.name])
      expect(removed).toEqual([])
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
