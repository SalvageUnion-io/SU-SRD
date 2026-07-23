import { describe, test, expect, afterEach, beforeEach, mock, spyOn, type Mock } from 'bun:test'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { SearchIsland } from '../SearchIsland'
import { buildSearchIndexEntries } from '../../../lib/searchIndexBuild'
import { resetSearchIndexForTests } from '../../../lib/useSearchIndex'

// SearchIsland now fetches the build-time compact index (`/search-index.json`)
// instead of preloading the ORM — mock `fetch` to serve the real index (built
// from the already-preloaded test data, see test/preload-reference.ts) so
// these stay real integration tests against real search behavior.
const index = buildSearchIndexEntries()

describe('SearchIsland', () => {
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

  afterEach(() => {
    cleanup()
    fetchSpy?.mockRestore()
    resetSearchIndexForTests()
  })

  test('renders an sr-only aria-live region', () => {
    const { container } = render(<SearchIsland />)
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
    expect(liveRegion?.className).toContain('sr-only')
  })

  test('aria-live region announces result count after search', async () => {
    const { container } = render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'chassis' } })
      // Wait for debounce (150ms) + the mocked fetch's microtask
      await new Promise((r) => setTimeout(r, 200))
    })

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
    const text = liveRegion?.textContent ?? ''
    // Should announce either result count or "No results found"
    expect(text.includes('found')).toBe(true)
  })

  test('aria-live region announces "No results found" for nonsense query', async () => {
    const { container } = render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzxxxxxnonsense99999' } })
      await new Promise((r) => setTimeout(r, 200))
    })

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('No results found')
  })

  test('dropdown shows "No results found" message for zero matches', async () => {
    render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'zzzzxxxxxnonsense99999' } })
      await new Promise((r) => setTimeout(r, 200))
    })

    // Both the aria-live region and the dropdown show "No results found"
    const matches = screen.getAllByText('No results found')
    expect(matches.length).toBe(2)
    // The dropdown message is inside the listbox
    const listbox = screen.getByRole('listbox')
    expect(listbox.textContent).toContain('No results found')
  })

  test('Enter with no arrow selection navigates to the full results page', async () => {
    const navigate = mock(() => {})
    render(<SearchIsland navigate={navigate} />)
    const input = screen.getByRole('combobox')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'chassis' } })
      await new Promise((r) => setTimeout(r, 200))
    })

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    // With no highlighted row, Enter opens the uncapped /search page for the term
    // rather than jumping to the first dropdown hit.
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/search?q=chassis')
  })

  test('Enter with arrow selection navigates to the selected result', async () => {
    const navigate = mock(() => {})
    render(<SearchIsland navigate={navigate} />)
    const input = screen.getByRole('combobox')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'chassis' } })
      await new Promise((r) => setTimeout(r, 200))
    })

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)

    // Arrow down TWICE (selectedIndex: -1 → 0 → 1) then Enter — each in its own
    // act so React flushes the state update before the next event fires.
    // Two presses distinguishes "navigates to selection" from the Enter-with-no-selection
    // fallback that also resolves to options[0].
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(navigate).toHaveBeenCalledTimes(1)
    const second = options[1]
    if (!(second instanceof HTMLAnchorElement)) throw new Error('expected the second option link')
    const secondHref = second.getAttribute('href')
    expect(navigate).toHaveBeenCalledWith(secondHref)
  })

  test('deferred loading: search works after focusing the input and typing', async () => {
    // SearchIsland defers the index fetch to first intent (focus/typing).
    // Behavioral check: focus then type — results must still appear.
    render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    await act(async () => {
      fireEvent.focus(input)
    })
    await act(async () => {
      fireEvent.change(input, { target: { value: 'chassis' } })
      await new Promise((r) => setTimeout(r, 200))
    })

    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
  })

  test('typing before data is ready shows the loading row, then real hits once ready', async () => {
    // Force the deferred pre-ready state: the fetch never resolves until we
    // resolve it by hand. This exercises the stale-debounce re-run in
    // SearchIsland's useEffect([ready]) that the other deferred test (which
    // mounts with data already loaded) never reaches.
    resetSearchIndexForTests()
    let resolveFetch!: (res: Response) => void
    fetchSpy?.mockRestore()
    const pendingFetch: typeof fetch = Object.assign(
      () => new Promise<Response>((res) => (resolveFetch = res)),
      { preconnect: fetch.preconnect }
    )
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(pendingFetch)

    try {
      render(<SearchIsland />)
      const input = screen.getByRole('combobox')

      // Type while the fetch is still pending — the debounce fires against the
      // pre-ready closure, so the dropdown shows the loading row and no options.
      await act(async () => {
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'chassis' } })
        await new Promise((r) => setTimeout(r, 200))
      })
      expect(screen.getByRole('listbox').textContent).toContain('Loading search index')
      expect(screen.queryAllByRole('option').length).toBe(0)

      // Data lands → the [ready] effect re-runs the pending query with real data.
      await act(async () => {
        resolveFetch(
          new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } })
        )
        await new Promise((r) => setTimeout(r, 0))
      })
      expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    } finally {
      resetSearchIndexForTests()
    }
  })

  test('category rows are capped so entity hits are never crowded out', async () => {
    render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    // 'c' prefix-matches many category names
    await act(async () => {
      fireEvent.change(input, { target: { value: 'c' } })
      await new Promise((r) => setTimeout(r, 200))
    })

    const options = screen.getAllByRole('option')
    expect(options.length).toBeLessThanOrEqual(10)

    // Count category rows (schema: 'Category')
    const categoryRows = options.filter((opt) => opt.textContent?.includes('Category'))
    expect(categoryRows.length).toBeLessThanOrEqual(3)
  })
})
