/**
 * The listing while its schema loads (`ListingSkeleton`): the server render's
 * layout — the rail, then the groups under their headings, one placeholder
 * per entity in the view's shape — so neither the mount nor the gate opening
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
  it('sets the rail and each group under its heading, a placeholder per entity, hidden from AT', () => {
    const { container } = render(
      <SchemaViewerIsland
        schemaId="chassis"
        techLevels={[2, 1]}
        sources={['Core']}
        shape={SHAPE}
        preloadSchemas={['chassis']}
      />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('aria-hidden')).toBe('true')
    expect(listing.getAttribute('data-view')).toBe('list')
    const rail = listing.querySelector('.srd-rail')
    expect(rail).not.toBeNull()
    // The rail's view toggle, then its Tech Level toggle in the book's order
    // whatever order it was handed.
    const toggles = [...(rail?.querySelectorAll('button[aria-pressed]') ?? [])].map(
      (b) => b.textContent
    )
    expect(toggles).toEqual(['List', 'Catalog', 'All', '1', '2'])

    const groups = [...listing.querySelectorAll('.srd-listing__group')]
    expect(groups.map((g) => g.textContent)).toEqual(['Tech Level 1', 'Tech Level 2'])
    expect(groups.map((g) => g.querySelectorAll('.srd-listing__cards > li').length)).toEqual([3, 2])
    expect(listing.querySelector('.srd-listing__tiles')).toBeNull()
    expect(preloadSpy).toHaveBeenCalledWith(['chassis'], { projection: 'list' })
  })

  it('without a shape it is a flat run of nine card placeholders and no rail', () => {
    const { container } = render(
      <SchemaViewerIsland schemaId="systems" techLevels={[]} sources={[]} />
    )
    const listing = skeleton(container)
    expect(listing.querySelector('.srd-rail')).toBeNull()
    const groups = listing.querySelectorAll('.srd-listing__group')
    expect(groups.length).toBe(1)
    expect(groups[0]?.textContent).toBe('')
    expect(listing.querySelectorAll('.srd-listing__cards > li').length).toBe(9)
  })

  it('a catalog listing without art opens on twelve tile placeholders', () => {
    const { container } = render(
      <SchemaViewerIsland schemaId="crawlers" techLevels={[]} sources={[]} />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('data-view')).toBe('catalog')
    expect(listing.hasAttribute('data-catalog')).toBe(true)
    expect(
      listing.querySelectorAll('.srd-listing__tiles > li.srd-listing__tile-skeleton').length
    ).toBe(12)
    expect(listing.querySelector('.srd-listing__cards')).toBeNull()
  })

  it('a ?view=catalog link shapes the skeleton as tiles before the data arrives', () => {
    window.location.href = 'http://localhost/chassis/?view=catalog'
    const { container } = render(
      <SchemaViewerIsland
        schemaId="chassis"
        techLevels={[1, 2]}
        sources={['Core']}
        shape={SHAPE}
        hasArt
      />
    )
    const listing = skeleton(container)
    expect(listing.getAttribute('data-view')).toBe('catalog')
    const tiles = [...listing.querySelectorAll('.srd-listing__tiles')]
    expect(tiles.map((ul) => ul.children.length)).toEqual([3, 2])
  })
})
