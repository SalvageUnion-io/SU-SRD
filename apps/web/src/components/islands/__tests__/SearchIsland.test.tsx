import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildSearchIndexEntries } from '../../../lib/searchIndexBuild'
import { resetSearchIndexForTests } from '../../../lib/useSearchIndex'
import { SearchIsland } from '../SearchIsland'

// SearchIsland now fetches the build-time compact index (`/search-index.json`)
// instead of preloading the ORM — mock `fetch` to serve the real index (built
// from the already-preloaded test data, see test/preload-reference.ts) so
// these stay real integration tests against real search behavior.
const index = buildSearchIndexEntries()

/** `useSearchCombobox`'s own `debounceMs` default. */
const DEBOUNCE_MS = 150

/**
 * Type into the combobox and run the debounce out with fake timers.
 *
 * Never sleep past a real debounce: a fixed real-time margin is a latent flake
 * on a loaded CI runner and dead wall-clock everywhere else. The first `act`
 * flushes the deferred index fetch (mocked, so it settles in microtasks); the
 * second drives the debounce timer directly.
 */
async function typeAndSettle(input: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value } })
  })
  await act(async () => {
    jest.advanceTimersByTime(DEBOUNCE_MS)
  })
}

describe('SearchIsland', () => {
  let fetchSpy: Mock<typeof fetch> | undefined

  beforeEach(() => {
    jest.useFakeTimers()
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
    jest.useRealTimers()
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

    await typeAndSettle(input, 'chassis')

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
    const text = liveRegion?.textContent ?? ''
    // Should announce either result count or "No results found"
    expect(text.includes('found')).toBe(true)
  })

  test('aria-live region announces "No results found" for nonsense query', async () => {
    const { container } = render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    await typeAndSettle(input, 'zzzzxxxxxnonsense99999')

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('No results found')
  })

  test('dropdown shows "No results found" message for zero matches', async () => {
    render(<SearchIsland />)
    const input = screen.getByRole('combobox')

    await typeAndSettle(input, 'zzzzxxxxxnonsense99999')

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

    await typeAndSettle(input, 'chassis')

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

    await typeAndSettle(input, 'chassis')

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
    await typeAndSettle(input, 'chassis')

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
      })
      await act(async () => {
        jest.advanceTimersByTime(DEBOUNCE_MS)
      })
      expect(screen.getByRole('listbox').textContent).toContain('Loading search index')
      expect(screen.queryAllByRole('option').length).toBe(0)

      // Data lands → the [ready] effect re-runs the pending query with real data.
      await act(async () => {
        resolveFetch(
          new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } })
        )
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
    await typeAndSettle(input, 'c')

    const options = screen.getAllByRole('option')
    expect(options.length).toBeLessThanOrEqual(10)

    // Count category rows (schema: 'Category')
    const categoryRows = options.filter((opt) => opt.textContent?.includes('Category'))
    expect(categoryRows.length).toBeLessThanOrEqual(3)
  })

  test('Escape closes the dropdown and lets go of focus; focusing again reopens it', async () => {
    render(<SearchIsland navigate={mock(() => {})} />)
    const input = screen.getByRole('combobox')
    await act(async () => {
      input.focus()
    })
    await typeAndSettle(input, 'chassis')
    expect(screen.getByRole('listbox')).toBeTruthy()

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Escape' })
    })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).not.toBe(input)

    await act(async () => {
      fireEvent.focus(input)
    })
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  test('a click outside closes the dropdown; a click inside keeps it open', async () => {
    const { container } = render(
      <div>
        <SearchIsland navigate={mock(() => {})} />
        <p>elsewhere</p>
      </div>
    )
    const input = screen.getByRole('combobox')
    await typeAndSettle(input, 'chassis')

    await act(async () => {
      fireEvent.click(input)
    })
    expect(screen.getByRole('listbox')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByText('elsewhere'))
    })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(container.querySelector('[role="combobox"]')?.getAttribute('aria-expanded')).toBe(
      'false'
    )
  })

  test('Cmd+K and Ctrl+K focus the search from anywhere on the page', async () => {
    render(<SearchIsland />)
    const input = screen.getByRole('combobox')
    expect(document.activeElement).not.toBe(input)

    const meta = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true })
    await act(async () => {
      document.dispatchEvent(meta)
    })
    expect(document.activeElement).toBe(input)
    expect(meta.defaultPrevented).toBe(true)

    await act(async () => {
      input.blur()
    })
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    })
    expect(document.activeElement).toBe(input)

    // A bare "k" is just typing.
    await act(async () => {
      input.blur()
    })
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k' })
    })
    expect(document.activeElement).not.toBe(input)
  })

  test('without a navigate prop, Enter sends the window to the results page', async () => {
    const assign = spyOn(window.location, 'assign').mockImplementation(() => {})
    try {
      render(<SearchIsland />)
      const input = screen.getByRole('combobox')
      await typeAndSettle(input, 'mule pattern')
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' })
      })
      expect(assign).toHaveBeenCalledWith('/search?q=mule%20pattern')
    } finally {
      assign.mockRestore()
    }
  })

  describe('the hero variant', () => {
    test('submitting the form opens the results page for the trimmed term', async () => {
      const navigate = mock(() => {})
      render(<SearchIsland variant="hero" navigate={navigate} />)
      const input = screen.getByRole('combobox')
      expect(input.getAttribute('name')).toBe('q')
      await typeAndSettle(input, '  mule  ')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Search' }))
      })
      expect(navigate).toHaveBeenCalledWith('/search?q=mule')
    })

    test('submitting an empty form goes nowhere and puts focus in the field', async () => {
      const navigate = mock(() => {})
      render(<SearchIsland variant="hero" navigate={navigate} />)
      const input = screen.getByRole('combobox')
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Search' }))
      })
      expect(navigate).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(input)
    })
  })
})
