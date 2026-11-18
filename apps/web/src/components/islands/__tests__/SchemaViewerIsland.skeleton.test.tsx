/**
 * The listing while its schema loads (`ListingSkeleton`): the server render's
 * layout — the rail, then the List's lines in their frame, the Catalog's run
 * of tile placeholders, or a Tree's cards — so neither the mount nor the gate
 * opening moves the listing. The gate is held shut by a pending preload.
 */

import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ListingShape } from '../../../lib/listingGroups'
import { resetPreloadForTests } from '../../../lib/useGameData'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

// Over the toolbar's cut-off (`TOOLBAR_MIN_ENTRIES`), so the rail sets its facets.
const SHAPE: ListingShape = { count: 14, groups: [{ key: 'all', label: undefined, count: 14 }] }

let isLoadedSpy: Mock<typeof SalvageUnionReference.isLoaded> | undefined
let preloadSpy: Mock<typeof SalvageUnionReference.preload> | undefined

beforeEach(() => {
  resetPreloadForTests()
  isLoadedSpy = spyOn(SalvageUnionReference, 'isLoaded').mockReturnValue(false)
  preloadSpy = spyOn(SalvageUnionReference, 'preload').mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  isLoadedSpy?.mockRestore()
  preloadSpy?.mockRestore()
  resetPreloadForTests()
  window.location.href = 'http://localhost/'
})

function skeleton(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.su-listing')
  if (!el) throw new Error('no listing skeleton')
  return el
}

describe('SchemaViewerIsland skeleton', () => {
  it('sets the rail and the List’s lines, one per entity, hidden from AT', () => {
    const { container } = render(
      <SchemaViewerIsland
        schemaId="chassis"
        techLevels={[2, 1]}
        sources={['Core']}
        shape={SHAPE}
        preloadSchemas={['chassis']}
        hasArt
      />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('aria-hidden')).toBe('true')
    expect(listing.getAttribute('data-view')).toBe('list')
    const rail = listing.querySelector('.su-rail')
    expect(rail).not.toBeNull()
    // The view toggle, then the Tech Level toggle in the book's order whatever
    // order it was handed.
    const toggles = [...(rail?.querySelectorAll('button[aria-pressed]') ?? [])].map(
      (b) => b.textContent
    )
    expect(toggles).toEqual(['List', 'Catalog', 'All', '1', '2'])

    // One group with no heading: a line per entity of the shape's count.
    const groups = [...listing.querySelectorAll('.su-listing__group')]
    expect(groups.map((g) => g.textContent)).toEqual([''])
    expect(listing.querySelectorAll('.su-listing__lines > li').length).toBe(14)
    expect(listing.querySelector('.su-listing__tiles')).toBeNull()
    expect(preloadSpy).toHaveBeenCalledWith(['chassis'], { projection: 'list' })
  })

  it('a group with a name (the classes’ Core and Hybrid) keeps its own run of lines', () => {
    const classes: ListingShape = {
      count: 11,
      groups: [
        { key: 'core', label: 'Core Classes', count: 6 },
        { key: 'hybrid', label: 'Hybrid Classes', count: 5 },
      ],
    }
    const { container } = render(
      <SchemaViewerIsland schemaId="classes" techLevels={[]} sources={[]} shape={classes} />
    )
    const lines = [...skeleton(container).querySelectorAll('.su-listing__lines')]
    expect(lines.map((ul) => ul.children.length)).toEqual([6, 5])
  })

  it('without a shape it is a flat run of twelve lines and no rail', () => {
    const { container } = render(
      <SchemaViewerIsland schemaId="systems" techLevels={[]} sources={[]} />
    )
    const listing = skeleton(container)
    expect(listing.querySelector('.su-rail')).toBeNull()
    expect(listing.querySelectorAll('.su-listing__group').length).toBe(1)
    expect(listing.querySelectorAll('.su-listing__lines > li').length).toBe(12)
  })

  it('a ?view=tree link on the abilities sets a card placeholder per ability, in one run', () => {
    window.location.href = 'http://localhost/abilities/?view=tree'
    const { container } = render(
      <SchemaViewerIsland
        schemaId="abilities"
        techLevels={[]}
        sources={[]}
        trees={['Forging', 'Hacking']}
        shape={SHAPE}
      />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('data-view')).toBe('tree')
    // A Tree's groups are not known until its schema loads.
    const cards = [...listing.querySelectorAll('.su-listing__cards')]
    expect(cards.map((ul) => ul.children.length)).toEqual([14])
  })

  it('a ?view=catalog link shapes the skeleton as one run of tiles, wider with no art', () => {
    window.location.href = 'http://localhost/abilities/?view=catalog'
    const { container } = render(
      <SchemaViewerIsland
        schemaId="abilities"
        techLevels={[]}
        sources={[]}
        trees={['Forging', 'Hacking']}
        shape={SHAPE}
      />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('data-view')).toBe('catalog')
    expect(listing.hasAttribute('data-catalog')).toBe(true)
    const tiles = [...listing.querySelectorAll('.su-listing__tiles')]
    expect(tiles.map((ul) => ul.children.length)).toEqual([14])
    expect(listing.querySelectorAll('li.su-listing__tile-skeleton').length).toBe(14)
  })
})
