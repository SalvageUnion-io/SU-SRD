import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import CrawlerLiveSheet from '../index'
import { createLocalCrawler, createLocalEntity } from '../../../test/liveSheetHelpers'
import { SalvageUnionReference } from 'salvageunion-reference'

describe('CrawlerLiveSheet - Bay Management', () => {
  describe('Common Cases', () => {
    test('displays bays when crawler type is selected', async () => {
      const { queryClient } = render(<CrawlerLiveSheet id={LOCAL_ID} />)

      const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.name === 'Fortress')
      if (crawlerType && queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          tech_level: 1,
        })
        // Create crawler type entity
        createLocalEntity(queryClient, LOCAL_ID, 'crawlers', crawlerType.id)

        await waitFor(
          () => {
            // Bays should be visible
            const bayElements = screen.queryAllByText(/bay|bays/i)
            expect(bayElements.length).toBeGreaterThan(0)
          },
          { timeout: 2000 }
        )
      }
    })

    test('displays storage bay separately', async () => {
      const { queryClient } = render(<CrawlerLiveSheet id={LOCAL_ID} />)

      const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.name === 'Fortress')
      if (crawlerType && queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          tech_level: 1,
        })
        createLocalEntity(queryClient, LOCAL_ID, 'crawlers', crawlerType.id)

        // Add a storage bay
        const storageBay = SalvageUnionReference.CrawlerBays.find((b) => b.name === 'Storage Bay')
        if (storageBay) {
          createLocalEntity(queryClient, LOCAL_ID, 'crawler-bays', storageBay.id)

          await waitFor(
            () => {
              // Storage bay should be visible
              const storageElements = screen.queryAllByText(/storage/i)
              expect(storageElements.length).toBeGreaterThan(0)
            },
            { timeout: 2000 }
          )
        }
      }
    })

    test('displays regular bays', async () => {
      const { queryClient } = render(<CrawlerLiveSheet id={LOCAL_ID} />)

      const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.name === 'Fortress')
      if (crawlerType && queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          tech_level: 1,
        })
        createLocalEntity(queryClient, LOCAL_ID, 'crawlers', crawlerType.id)

        // Add a regular bay (not storage)
        const regularBay = SalvageUnionReference.CrawlerBays.find((b) => b.name !== 'Storage Bay')
        if (regularBay) {
          createLocalEntity(queryClient, LOCAL_ID, 'crawler-bays', regularBay.id)

          await waitFor(
            () => {
              // Regular bay should be visible
              const bayElements = screen.queryAllByText(new RegExp(regularBay.name, 'i'))
              expect(bayElements.length).toBeGreaterThan(0)
            },
            { timeout: 2000 }
          )
        }
      }
    })
  })

  describe('Corner Cases', () => {
    test('handles empty bays list', async () => {
      render(<CrawlerLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Should show bay section even if empty
        const crawlerElements = screen.getAllByText(/crawler|bay/i)
        expect(crawlerElements.length).toBeGreaterThan(0)
      })
    })
  })
})
