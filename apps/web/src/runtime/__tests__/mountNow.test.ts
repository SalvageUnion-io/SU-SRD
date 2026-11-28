/**
 * A listing waits for its reader unless this visit should not show the
 * server's unfiltered default: a link that names a filter or a view, or a
 * view the reader chose before.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { SHOW_HOMEBREW_KEY } from '../../lib/homebrew/endpoint'
import { listingViewStorageKey } from '../../lib/listingParams'
import { mountsNow } from '../mountNow'

afterEach(() => {
  window.location.href = 'http://localhost/'
  window.localStorage.clear()
})

describe('mountsNow', () => {
  test('a listing on a plain visit waits', () => {
    window.location.href = 'http://localhost/abilities/'
    expect(mountsNow('SchemaViewerIsland', { schemaId: 'abilities' })).toBe(false)
  })

  test.each([
    'tl=1',
    'source=Core',
    'tree=Hacker',
    'q=mule',
    'view=catalog',
    'trait=Hot',
    'sort=-sp',
    'cols=range,damage',
  ])('a listing on a link with %s mounts now', (query) => {
    window.location.href = `http://localhost/abilities/?${query}`
    expect(mountsNow('SchemaViewerIsland', { schemaId: 'abilities' })).toBe(true)
  })

  test('a query the listing does not read changes nothing', () => {
    window.location.href = 'http://localhost/chassis/?utm_source=discord'
    expect(mountsNow('SchemaViewerIsland', { schemaId: 'chassis' })).toBe(false)
  })

  test('a view the reader chose before mounts now, on that listing only', () => {
    window.localStorage.setItem(listingViewStorageKey('abilities'), 'catalog')
    expect(mountsNow('SchemaViewerIsland', { schemaId: 'abilities' })).toBe(true)
    expect(mountsNow('SchemaViewerIsland', { schemaId: 'chassis' })).toBe(false)
    expect(mountsNow('SchemaViewerIsland', {})).toBe(false)
  })

  test('storage that throws reads as no choice', () => {
    const privateWindow = {
      location: window.location,
      get localStorage(): Storage {
        throw new Error('denied')
      },
    } as unknown as Window
    expect(mountsNow('SchemaViewerIsland', { schemaId: 'abilities' }, privateWindow)).toBe(false)
  })

  test("the bar's search on the Reference page mounts now for a query, to open on it", () => {
    window.location.href = 'http://localhost/reference/?q=mule'
    expect(mountsNow('SearchIsland', {})).toBe(true)
    // The results page's bar keeps its query (RR6-02).
    window.location.href = 'http://localhost/search/?q=mule'
    expect(mountsNow('SearchIsland', {})).toBe(true)
    window.location.href = 'http://localhost/chassis/?q=mule'
    expect(mountsNow('SearchIsland', {})).toBe(false)
    expect(mountsNow('SearchIsland', { variant: 'hero' })).toBe(true)
  })

  test('a chassis’s Homebrew waits for its switch, unless the reader left it on', () => {
    expect(mountsNow('HomebrewIsland', { chassisRef: 'mule' })).toBe(false)
    window.localStorage.setItem(SHOW_HOMEBREW_KEY, 'on')
    expect(mountsNow('HomebrewIsland', { chassisRef: 'mule' })).toBe(true)
  })

  test('any other island waits', () => {
    window.location.href = 'http://localhost/?tl=1'
    expect(mountsNow('SearchIsland', {})).toBe(false)
  })
})
