/**
 * The listing toolbar's one count rule: the name filter and every facet show
 * only when a listing has more than `TOOLBAR_MIN_ENTRIES` entries, and then
 * all of them do (bio-titans, 11 with two sources, and classes, 11 with one,
 * both show none).
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
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

  test('a name filtered counts on Filters, which the name filter folds behind on a phone (r8 G4)', () => {
    render(
      <ListingRail
        facets={facets(TOOLBAR_MIN_ENTRIES + 1)}
        filters={{ techLevels: new Set(), source: '', tree: '', name: 'laser' }}
      />
    )
    expect(screen.getByRole('button', { name: /Filters/ }).textContent).toContain('1')
  })

  test('the Tech Level strip wraps: a phone’s Filters panel is never wider than the page', () => {
    render(<ListingRail facets={facets(TOOLBAR_MIN_ENTRIES + 1)} />)
    const strip = screen.getByRole('group', { name: 'Tech Level', hidden: true })
    expect(strip.hasAttribute('data-wrap')).toBe(true)
  })

  test('the placeholder counts what the other filters leave, not the whole listing (RR6-17)', () => {
    render(<ListingRail facets={{ ...facets(51), shown: 12 }} />)
    expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe('Filter 12 by name')
  })

  test('Enter in the name filter takes focus to the results (RR6-14)', () => {
    let reached = 0
    const actions = {
      setName: () => {},
      toggleTechLevel: () => {},
      clearTechLevels: () => {},
      setSource: () => {},
      setTree: () => {},
      setTrait: () => {},
      setRange: () => {},
      setAction: () => {},
      setWeapons: () => {},
      setView: () => {},
      toggleFacets: () => {},
      focusResults: () => reached++,
    }
    render(<ListingRail facets={facets(TOOLBAR_MIN_ENTRIES + 1)} actions={actions} />)
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })
    expect(reached).toBe(1)
  })
})
