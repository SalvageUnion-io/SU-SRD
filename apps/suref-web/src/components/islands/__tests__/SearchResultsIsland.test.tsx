import { describe, test, expect, afterEach, spyOn } from 'bun:test'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { search } from 'salvageunion-reference'
import { SearchResultsIsland } from '../SearchResultsIsland'

describe('SearchResultsIsland', () => {
  // happy-dom only reflects location changes from an href assignment (not from a
  // relative replaceState), so arrange/reset the URL via href.
  afterEach(() => {
    cleanup()
    window.location.href = 'http://localhost/'
  })

  test('reads ?q= from the URL and renders the FULL (uncapped) result set', () => {
    // A broad term that matches well over the combobox's ~10-row cap.
    const term = 'gun'
    const expected = search({ query: term })
    // Guard: only meaningful if this term actually exceeds the dropdown cap.
    expect(expected.length).toBeGreaterThan(10)

    window.location.href = `http://localhost/search?q=${term}`
    const { container } = render(<SearchResultsIsland />)

    const links = container.querySelectorAll('ul li a')
    expect(links.length).toBe(expected.length)
  })

  test('shows a no-results message for a nonsense query', () => {
    window.location.href = 'http://localhost/search?q=zzzzxxxxnonsense99999'
    render(<SearchResultsIsland />)
    expect(screen.getByText(/No results found/)).toBeTruthy()
  })

  test('editing the input writes the term to the ?q= URL param (replaceState)', () => {
    window.location.href = 'http://localhost/search?q=chassis'
    const replaceSpy = spyOn(window.history, 'replaceState')

    try {
      render(<SearchResultsIsland />)

      const input = screen.getByRole('searchbox', { name: 'Search the SRD' })
      expect((input as HTMLInputElement).value).toBe('chassis')

      fireEvent.change(input, { target: { value: 'module' } })

      const urls = replaceSpy.mock.calls.map((c) => String(c[2]))
      expect(urls.some((u) => u.includes('q=module'))).toBe(true)
    } finally {
      replaceSpy.mockRestore()
    }
  })
})
