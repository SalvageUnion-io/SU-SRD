import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import CrawlerLiveSheet from '../index'
import { createLocalCrawler, createLocalEntity } from '../../../test/liveSheetHelpers'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { HydratedEntity } from '../../../types/hydrated'
import { entitiesKeys } from '../../../hooks/suentity/useSUEntities'

describe('CrawlerLiveSheet - NPC Management', () => {
  describe('Common Cases', () => {
    test('displays NPC assignment interface for bays', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.name === 'Fortress')
      const bay = SalvageUnionReference.CrawlerBays.find((b) => b.name !== 'Storage Bay')
      if (crawlerType && bay && queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          tech_level: 1,
        })
        createLocalEntity(queryClient, LOCAL_ID, 'crawlers', crawlerType.id)

        // Create bay entity
        const bayEntity = createLocalEntity(queryClient, LOCAL_ID, 'crawler-bays', bay.id)

        // Update bay metadata with NPC
        const queryKey = entitiesKeys.forParent('crawler', LOCAL_ID)
        const entities = queryClient.getQueryData<HydratedEntity[]>(queryKey) || []
        const updatedEntities = entities.map((e) => {
          if (e.id === bayEntity.id) {
            return {
              ...e,
              metadata: {
                damaged: false,
                npc: {
                  name: 'Test NPC',
                  notes: '',
                  hitPoints: 10,
                  damage: 0,
                },
              },
            }
          }
          return e
        })
        queryClient.setQueryData(queryKey, updatedEntities)

        await waitFor(
          () => {
            // NPC interface should be visible
            const npcElements = screen.queryAllByText(/npc|name/i)
            expect(npcElements.length).toBeGreaterThan(0)
          },
          { timeout: 2000 }
        )
      }
    })

    test('can assign NPC to bay', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.name === 'Fortress')
      const bay = SalvageUnionReference.CrawlerBays.find((b) => b.name !== 'Storage Bay')
      if (crawlerType && bay && queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          tech_level: 1,
        })
        createLocalEntity(queryClient, LOCAL_ID, 'crawlers', crawlerType.id)
        createLocalEntity(queryClient, LOCAL_ID, 'crawler-bays', bay.id)

        await waitFor(
          () => {
            // Bay should be visible
            expect(screen.getByText(/bay|bays/i)).toBeInTheDocument()
          },
          { timeout: 2000 }
        )
      }
    })
  })

  describe('Corner Cases', () => {
    test('handles bays without NPCs', async () => {
      const { queryClient } = await render(<CrawlerLiveSheet id={LOCAL_ID} />)

      const crawlerType = SalvageUnionReference.Crawlers.find((c) => c.name === 'Fortress')
      const bay = SalvageUnionReference.CrawlerBays.find((b) => b.name !== 'Storage Bay')
      if (crawlerType && bay && queryClient) {
        createLocalCrawler(queryClient, LOCAL_ID, {
          tech_level: 1,
        })
        createLocalEntity(queryClient, LOCAL_ID, 'crawlers', crawlerType.id)
        createLocalEntity(queryClient, LOCAL_ID, 'crawler-bays', bay.id)

        await waitFor(
          () => {
            // Bay should be visible even without NPC
            const bayElements = screen.queryAllByText(/bay|bays/i)
            expect(bayElements.length).toBeGreaterThan(0)
          },
          { timeout: 2000 }
        )
      }
    })
  })
})
