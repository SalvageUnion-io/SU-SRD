import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { searchCompactIndex } from '../../../lib/searchCompactIndex'
import { buildSearchIndexEntries } from '../../../lib/searchIndexBuild'
import { resetSearchIndexForTests } from '../../../lib/useSearchIndex'
import { SearchResultsIsland } from '../SearchResultsIsland'

// SearchResultsIsland now fetches the build-time compact index
// (`/search-index.json`) instead of preloading the ORM — mock `fetch` to
// serve the real index (built from the already-preloaded test data, see
// test/preload-reference.ts) so these stay real integration tests against
// real search behavior.
const index = buildSearchIndexEntries()

describe('SearchResultsIsland', () => {
  let fetchSpy: Mock<typeof fetch> | undefined

  beforeEach(() => {
    resetSearchIndexForTests()
    // `Object.assign` carries the real `fetch.preconnect` so the mock satisfies
    // Bun's `typeof fetch` structurally — no forced cast.
    const mockFetch: typeof fetch = Object.assign(
      async () =>
        new Response(JSON.stringify(index), {
          headers: { 'Content-Type': 'application/json' },
        }),
      { preconnect: fetch.preconnect }
    )
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(mockFetch)
  })

  // happy-dom only reflects location changes from an href assignment (not from a
  // relative replaceState), so arrange/reset the URL via href.
  afterEach(() => {
    cleanup()
    fetchSpy?.mockRestore()
    resetSearchIndexForTests()
    window.location.href = 'http://localhost/'
  })

  test('reads ?q= from the URL and renders the FULL (uncapped) result set', async () => {
    // A broad term that matches well over the combobox's ~10-row cap.
    const term = 'gun'
    const expected = searchCompactIndex(index, { query: term })
    // Guard: only meaningful if this term actually exceeds the dropdown cap.
    expect(expected.length).toBeGreaterThan(10)

    window.location.href = `http://localhost/search?q=${term}`
    const { container } = render(<SearchResultsIsland />)

    await waitFor(() => {
      expect(container.querySelectorAll('ul li a').length).toBe(expected.length)
    })
  })

  test('shows a no-results message for a nonsense query', async () => {
    window.location.href = 'http://localhost/search?q=zzzzxxxxnonsense99999'
    render(<SearchResultsIsland />)
    expect(await screen.findByText(/No results found/)).toBeTruthy()
  })

  test('editing the input writes the term to the ?q= URL param (replaceState)', async () => {
    window.location.href = 'http://localhost/search?q=chassis'
    const replaceSpy = spyOn(window.history, 'replaceState')

    try {
      render(<SearchResultsIsland />)

      const input = await screen.findByRole('searchbox', { name: 'Search the SRD' })
      if (!(input instanceof HTMLInputElement)) throw new Error('expected an <input> searchbox')
      expect(input.value).toBe('chassis')

      fireEvent.change(input, { target: { value: 'module' } })

      await waitFor(() => {
        const urls = replaceSpy.mock.calls.map((c) => String(c[2]))
        expect(urls.some((u) => u.includes('q=module'))).toBe(true)
      })
    } finally {
      replaceSpy.mockRestore()
    }
  })
})
