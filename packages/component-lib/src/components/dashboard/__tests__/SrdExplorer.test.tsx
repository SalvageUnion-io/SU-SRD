/**
 * Tests for SrdExplorer — the Dashboard's SRD Explorer focus (D4). Verifies the
 * search box + 8 category tiles render, that picking a tile lists that
 * category, and that picking a row drills into the reference card with a back
 * affordance. Reference content needs the ORM, so preload('all') runs once.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { EntityHrefProvider } from '../../referenceEntity/entityHrefContext'
import { SalvageUnionReference } from 'salvageunion-reference'

import { SrdExplorer } from '../SrdExplorer'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

// component-lib's test env has no global auto-cleanup, so unmount each render —
// the body-scoped role queries below must not see a prior test's leftover DOM.
afterEach(cleanup)

function renderSrd() {
  return render(
    <EntityHrefProvider value={() => undefined}>
      <SrdExplorer />
    </EntityHrefProvider>
  )
}

const TILE_LABELS = [
  'Chassis',
  'Systems',
  'Modules',
  'Pilot Abilities',
  'Equipment',
  'NPCs',
  'Crawler Bays',
  'Roll Tables',
]

describe('SrdExplorer', () => {
  test('renders a search box + the 8 category tiles', () => {
    const { container } = renderSrd()
    expect(container.querySelector('.pc-srd-input')).toBeTruthy()
    const labels = [...container.querySelectorAll('.pc-srd-tile-label')].map((t) => t.textContent)
    expect(labels).toEqual(TILE_LABELS)
  })

  test('picking a tile lists that category with rows', () => {
    const { container, getAllByRole } = renderSrd()
    const chassisTile = getAllByRole('button').find(
      (b) => b.querySelector('.pc-srd-tile-label')?.textContent === 'Chassis'
    ) as HTMLButtonElement
    fireEvent.click(chassisTile)
    // Now in the category listing.
    expect(container.querySelector('.pc-srd-crumb-title')?.textContent).toContain('Chassis')
    expect(container.querySelectorAll('.pc-srd-row').length).toBeGreaterThan(0)
  })

  test('picking a row drills into a reference card, back returns to the list', () => {
    const { container } = renderSrd()
    const chassisTile = [...container.querySelectorAll('.pc-srd-tile')].find(
      (b) => b.querySelector('.pc-srd-tile-label')?.textContent === 'Chassis'
    ) as HTMLButtonElement
    fireEvent.click(chassisTile)
    const firstRow = container.querySelector('.pc-srd-row') as HTMLButtonElement
    fireEvent.click(firstRow)
    // The reference card renders; no longer a listing.
    expect(container.querySelector('.pc-srd-entity')).toBeTruthy()
    expect(container.querySelector('.pc-srd-rows')).toBeNull()
    // Back returns to the Chassis listing.
    const back = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('◀')
    ) as HTMLButtonElement
    fireEvent.click(back)
    expect(container.querySelector('.pc-srd-crumb-title')?.textContent).toContain('Chassis')
    expect(container.querySelectorAll('.pc-srd-row').length).toBeGreaterThan(0)
  })

  test('category back affordance returns to the tiles home', () => {
    const { container } = renderSrd()
    const tile = container.querySelector('.pc-srd-tile') as HTMLButtonElement
    fireEvent.click(tile)
    expect(container.querySelector('.pc-srd-rows')).toBeTruthy()
    fireEvent.click(
      [...container.querySelectorAll('button')].find((b) =>
        b.textContent?.startsWith('◀')
      ) as HTMLButtonElement
    )
    // Back at the tiles home.
    expect(container.querySelectorAll('.pc-srd-tile').length).toBe(8)
  })

  test('search surfaces results and picking an entity drills in', async () => {
    const { container } = renderSrd()
    const input = container.querySelector('.pc-srd-input') as HTMLInputElement
    // A broad query that matches entities.
    fireEvent.change(input, { target: { value: 'iron' } })
    const result = await waitFor(() => {
      const el = container.querySelector('.pc-srd-result')
      if (!el) throw new Error('no results yet')
      return el as HTMLButtonElement
    })
    fireEvent.click(result)
    // Either a category (schema hit) or an entity card — a schema hit lists,
    // an entity hit drills in. Both are valid; at minimum we left the home view.
    const drilled =
      container.querySelector('.pc-srd-entity') ?? container.querySelector('.pc-srd-list')
    expect(drilled).toBeTruthy()
  })
})
