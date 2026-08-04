/**
 * Tests for SrdExplorer — the Dashboard's SRD Explorer focus (D4). It renders
 * the srd landing page's catalog without the site header, so the assertions are
 * against `buildCatalogSections()` (the shared source) rather than a hand-listed
 * set of tiles: that is the whole point of the change, and hard-coding the
 * tiles here would reintroduce the drift it removed. Reference content needs
 * the ORM, so preload('all') runs once.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { EntityHrefProvider } from '../../referenceEntity/entityHrefContext'
import { SalvageUnionReference } from 'salvageunion-reference'

import { buildCatalogSections } from '../../../catalog/catalogSections'
import { SrdExplorer } from '../SrdExplorer'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

// Unmounting between tests is handled globally: component-lib's bunfig preloads
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

/** Find a catalog tile by its visible name. */
function tile(container: HTMLElement, name: string): HTMLButtonElement {
  return mustButton(
    [...container.querySelectorAll('.pc-srd-catalog-grid button')].find(
      (b) => b.textContent?.trim() === name
    )
  )
}

const sections = () => buildCatalogSections()

describe('SrdExplorer', () => {
  test('renders a search box + every catalog section and tile', () => {
    const { container } = renderSrd()
    expect(container.querySelector('input[role="combobox"]')).toBeTruthy()

    const expected = sections()
    const headings = [...container.querySelectorAll('.pc-srd-catalog h2')].map((h) =>
      h.textContent?.trim()
    )
    expect(headings).toEqual(expected.map((s) => s.label))

    const tiles = [...container.querySelectorAll('.pc-srd-catalog-grid button')].map((b) =>
      b.textContent?.trim()
    )
    expect(tiles).toEqual(expected.flatMap((s) => s.schemas.map((c) => c.label)))
  })

  test('the catalog covers schemas the old hand-listed tiles missed', () => {
    const { container } = renderSrd()
    // Classes / Crawlers / Traits are in the SRD catalog but had no tile here.
    expect(tile(container, 'Classes')).toBeTruthy()
    expect(tile(container, 'Crawlers')).toBeTruthy()
    expect(tile(container, 'Traits')).toBeTruthy()
  })

  test('picking a schema tile lists that category with rows', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, 'Chassis'))
    expect(container.querySelector('.pc-srd-crumb-title')?.textContent).toContain('Chassis')
    expect(container.querySelectorAll('.pc-srd-row').length).toBeGreaterThan(0)
  })

  test('picking a row drills into a reference card, back returns to the list', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, 'Chassis'))
    fireEvent.click(mustButton(container.querySelector('.pc-srd-row')))
    // The reference card renders; no longer a listing.
    expect(container.querySelector('.pc-srd-entity')).toBeTruthy()
    expect(container.querySelector('.pc-srd-rows')).toBeNull()
    // Back returns to the Chassis listing.
    const back = mustButton(
      [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('◀'))
    )
    fireEvent.click(back)
    expect(container.querySelector('.pc-srd-crumb-title')?.textContent).toContain('Chassis')
    expect(container.querySelectorAll('.pc-srd-row').length).toBeGreaterThan(0)
  })

  test('a flat (guide) tile opens that entity outright', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, 'Heat'))
    // Guides are single entities, so there is no intermediate listing.
    expect(container.querySelector('.pc-srd-entity')).toBeTruthy()
    expect(container.querySelector('.pc-srd-rows')).toBeNull()
  })

  test('category back affordance returns to the catalog', () => {
    const { container } = renderSrd()
    fireEvent.click(tile(container, 'Systems'))
    expect(container.querySelector('.pc-srd-rows')).toBeTruthy()
    fireEvent.click(
      mustButton(
        [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('◀'))
      )
    )
    // Back at the catalog.
    expect(container.querySelectorAll('.pc-srd-catalog-grid button').length).toBe(
      sections().reduce((n, s) => n + s.schemas.length, 0)
    )
  })

  test('search surfaces results and picking an entity drills in', async () => {
    const { container } = renderSrd()
    const input = mustInput(container.querySelector('input[role="combobox"]'))
    // A broad query that matches entities.
    fireEvent.change(input, { target: { value: 'iron' } })
    const result = await waitFor(() => {
      const el = container.querySelector('.pc-srd-result')
      if (!el) throw new Error('no results yet')
      return mustButton(el)
    })
    fireEvent.click(result)
    // Either a category (schema hit) or an entity card — a schema hit lists,
    // an entity hit drills in. Both are valid; at minimum we left the home view.
    const drilled =
      container.querySelector('.pc-srd-entity') ?? container.querySelector('.pc-srd-list')
    expect(drilled).toBeTruthy()
  })
})
