/**
 * The listing while its schema loads (`ListingSkeleton`): the server render's
 * layout — the rail, then the Catalog's one run of tile placeholders, or the
 * Tree's groups under their headings — so neither the mount nor the gate opening
 * moves the grid. The gate is held shut by a pending preload.
 */

import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ListingShape } from '../../../lib/listingGroups'
import { resetPreloadForTests } from '../../../lib/useGameData'
import { SchemaViewerIsland } from '../SchemaViewerIsland'

const SHAPE: ListingShape = {
  count: 5,
  groups: [
    { key: '1', label: 'Tech Level 1', count: 3 },
    { key: '2', label: 'Tech Level 2', count: 2 },
  ],
}

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
  const el = container.querySelector<HTMLElement>('.srd-listing')
  if (!el) throw new Error('no listing skeleton')
  return el
}

describe('SchemaViewerIsland skeleton', () => {
  it('sets the rail and one flat run of tile placeholders, hidden from AT', () => {
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
    expect(listing.getAttribute('data-view')).toBe('catalog')
    const rail = listing.querySelector('.srd-rail')
    expect(rail).not.toBeNull()
    // No view toggle; the Tech Level toggle in the book's order whatever
    // order it was handed.
    const toggles = [...(rail?.querySelectorAll('button[aria-pressed]') ?? [])].map(
      (b) => b.textContent
    )
    expect(toggles).toEqual(['All', '1', '2'])

    // The Catalog has no group headings: one run of the shape's count.
    const groups = [...listing.querySelectorAll('.srd-listing__group')]
    expect(groups.map((g) => g.textContent)).toEqual([''])
    expect(
      listing.querySelectorAll('.srd-listing__tiles > li.srd-listing__tile-skeleton').length
    ).toBe(5)
    expect(listing.querySelector('.srd-listing__cards')).toBeNull()
    expect(preloadSpy).toHaveBeenCalledWith(['chassis'], { projection: 'list' })
  })

  it('without a shape it is a flat run of twelve tile placeholders and no rail', () => {
    const { container } = render(
      <SchemaViewerIsland schemaId="systems" techLevels={[]} sources={[]} />
    )
    const listing = skeleton(container)
    expect(listing.querySelector('.srd-rail')).toBeNull()
    // No art: the wider art-less columns.
    expect(listing.hasAttribute('data-catalog')).toBe(true)
    expect(listing.querySelectorAll('.srd-listing__group').length).toBe(1)
    expect(listing.querySelectorAll('.srd-listing__tiles > li').length).toBe(12)
  })

  it('the abilities’ Tree sets each tree under its heading, a card placeholder per ability', () => {
    const tree: ListingShape = {
      count: 5,
      groups: [
        { key: 'Forging', label: 'Forging Tree', count: 3 },
        { key: 'Hacking', label: 'Hacking Tree', count: 2 },
      ],
    }
    const { container } = render(
      <SchemaViewerIsland
        schemaId="abilities"
        techLevels={[]}
        sources={[]}
        trees={['Forging', 'Hacking']}
        shape={tree}
      />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('data-view')).toBe('tree')
    const groups = [...listing.querySelectorAll('.srd-listing__group')]
    expect(groups.map((g) => g.textContent)).toEqual(['Forging Tree', 'Hacking Tree'])
    expect(groups.map((g) => g.querySelectorAll('.srd-listing__cards > li').length)).toEqual([3, 2])
  })

  it('a ?view=catalog link on the abilities shapes the skeleton as one run of tiles', () => {
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
    const tiles = [...listing.querySelectorAll('.srd-listing__tiles')]
    expect(tiles.map((ul) => ul.children.length)).toEqual([5])
  })
})
