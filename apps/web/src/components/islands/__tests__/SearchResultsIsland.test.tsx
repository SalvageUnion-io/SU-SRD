import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { searchCompactIndex } from '../../../lib/searchCompactIndex'
import { buildSearchIndexEntries } from '../../../lib/searchIndexBuild'
import { resetSearchIndexForTests } from '../../../lib/useSearchIndex'
import { groupResults, SearchResultsIsland } from '../SearchResultsIsland'

// The real build-time index, served as `/search-index.json` would be.
const index = buildSearchIndexEntries()

/** Render on an address's search string, the index fetch settled. */
async function renderOn(search: string) {
  await act(async () => {
    render(<SearchResultsIsland search={search} />)
  })
}

describe('SearchResultsIsland (r5 E3)', () => {
  let fetchSpy: Mock<typeof fetch> | undefined

  beforeEach(() => {
    resetSearchIndexForTests()
    const mockFetch: typeof fetch = Object.assign(
      async () =>
        new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }),
      { preconnect: fetch.preconnect }
    )
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(mockFetch)
  })

  afterEach(() => {
    cleanup()
    fetchSpy?.mockRestore()
    resetSearchIndexForTests()
  })

  test('lists every result for the query, each kind a section with its count', async () => {
    await renderOn('?q=shield')
    const all = searchCompactIndex(index, { query: 'shield', limit: 200 })
    expect(all.length).toBeGreaterThan(10)
    // The count said is the rows listed.
    expect(screen.getByText(`${all.length} results for “shield”`)).toBeTruthy()
    const links = screen.getAllByRole('link').filter((a) => a.closest('table'))
    expect(links).toHaveLength(all.length)
    const kinds = groupResults(all).map((group) => group.kind)
    expect(kinds.length).toBeGreaterThan(1)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '')
    for (const kind of kinds) expect(headings.some((h) => h.includes(kind))).toBe(true)
  })

  test("a row says what the dropdown says: a term's definition, a weapon's reach (r7 E2)", async () => {
    await renderOn('?q=hot')
    const hot = screen.getAllByRole('link', { name: /^Hot$/ })[0]
    expect(hot?.closest('tr')?.textContent).toContain('Heat equal to')
    cleanup()
    await renderOn('?q=long%20range')
    expect(
      screen.getAllByRole('link', { name: /^Long$/ })[0]?.closest('tr')?.textContent
    ).toContain('outline')
  })

  test('a result followed marks its page to open at its content (r8 G3)', async () => {
    await renderOn('?q=hot')
    const hot = screen.getAllByRole('link', { name: /^Hot$/ })[0] as HTMLAnchorElement
    hot.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(hot)
    expect(sessionStorage.getItem('su-at-content')).toBe(hot.getAttribute('href'))
    sessionStorage.clear()
  })

  test('keeps the query in a field on the page, to refine it (RR6-02)', async () => {
    await renderOn('?q=railgun%20damage')
    const field = screen.getByRole('searchbox', {
      name: 'Search the Reference',
    }) as HTMLInputElement
    expect(field.value).toBe('railgun damage')
    expect(field.closest('form')?.getAttribute('action')).toBe('/search/')
  })

  test('groups kinds in the order their best match ranks, a pattern under Patterns', () => {
    const groups = groupResults(searchCompactIndex(index, { query: 'ironmonger', limit: 200 }))
    expect(groups[0]?.kind).toBe('Patterns')
    const shield = searchCompactIndex(index, { query: 'shield', limit: 200 })
    expect(groupResults(shield)[0]?.results[0]).toBe(shield[0])
  })

  test('a query that finds nothing says so and offers the listings and rules', async () => {
    await renderOn('?q=zzqxjv')
    expect(screen.getByText(/Nothing close to “zzqxjv”/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'the listings' }).getAttribute('href')).toBe(
      '/reference/'
    )
  })

  test('with no query it asks for one, and loads no index', async () => {
    await renderOn('')
    expect(screen.getByText(/Type a word in the search above/)).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
