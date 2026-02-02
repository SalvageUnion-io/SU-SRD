import { describe, test, expect } from 'bun:test'
import { LOCAL_ID, generateLocalId } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import CrawlerLiveSheet from '../index'

describe('CrawlerLiveSheet - Initialization', () => {
  describe('Common Cases', () => {
    test('renders crawler live sheet with LOCAL_ID', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Should show crawler info section
          const crawlerElements = screen.queryAllByText(/crawler|name|scrap/i)
          expect(crawlerElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('displays default crawler data (empty crawler, no type selected)', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Should show crawler type selector or name input
          const crawlerElements = screen.getAllByText(/crawler|type|name/i)
          expect(crawlerElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('renders main sections (header inputs, resource steppers)', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Resource steppers - Scrap
          const scrapElements = screen.getAllByText(/scrap/i)
          expect(scrapElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Corner Cases', () => {
    test('handles cache misses gracefully (new local crawler)', async () => {
      const newId = generateLocalId()

      render(<CrawlerLiveSheet id={newId} />)

      await waitFor(
        () => {
          // Should still render the component even without pre-populated cache
          const elements = screen.queryAllByText(/crawler|name|scrap/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('handles rapid mount/unmount cycles', async () => {
      const { unmount: firstUnmount } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          const elements = screen.queryAllByText(/crawler|name/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )

      firstUnmount()

      const { unmount: secondUnmount } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)
      await waitFor(
        () => {
          const elements = screen.queryAllByText(/crawler|name/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
      secondUnmount()

      // Should not throw errors
      expect(true).toBe(true)
    })
  })
})
