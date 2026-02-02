import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import CrawlerLiveSheet from '../index'

describe('CrawlerLiveSheet - Integration', () => {
  describe('Common Cases', () => {
    test('renders crawler components', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Check that main sections exist
          const crawlerElements = screen.queryAllByText(/crawler|scrap|bay/i)
          expect(crawlerElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('control bar not shown for local crawlers', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Control bar should not be present for local crawlers
          const controlBar = screen.queryByRole('button', { name: /active|private/i })
          expect(controlBar).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    test('displays crawler with bays section', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Should show crawler content
          const crawlerElements = screen.queryAllByText(/crawler|name|scrap/i)
          expect(crawlerElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })
  })
})
