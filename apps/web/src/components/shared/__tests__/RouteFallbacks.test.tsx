/**
 * The app's unmatched route draws the site's own 404 (`NotFound`): the
 * heading, the search, the guesses and the chapters the static `/404` shows,
 * plus the way back to the Hangar. Rendered with no router, so `AppLink` is a
 * plain anchor.
 */
import type { Mock } from 'bun:test'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, render, screen, within } from '@testing-library/react'
import { buildSearchIndexEntries } from '../../../lib/searchIndexBuild'
import { resetSearchIndexForTests } from '../../../lib/useSearchIndex'
import { RouteNotFound, RoutePending } from '../RouteFallbacks'

// The real build-time index behind a mocked `fetch`, as the search islands' own tests serve it.
const index = buildSearchIndexEntries()

async function renderAt(path: string) {
  window.location.href = `http://localhost${path}`
  await act(async () => {
    render(<RouteNotFound />)
  })
}

describe('RouteNotFound', () => {
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
    window.location.href = 'http://localhost/'
  })

  test("is the site's 404 in a main landmark: heading, search and chapters", async () => {
    await renderAt('/')
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy()
    expect(within(main).getByRole('combobox', { name: 'Search the Reference' })).toBeTruthy()
    const chapters = within(main).getByRole('navigation', { name: 'Or open a chapter' })
    const links = within(chapters).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/#pilot-bay',
      '/#mech-workshop',
      '/#union-crawler',
      '/#denizens',
      '/#rules-reference',
    ])
  })

  test('guesses from the missed path, linking the reference page', async () => {
    await renderAt('/build/gophr')
    expect(await screen.findByRole('heading', { name: 'Did you mean' })).toBeTruthy()
    const guess = screen.getByRole('link', { name: /Gopher/ })
    expect(guess.getAttribute('href')).toBe('/chassis/gopher/')
  })

  test('leads back to the Hangar', async () => {
    await renderAt('/')
    const back = screen.getByRole('link', { name: /Back to Hangar/ })
    expect(back.getAttribute('href')).toBe('/')
  })
})

describe('RoutePending', () => {
  test('is a busy main landmark that says it is loading', () => {
    render(<RoutePending />)
    const main = screen.getByRole('main')
    expect(main.getAttribute('aria-busy')).toBe('true')
    expect(within(main).getByText('Loading the page…')).toBeTruthy()
  })
})
