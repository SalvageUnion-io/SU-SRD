import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SalvageUnionReference } from 'salvageunion-reference'
import { isLocalId, generateLocalId } from '../../lib/cacheHelpers'
import { entitiesKeys } from '../suentity/useSUEntities'
import type { HydratedEntity } from '../../types/hydrated'

/**
 * Initialize crawler bays for local (playground) crawlers
 *
 * This hook ensures that when a crawler is accessed in playground mode (LOCAL_ID),
 * the bay entities are created in the cache. This is necessary because playground
 * crawlers are never "created" via useCreateCrawler, so the bays need to be
 * initialized separately.
 *
 * For API-backed crawlers, this hook does nothing - bays are created during
 * crawler creation via useCreateCrawler.
 *
 * @param crawlerId - The crawler ID
 * @param baysExist - Whether bays already exist (from useHydratedCrawler)
 */
export function useInitializeCrawlerBays(crawlerId: string, baysExist: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isLocalId(crawlerId) || baysExist) {
      return
    }

    const allBays = SalvageUnionReference.CrawlerBays.all()
    const bayEntities: HydratedEntity[] = allBays.map((bay) => {
      const now = new Date().toISOString()
      return {
        id: generateLocalId(),
        created_at: now,
        updated_at: now,
        pilot_id: null,
        mech_id: null,
        crawler_id: crawlerId,
        parent_entity_id: null,
        schema_name: 'crawler-bays',
        schema_ref_id: bay.id,
        metadata: {
          damaged: false,
          npc: {
            name: '',
            notes: '',
            hitPoints: bay.npc.hitPoints,
            damage: 0,
          },
        },
        ref: bay,
        choices: [],
      }
    })

    queryClient.setQueryData(entitiesKeys.forParent('crawler', crawlerId), bayEntities)
  }, [crawlerId, baysExist, queryClient])
}
