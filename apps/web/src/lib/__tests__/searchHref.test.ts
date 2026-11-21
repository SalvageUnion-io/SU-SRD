import { describe, expect, test } from 'bun:test'
import { searchHref, searchQuery } from '../searchHref'

describe('searchHref', () => {
  // RR-02: the home page has no search bar, so a query sent there showed nothing.
  test('opens the Reference page’s search on the words', () => {
    expect(searchHref('portable cryopod')).toBe('/reference/?q=portable+cryopod')
  })

  test('reads back what it writes', () => {
    for (const query of ['mule', 'portable cryopod', 'a&b=c', 'Tech 6'])
      expect(searchQuery(new URL(searchHref(query), 'https://salvageunion.io').search)).toBe(query)
  })

  test('reads a blank query as none', () => {
    expect(searchQuery('?q=%20%20')).toBeUndefined()
    expect(searchQuery('')).toBeUndefined()
  })
})
