/**
 * Tests for SrdExplorer — the Dashboard's SRD Explorer focus. It renders
 * the srd landing page's catalog without the site header, so the assertions are
 * against `buildCatalogSections()` (the shared source) rather than a hand-listed
 * set of tiles: that is the whole point of the change, and hard-coding the
 * tiles here would reintroduce the drift it removed. Reference content needs
 * the ORM, so preload('all') runs once.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { buildCatalogSections, EntityHrefProvider } from '../../../../ui/index'
import { SrdExplorer } from '../SrdExplorer'

// Unmounting between tests is handled globally: src/ui's bunfig preloads
// ../../test/testing-library.ts, whose act()-wrapped `afterEach(cleanup)` keeps
// the body-scoped role queries below from seeing a prior test's leftover DOM.

/** Narrow a found element to a real `<button>`, failing loudly otherwise. */
function mustButton(el: Element | null | undefined): HTMLButtonElement {
  if (!(el instanceof HTMLButtonElement)) throw new Error('expected a <button> element')
  return el
}

/** Narrow a found element to a real `<input>`, failing loudly otherwise. */
function mustInput(el: Element | null): HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) throw new Error('expected an <input> element')
  return el
}

function renderSrd() {
  return render(
    <EntityHrefProvider value={() => undefined}>
      <SrdExplorer />
    </EntityHrefProvider>
  )
}

/** Every catalog tile: the buttons inside the category sections. */
function tiles(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll('section button')].map(mustButton)
}

/** Find a catalog tile by its visible name. */
function tile(container: HTMLElement, name: string): HTMLButtonElement {
  return mustButton(tiles(container).find((b) => b.textContent?.trim() === name))
}

/** The category view is the shared EntitySearcher; its pool cards carry this. */
function poolCards(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.su-searcher__pool [role="button"]')]
}

/** The ◀ Back button of the entity view. */
function back(container: HTMLElement): HTMLButtonElement {
  return mustButton(
    [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('◀'))
  )
}

/** The category view's close badge, which returns to the catalog. */
function close(container: HTMLElement): HTMLButtonElement {
  return mustButton(container.querySelector('button[aria-label="Close"]'))
}

const sections = () => buildCatalogSections()

/**
 * The listing the drill-in tests open: Crawlers, 5 entries. What these tests
 * pin is the explorer's wiring (tile → searcher → card → back), which a short
 * pool exercises as fully as a long one; the searcher renders every pool card,
 * so opening Chassis (51 full cards) cost 1.6 s to 2.9 s a test inside cantina's
 * 4-worker suite for no extra coverage.
 */
const LISTING = 'Crawlers'

describe('SrdExplorer', () => {
  test('renders a search box + every catalog section and tile', () => {
    const { container } = renderSrd()
    expect(container.querySelector('input[role="combobox"]')).toBeTruthy()

    const expected = sections()
    const headings = [...container.querySelectorAll('section h2')].map((h) => h.textContent?.trim())
    expect(headings).toEqual(expected.map((s) => s.label))

    expect(tiles(container).map((b) => b.textContent?.trim())).toEqual(
      expected.flatMap((s) => s.schemas.map((c) => c.label))
    )
  })

  test('the catalog covers schemas the old hand-listed tiles missed', () => {
    const { container } = renderSrd()
    // Classes / Crawlers / Traits are in the SRD catalog but had no tile here.
    expect(tile(container, 'Classes')).toBeTruthy()
    expect(tile(container, 'Crawlers')).toBeTruthy()
    expect(tile(container, 'Traits')).toBeTruthy()
  })

  test('picking a schema tile lists that category in the shared searcher', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, LISTING))
    expect(container.querySelector('.su-searcher')).toBeTruthy()
    expect(container.textContent).toContain(LISTING)
    expect(poolCards(container).length).toBeGreaterThan(0)
    // A browser, not a picker: no selection rail.
    expect(container.querySelector('.su-searcher__rail')).toBeNull()
  })

  test('picking a card drills into a reference card, back returns to the list', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, LISTING))
    const [first] = poolCards(container)
    if (!first) throw new Error('no pool cards')
    const name = first.getAttribute('aria-label')
    if (!name) throw new Error('pool card has no accessible name')
    fireEvent.click(first)
    // The reference card renders; no longer a listing.
    expect(container.querySelector('.su-searcher')).toBeNull()
    expect(container.textContent).toContain(name)
    // Back returns to the listing.
    fireEvent.click(back(container))
    expect(container.querySelector('.su-searcher')).toBeTruthy()
    expect(poolCards(container).length).toBeGreaterThan(0)
  })

  test('a flat (guide) tile opens that entity outright', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, 'Heat'))
    // Guides are single entities, so there is no intermediate listing.
    expect(container.querySelector('.su-searcher')).toBeNull()
    expect(tiles(container)).toHaveLength(0)
    expect(back(container)).toBeTruthy()
  })

  test('the category close badge returns to the catalog', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, LISTING))
    expect(container.querySelector('.su-searcher')).toBeTruthy()
    fireEvent.click(close(container))
    // Back at the catalog.
    expect(tiles(container).length).toBe(sections().reduce((n, s) => n + s.schemas.length, 0))
  })

  test('search surfaces results and picking an entity drills in', async () => {
    const { container } = renderSrd()
    const input = mustInput(container.querySelector('input[role="combobox"]'))
    // A broad query that matches entities.
    fireEvent.change(input, { target: { value: 'iron' } })
    // A result is a category button or an entity Row (link mode, an option).
    const result = await waitFor(() => {
      const el = container.querySelector<HTMLElement>('[role="listbox"] [role="option"]')
      if (!el) throw new Error('no results yet')
      return el
    })
    fireEvent.click(result)
    // Either a category (schema hit) or an entity card — a schema hit lists,
    // an entity hit drills in. Both are valid; at minimum we left the home view.
    expect(container.querySelector('input[role="combobox"]')).toBeNull()
  })
})
