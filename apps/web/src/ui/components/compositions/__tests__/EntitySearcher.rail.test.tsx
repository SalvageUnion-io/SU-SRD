/**
 * EntitySearcher — the rail on each viewport. Split from EntitySearcher.test.tsx (the suite's
 * contract and the narrow-viewport note are there) so the parallel runner can
 * spread the pool renders over its workers.
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

describe('EntitySearcher — the rail on a narrow screen', () => {
  it(
    'is a named region ABOVE the pool, in DOM (and so focus) order',
    () => {
      const eq = nth(allEquipment(), 0)
      render(<ControlledEquipment initial={[eq.id]} />)
      const summary = screen.getByText(/showing \d+ of \d+/i)
      expect(
        rail().compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING
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
      expect(toggle.textContent).toContain('1')
      const list = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
      expect(list?.hidden).toBe(true)
      expect(within(region).getByText('2/5')).toBeTruthy()
      expect(within(region).queryByRole('button', { name: /^Remove/ })).toBeNull()

      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(list?.hidden).toBe(false)
      expect(within(region).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
      // Expanded, the one-line readout gives way to the full pip track.
      expect(within(region).getByRole('img', { name: 'Inventory slots 2 of 5' })).toBeTruthy()
      expect(within(region).queryByText('2/5')).toBeNull()

      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
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
      const status = within(rail()).getByRole('status')
      expect(status.getAttribute('aria-live')).toBe('polite')
      expect(status.textContent).toBe('')

      const card = screen.getAllByRole('button', { name: eq.name })[0]
      if (!card) throw new Error('no pool card rendered')
      fireEvent.click(card)
      expect(status.textContent).toBe('1 equipped')
    },
    POOL_RENDER_MS
  )
})

describe('EntitySearcher — a phone (390×844)', () => {
  const initial = { width: window.innerWidth, height: window.innerHeight }
  // The viewport is process-global (happy-dom's window), so put it back.
  beforeEach(() => setViewport(390, 844))
  afterEach(() => setViewport(initial.width, initial.height))

  it(
    'keeps the header short: search in reach, the facet rows folded behind Filters',
    () => {
      render(<ControlledEquipment initial={[]} />)
      expect(screen.getByLabelText('Search')).toBeTruthy()
      const filters = screen.getByRole('button', { name: /^filters/i })
      expect(filters.getAttribute('aria-expanded')).toBe('false')
      const panel = document.getElementById(filters.getAttribute('aria-controls') ?? '')
      expect(panel?.hidden).toBe(true)
      expect(screen.queryByRole('group', { name: /filter by tech level/i })).toBeNull()

      fireEvent.click(filters)
      expect(filters.getAttribute('aria-expanded')).toBe('true')
      expect(panel?.hidden).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: /equipped only/i }))
      // Folded again, the toggle still says a filter is applied.
      fireEvent.click(filters)
      expect(screen.getByRole('button', { name: 'Filters 1 active' })).toBeTruthy()
    },
    POOL_RENDER_MS
  )

  it(
    'lets the body shrink and scroll under a viewport-capped frame',
    () => {
      // The phone bug: the header filled the screen and the bare popup's
      // `overflow: hidden` left the results and the selection unreachable. The
      // fix is a chain — frame capped, body allowed to shrink, `.su-searcher` the
      // scroll container that fills it — and this pins the two links the
      // component owns (the stylesheet supplies the third).
      render(<ControlledEquipment initial={[]} />)
      const scroller = document.querySelector<HTMLElement>('.su-searcher')
      const body = scroller?.parentElement
      expect(body?.style.minHeight).toMatch(/^0(px)?$/)
      expect(rail().parentElement).toBe(scroller ?? null)
    },
    POOL_RENDER_MS
  )
})

describe('EntitySearcher — a tablet (1024×768)', () => {
  it(
    'opens Filters by default: there is room for the facet rows',
    () => {
      render(<ControlledEquipment initial={[]} />)
      expect(screen.getByRole('button', { name: /^filters/i }).getAttribute('aria-expanded')).toBe(
        'true'
      )
      expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
    },
    POOL_RENDER_MS
  )
})

describe('EntitySearcher — the rail on a wide screen', () => {
  const initial = { width: window.innerWidth, height: window.innerHeight }
  // The viewport is process-global (happy-dom's window), so put it back.
  beforeEach(() => setViewport(1440, 900))
  afterEach(() => setViewport(initial.width, initial.height))

  it(
    'is an always-open column with a plain heading, AFTER the pool',
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
      // The facet rows sit inline in the sub-header — no Filters disclosure.
      expect(screen.queryByRole('button', { name: /^filters/i })).toBeNull()
      expect(screen.getByRole('group', { name: /filter by tech level/i })).toBeTruthy()
      const region = rail()
      expect(region.querySelector('[aria-expanded]')).toBeNull()
      expect(within(region).getByRole('heading', { name: /equipped/i })).toBeTruthy()
      expect(within(region).getByRole('button', { name: `Remove ${eq.name}` })).toBeTruthy()
      expect(within(region).getByRole('img', { name: 'Inventory slots 2 of 5' })).toBeTruthy()
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
      setViewport(1024, 900)
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
