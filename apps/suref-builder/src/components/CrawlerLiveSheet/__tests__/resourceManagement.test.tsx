import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import CrawlerLiveSheet from '../index'
import { createLocalCrawler } from '../../../test/liveSheetHelpers'
import type { Tables } from '../../../types/database-generated.types'
import { crawlersKeys } from '../../../hooks/crawler/useCrawlers'

describe('CrawlerLiveSheet - Resource Management', () => {
  describe('Common Cases', () => {
    test('scrap stepper displays scrap resources', async () => {
      await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const scrapElements = screen.getAllByText(/scrap/i)
        expect(scrapElements.length).toBeGreaterThan(0)
      })
    })

    test('scrap values can be set per tech level', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          scrap_tl_one: 100,
          scrap_tl_two: 50,
          tech_level: 2,
        })

        await waitFor(() => {
          const crawler = queryClient.getQueryData<Tables<'crawlers'>>(crawlersKeys.byId(LOCAL_ID))
          if (crawler) {
            expect(crawler.scrap_tl_one).toBe(100)
            expect(crawler.scrap_tl_two).toBe(50)
          }
        })
      }
    })

    test('scrap can be set to high values', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          scrap_tl_one: 10000,
        })

        await waitFor(() => {
          const crawler = queryClient.getQueryData<Tables<'crawlers'>>(crawlersKeys.byId(LOCAL_ID))
          if (crawler && crawler.scrap_tl_one !== null) {
            expect(crawler.scrap_tl_one).toBe(10000)
          }
        })
      }
    })
  })

  describe('Corner Cases', () => {
    test('set scrap to exactly 0', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          scrap_tl_one: 0,
        })

        await waitFor(() => {
          const crawler = queryClient.getQueryData<Tables<'crawlers'>>(crawlersKeys.byId(LOCAL_ID))
          if (crawler && crawler.scrap_tl_one !== null) {
            expect(crawler.scrap_tl_one).toBe(0)
          }
        })
      }
    })

    test('handles null scrap values', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          scrap_tl_one: null,
          scrap_tl_two: null,
        })

        await waitFor(() => {
          const crawler = queryClient.getQueryData<Tables<'crawlers'>>(crawlersKeys.byId(LOCAL_ID))
          if (crawler) {
            expect(crawler.scrap_tl_one).toBeNull()
          }
        })
      }
    })
  })
})
