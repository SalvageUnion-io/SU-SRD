/**
 * Tests for SrdExplorer — the reference inside Play. It renders the SRD home
 * page's Contents without the site header, so the assertions are against
 * `buildChapters()` (the shared source) rather than a hand-listed set of
 * rows, which would drift from it. Reference content needs the ORM, so
 * preload('all') runs once.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { buildChapters } from '../../../lib/chapters'
import { SrdExplorer } from '../SrdExplorer'

// Unmounting between tests is handled globally: the workspace's bunfig preloads
// `test/testing-library.ts`, whose act()-wrapped `afterEach(cleanup)` keeps
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
  return render(<SrdExplorer />)
}

/** Every Contents row: the links inside the chapters. */
function rows(container: HTMLElement): HTMLAnchorElement[] {
  return [...container.querySelectorAll<HTMLAnchorElement>('a.su-contents__row')]
}

/** A Contents row's label, without its count. */
const rowLabel = (row: HTMLAnchorElement) => row.querySelector('span')?.textContent?.trim()

/** Find a Contents row by its label. */
function row(container: HTMLElement, name: string): HTMLAnchorElement {
  const found = rows(container).find((r) => rowLabel(r) === name)
  if (!found) throw new Error(`no Contents row "${name}"`)
  return found
}

/** The category view is the shared EntitySearcher; its pool Minis carry this. */
function poolCards(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.su-searcher__list [data-searcher-open]')]
}

/** The ◀ Back button of the entity view. */
function back(container: HTMLElement): HTMLButtonElement {
  return mustButton(
    [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('◀'))
  )
}

/** The category's chip on the head's band, whose × returns to the Contents. */
function close(container: HTMLElement): HTMLButtonElement {
  return mustButton(container.querySelector(`button[aria-label="Close ${LISTING}"]`))
}

const chapters = () => buildChapters()

/**
 * The listing the drill-in tests open: Crawlers, 5 entries. What these tests
 * pin is the explorer's wiring (tile → searcher → card → back), which a short
 * pool exercises as fully as a long one; the searcher renders every pool Mini,
 * so a long listing would cost render time for no extra coverage.
 */
const LISTING = 'Crawlers'

describe('SrdExplorer', () => {
  test('renders a search box + every Contents chapter and row', () => {
    const { container } = renderSrd()
    expect(container.querySelector('input[role="combobox"]')).toBeTruthy()

    const expected = chapters()
    const headings = [...container.querySelectorAll('section h2 > span:first-child')].map((h) =>
      h.textContent?.trim()
    )
    expect(headings).toEqual(expected.map((c) => c.title))

    expect(rows(container).map(rowLabel)).toEqual(
      expected.flatMap((c) => c.rows.map((r) => r.label))
    )
    // Each row is still a real link to its listing page.
    expect(row(container, 'Classes').getAttribute('href')).toBe('/classes/')
  })

  test('picking a row lists that category in the shared searcher, in place', () => {
    const { container } = renderSrd()
    fireEvent.click(row(container, LISTING))
    expect(container.querySelector('.su-searcher')).toBeTruthy()
    expect(container.textContent).toContain(LISTING)
    expect(poolCards(container).length).toBeGreaterThan(0)
    // A browser, not a picker: no selection rail.
    expect(container.querySelector('.su-searcher__rail')).toBeNull()
  })

  test('picking a Mini drills into a reference card, back returns to the list', () => {
    const { container } = renderSrd()
    fireEvent.click(row(container, LISTING))
    const [first] = poolCards(container)
    if (!first) throw new Error('no pool cards')
    const name = first.querySelector('.su-entity-mini__name')?.textContent
    if (!name) throw new Error('pool Mini has no name')
    fireEvent.click(first)
    // The reference card renders; no longer a listing.
    expect(container.querySelector('.su-searcher')).toBeNull()
    expect(container.textContent).toContain(name)
    // Back returns to the listing.
    fireEvent.click(back(container))
    expect(container.querySelector('.su-searcher')).toBeTruthy()
    expect(poolCards(container).length).toBeGreaterThan(0)
  })

  test('a category is a chip on the one head, its search on the band, not a second titled box', () => {
    const { container } = renderSrd()
    fireEvent.click(row(container, LISTING))
    // One cut-out head: the dialog's, with the category beside its title.
    expect(container.querySelectorAll('.su-modal-panel')).toHaveLength(1)
    expect(close(container).textContent).toContain(LISTING)
    // Its search and filters sit on that head's band; its list under it.
    const band = container.querySelector('.su-modal-panel .su-entity-compact__head')
    expect(band?.querySelector('.su-searcher__toolbar input')).toBeTruthy()
    expect(band?.querySelector('.su-searcher__list')).toBeNull()
    expect(container.querySelector('.su-modal-panel .su-searcher__list')).toBeTruthy()
  })

  test('the category chip returns to the Contents', () => {
    const { container } = renderSrd()
    fireEvent.click(row(container, LISTING))
    expect(container.querySelector('.su-searcher')).toBeTruthy()
    fireEvent.click(close(container))
    expect(container.querySelector(`button[aria-label="Close ${LISTING}"]`)).toBeNull()
    // Back at the Contents.
    expect(rows(container).length).toBe(chapters().reduce((n, c) => n + c.rows.length, 0))
  })

  test('search surfaces results and picking an entity drills in', async () => {
    const { container } = renderSrd()
    const input = mustInput(container.querySelector('input[role="combobox"]'))
    // A broad query that matches entities.
    fireEvent.change(input, { target: { value: 'iron' } })
    // A result is a category button or an entity Compact (link mode, an option).
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
