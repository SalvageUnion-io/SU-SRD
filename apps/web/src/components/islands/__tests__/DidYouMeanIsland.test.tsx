import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { buildSearchIndexEntries } from '../../../lib/searchIndexBuild'
import { resetSearchIndexForTests } from '../../../lib/useSearchIndex'
import { DidYouMeanIsland, guessesFor, queryFromPathname } from '../DidYouMeanIsland'

// The real build-time index, served through a mocked `fetch` as SearchIsland's
// tests do, so the guesses are the SRD search's own.
const index = buildSearchIndexEntries()

describe('queryFromPathname', () => {
  test('reads the last slug back as words', () => {
    expect(queryFromPathname('/chassis/mule-mk2/')).toBe('mule mk2')
  })

  test('skips the site’s own path words', () => {
    expect(queryFromPathname('/chassis/')).toBe('chassis')
    expect(queryFromPathname('/404/')).toBe('')
    expect(queryFromPathname('/')).toBe('')
  })

  test('decodes the path and drops an .html suffix', () => {
    expect(queryFromPathname('/bio%20titan.html')).toBe('bio titan')
  })

  test('keeps a segment with a malformed escape as it came, rather than throwing', () => {
    expect(queryFromPathname('/chassis/mule%E0%A4%A/')).toBe('mule%E0%A4%A')
  })
})

describe('guessesFor', () => {
  test('finds an entry from a misspelt slug', () => {
    const names = guessesFor(index, 'gophr').map((result) => result.entityName)
    expect(names).toContain('Gopher')
  })

  test('falls back to a single word when the whole slug matches nothing', () => {
    const names = guessesFor(index, 'gopher zzzqxv').map((result) => result.entityName)
    expect(names).toContain('Gopher')
  })

  test('caps the guesses at five', () => {
    expect(guessesFor(index, 'a').length).toBeLessThanOrEqual(5)
  })
})

describe('DidYouMeanIsland', () => {
  let fetchSpy: Mock<typeof fetch> | undefined

  beforeEach(() => {
    resetSearchIndexForTests()
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
    fetchSpy?.mockRestore()
    resetSearchIndexForTests()
  })

  test('offers the closest entries and a search for the slug', async () => {
    render(<DidYouMeanIsland pathname="/chassis/gophr/" />)
    expect(await screen.findByRole('heading', { name: 'Did you mean' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Search the Reference for “gophr”/ })).toBeTruthy()
    expect(screen.getAllByRole('link').some((link) => link.textContent?.includes('Gopher'))).toBe(
      true
    )
  })

  test('says so when nothing is close', async () => {
    render(<DidYouMeanIsland pathname="/zzzqxv/" />)
    expect(await screen.findByRole('heading', { name: 'Nothing close to “zzzqxv”' })).toBeTruthy()
  })

  test('renders nothing and fetches nothing when the path holds no term', () => {
    const { container } = render(<DidYouMeanIsland pathname="/" />)
    expect(container.innerHTML).toBe('')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('without a pathname prop it reads the missed URL from the location', async () => {
    window.location.href = 'http://localhost/chassis/gophr/'
    try {
      render(<DidYouMeanIsland />)
      expect(await screen.findByRole('heading', { name: 'Did you mean' })).toBeTruthy()
      expect(screen.getByRole('link', { name: /Search the Reference for “gophr”/ })).toBeTruthy()
    } finally {
      window.location.href = 'http://localhost/'
    }
  })

  test('an index entry without a Compact model is offered as a plain link to its page', async () => {
    const slim = index.map(({ model: _model, ...entry }) => entry)
    fetchSpy?.mockImplementation(
      Object.assign(
        async () =>
          new Response(JSON.stringify(slim), { headers: { 'Content-Type': 'application/json' } }),
        { preconnect: fetch.preconnect }
      )
    )
    const { container } = render(<DidYouMeanIsland pathname="/chassis/gophr/" />)
    const link = await screen.findByRole('link', { name: 'Gopher' })
    expect(link.getAttribute('href')).toBe('/chassis/gopher/')
    expect(link.className).toBe('su-not-found__link')
    expect(container.querySelector('.su-entity-compact')).toBeNull()
  })
})
