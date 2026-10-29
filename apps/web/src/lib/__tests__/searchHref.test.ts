import { describe, expect, test } from 'bun:test'
import { searchHref, searchQuery } from '../searchHref'

describe('searchHref', () => {
  test('opens the home page search on the words', () => {
    expect(searchHref('portable cryopod')).toBe('/?q=portable+cryopod')
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
