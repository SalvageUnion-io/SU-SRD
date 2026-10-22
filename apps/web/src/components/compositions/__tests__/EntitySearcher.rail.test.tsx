/**
 * EntitySearcher — the rail, and the narrow layout's Page takeover, on each
 * viewport. Split from EntitySearcher.test.tsx (the suite's contract and the
 * viewport note are there) so the parallel runner can spread the pool renders
 * over its workers.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EntitySearcher } from '../EntitySearcher'
import type { Equip } from './entitySearcherHarness'
import {
  allEquipment,
  ControlledEquipment,
  expand,
  nth,
  POOL_RENDER_MS,
  rail,
  setViewport,
  threeEquipment,
} from './entitySearcherHarness'

const initial = { width: window.innerWidth, height: window.innerHeight }

describe('EntitySearcher — a phone (390×844)', () => {
  // The viewport is process-global (happy-dom's window), so put it back.
  beforeEach(() => setViewport(390, 844))
  afterEach(() => setViewport(initial.width, initial.height))

  it(
    'puts the rail in a bar BELOW the list, in DOM (and so focus) order',
    () => {
      const eq = nth(allEquipment(), 0)
      render(<ControlledEquipment initial={[eq.id]} />)
      const summary = screen.getByText(/showing \d+ of \d+/i)
      expect(
        rail().compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_PRECEDING
      ).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'starts collapsed: count and budget at a glance, the entries folded away',
    () => {
      const eq = nth(allEquipment(), 0)
      render(
        <EntitySearcher
          schema="equipment"
          selected={[eq.id]}
          onToggle={() => {}}
          idOf={(i) => i.id}
          chosenLabel="Equipped"
          budget={{ label: 'Inventory slots', used: 2, max: 5 }}
        />
      )
      const region = rail()
      const toggle = within(region).getByRole('button', { expanded: false })
      // The count is the heading Slab's, at its rule's end.
      expect(within(region).getByText('1')).toBeTruthy()
      const list = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
      expect(list?.hidden).toBe(true)
      expect(within(region).getByText('Inventory slots')).toBeTruthy()

      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(list?.hidden).toBe(false)
      expect(within(region).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()

      fireEvent.click(toggle)
      expect(list?.hidden).toBe(true)
    },
    POOL_RENDER_MS
  )

  it(
    'hands focus to the entry now in the removed one’s place, then to the toggle',
    () => {
      const [a, b, c] = threeEquipment()
      render(<ControlledEquipment initial={[a.id, b.id, c.id]} />)
      const region = rail()
      const toggle = expand(region)
      const removeButton = (eq: Equip) =>
        within(region).getByRole('button', { name: `Remove ${eq.name}` })

      // A middle entry → the one that slid up into its place.
      fireEvent.click(removeButton(b))
      expect(document.activeElement).toBe(removeButton(c))
      // The last entry → the one before it.
      fireEvent.click(removeButton(c))
      expect(document.activeElement).toBe(removeButton(a))
      // The only entry → the rail's own heading control, never <body>.
      fireEvent.click(removeButton(a))
      expect(document.activeElement).toBe(toggle)
      expect(within(region).getByText('Nothing equipped yet.')).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'announces the count politely, and only once it changes',
    () => {
      const eq = nth(allEquipment(), 0)
      render(<ControlledEquipment initial={[]} />)
      const status = screen.getByRole('status')
      expect(status.getAttribute('aria-live')).toBe('polite')
      expect(status.textContent).toBe('')

      fireEvent.click(screen.getByRole('button', { name: eq.name }))
      const bar = screen.getByRole('group', { name: `${eq.name} actions` })
      fireEvent.click(within(bar).getByRole('button', { name: /^add/i }))
      expect(status.textContent).toBe('1 equipped')
    },
    POOL_RENDER_MS
  )

  it(
    'keeps the header short: search in reach, every facet folded behind Filters',
    () => {
      render(<ControlledEquipment initial={[]} />)
      expect(screen.getByLabelText('Search')).toBeTruthy()
      const filters = screen.getByRole('button', { name: /^filters/i })
      expect(filters.getAttribute('aria-expanded')).toBe('false')
      const panel = document.getElementById(filters.getAttribute('aria-controls') ?? '')
      expect(panel?.hidden).toBe(true)

      fireEvent.click(filters)
      expect(panel?.hidden).toBe(false)
      // Narrow, even Tech level folds: no chip row beside the search field.
      expect(
        within(panel as HTMLElement).getByRole('group', { name: /filter by tech level/i })
      ).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /equipped only/i }))
      // Folded again, the toggle still says a filter is applied.
      fireEvent.click(filters)
      expect(screen.getByRole('button', { name: 'Filters 1 active' })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'opens a Mini as its Page over the whole picker, and Back returns to that Mini',
    () => {
      const eq = nth(allEquipment(), 0)
      render(<ControlledEquipment initial={[]} />)
      // Nothing is focused on a phone until a Mini is opened.
      expect(screen.queryByRole('button', { name: /back to list/i })).toBeNull()
      const token = screen.getByRole('button', { name: eq.name })
      fireEvent.click(token)

      const back = screen.getByRole('button', { name: /back to list/i })
      expect(document.activeElement).toBe(back)
      // The list, the toolbar and the rail step aside; the list stays mounted.
      expect(token.closest('.su-searcher__browser')?.hasAttribute('hidden')).toBe(true)
      expect(screen.queryByLabelText('Search')).toBeNull()
      const bar = screen.getByRole('group', { name: `${eq.name} actions` })
      fireEvent.click(within(bar).getByRole('button', { name: /^add/i }))
      expect(screen.getByRole('status').textContent).toBe('1 equipped')

      fireEvent.click(back)
      expect(screen.queryByRole('group', { name: `${eq.name} actions` })).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: eq.name }))
    },
    POOL_RENDER_MS
  )

  it(
    'lets the body shrink and scroll under a viewport-capped frame',
    () => {
      // The phone bug: the header filled the screen and the bare popup's
      // `overflow: hidden` left the results and the selection unreachable. The
      // fix is a chain — frame capped, body allowed to shrink, `.su-searcher`
      // filling it and each part scrolling alone — and this pins the links the
      // component owns (the stylesheet supplies the rest).
      render(<ControlledEquipment initial={[]} />)
      const searcher = document.querySelector<HTMLElement>('.su-searcher')
      expect(searcher?.parentElement?.style.minHeight).toMatch(/^0(px)?$/)
      expect(rail().closest('.su-searcher')).toBe(searcher ?? null)
    },
    POOL_RENDER_MS
  )
})

describe('EntitySearcher — the rail on a wide screen', () => {
  beforeEach(() => setViewport(1440, 900))
  afterEach(() => setViewport(initial.width, initial.height))

  it(
    'is an always-open column with a plain heading, AFTER the list',
    () => {
      const eq = nth(allEquipment(), 0)
      render(
        <EntitySearcher
          schema="equipment"
          selected={[eq.id]}
          onToggle={() => {}}
          idOf={(i) => i.id}
          chosenLabel="Equipped"
          budget={{ label: 'Inventory slots', used: 2, max: 5 }}
          onClose={() => {}}
        />
      )
      const region = rail()
      expect(region.querySelector('[aria-expanded]')).toBeNull()
      expect(within(region).getByRole('heading', { name: /equipped/i })).toBeTruthy()
      expect(within(region).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
      // The sidebar's Minis leave the Tech level to the list.
      expect(within(within(region).getByTestId('rail-entry')).queryByText('TL')).toBeNull()
      expect(within(region).getByText('Inventory slots')).toBeTruthy()
      expect(within(region).getByRole('button', { name: 'Done' })).toBeTruthy()
      const summary = screen.getByText(/showing \d+ of \d+/i)
      expect(
        region.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_PRECEDING
      ).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'becomes the column when the viewport widens past the breakpoint',
    () => {
      // Mounted narrow, then widened. (Only this direction is testable: happy-dom's
      // MediaQueryList seeds its last-seen state as `false`, not the real one, so
      // it never reports a query that STARTS true going false.)
      setViewport(800, 900)
      const eq = nth(allEquipment(), 0)
      render(<ControlledEquipment initial={[eq.id]} />)
      expect(within(rail()).getByRole('button', { expanded: false })).toBeTruthy()
      setViewport(1440, 900)
      expect(rail().querySelector('[aria-expanded]')).toBeNull()
      expect(within(rail()).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'a chosen Mini in the rail opens that entity’s Page',
    () => {
      const [a, b] = threeEquipment()
      render(<ControlledEquipment initial={[a.id, b.id]} />)
      // Nothing is open until a Mini is, even with entities chosen.
      expect(screen.queryByRole('group', { name: `${a.name} actions` })).toBeNull()
      fireEvent.click(within(rail()).getByRole('button', { name: b.name }))
      expect(screen.getByRole('group', { name: `${b.name} actions` })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'focuses the heading once the last entry is removed',
    () => {
      const eq = nth(allEquipment(), 0)
      render(<ControlledEquipment initial={[eq.id]} />)
      const region = rail()
      fireEvent.click(within(region).getByRole('button', { name: `Remove ${eq.name}` }))
      expect(document.activeElement).toBe(
        within(region).getByRole('heading', { name: /equipped/i })
      )
    },
    POOL_RENDER_MS
  )
})
