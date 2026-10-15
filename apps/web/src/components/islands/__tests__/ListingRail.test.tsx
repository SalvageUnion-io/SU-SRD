/**
 * The listing toolbar's one count rule: the name filter and every facet show
 * only when a listing has more than `TOOLBAR_MIN_ENTRIES` entries, and then
 * all of them do (bio-titans, 11 with two sources, and classes, 11 with one,
 * both show none).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ListingRail, TOOLBAR_MIN_ENTRIES } from '../ListingRail'

const facets = (count: number) => ({
  count,
  techLevels: [1, 2],
  sources: ['Salvage Union Workshop Manual', 'Salvage Union Starter Set'],
  trees: [],
  views: ['catalog'] as const,
})

describe('ListingRail toolbar', () => {
  test('at or under the cut-off: no name filter and no facets', () => {
    render(<ListingRail facets={facets(TOOLBAR_MIN_ENTRIES)} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Source' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Filters/ })).toBeNull()
  })

  test('over the cut-off: the name filter and every facet it has', () => {
    render(<ListingRail facets={facets(TOOLBAR_MIN_ENTRIES + 1)} />)
    expect(screen.getByRole('searchbox', { name: 'Filter items by name' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Source', hidden: true })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Tech Level', hidden: true })).toBeTruthy()
  })
})
