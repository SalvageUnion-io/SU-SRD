/**
 * TanStack Query hooks for crawler management
 *
 * Provides hooks for fetching and mutating crawlers with:
 * - Automatic caching
 * - Optimistic updates for better UX
 * - Cache invalidation on mutations
 * - Loading and error states
 * - Support for both API-backed and cache-only (local) data
 *
 * Use LOCAL_ID as the crawler ID to work with cache-only data that doesn't
 * persist to the database.
 */

import { createEntityHooks } from '../createEntityHooks'
import { LOCAL_ID, isLocalId, generateLocalId } from '../../lib/cacheHelpers'
import type { Tables } from '../../types/database-generated.types'
import { SalvageUnionReference } from 'salvageunion-reference'
import { createNormalizedEntity } from '../../lib/api/normalizedEntities'
import { entitiesKeys } from '../suentity/useSUEntities'
import type { HydratedEntity } from '../../types/hydrated'
import type { QueryClient } from '@tanstack/react-query'

type Crawler = Tables<'crawlers'>

/**
 * Create bay entities for a crawler
 * Creates one entity for each crawler bay type from salvageunion-reference
 *
 * @param crawlerId - ID of the crawler
 * @param queryClient - TanStack Query client for cache updates
 */
async function createCrawlerBays(crawlerId: string, queryClient: QueryClient): Promise<void> {
  const allBays = SalvageUnionReference.CrawlerBays.all()
  const isLocal = isLocalId(crawlerId)

  if (isLocal) {
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
            name: '', // Name is now stored in player_choices, but kept here for type compatibility
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
  } else {
    await Promise.all(
      allBays.map((bay) =>
        createNormalizedEntity({
          crawler_id: crawlerId,
          schema_name: 'crawler-bays',
          schema_ref_id: bay.id,
          metadata: {
            damaged: false,
            npc: {
              name: '', // Name is now stored in player_choices, but kept here for type compatibility
              notes: '',
              hitPoints: bay.npc.hitPoints,
              damage: 0,
            },
          },
        })
      )
    )
  }
}

const defaultCrawler: Crawler = {
  id: LOCAL_ID,
  name: 'New Crawler',
  current_damage: 0,
  tech_level: 1,
  upgrade: 0,
  active: false,
  private: true,
  user_id: 'local',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  description: null,
  game_id: null,
  notes: null,
  npc: null,
  scrap_tl_one: 0,
  scrap_tl_two: 0,
  scrap_tl_three: 0,
  scrap_tl_four: 0,
  scrap_tl_five: 0,
  scrap_tl_six: 0,
}

const {
  keys: crawlersKeys,
  useEntity,
  useCreateEntity,
  useUpdateEntity,
  useDeleteEntity,
} = createEntityHooks<Crawler>({
  tableName: 'crawlers',
  defaultEntity: defaultCrawler,
  onCreateSuccess: async (newCrawler, queryClient) => {
    await createCrawlerBays(newCrawler.id, queryClient)
  },
})

/**
 * Query key factory for crawlers
 * Ensures consistent cache keys across the app
 */
export { crawlersKeys }

/**
 * Hook to fetch a single crawler by ID
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Pass a database ID, fetches from Supabase
 * - Cache-only: Pass LOCAL_ID, returns cached data only (no API call)
 *
 * @param id - Crawler ID, or LOCAL_ID for cache-only
 * @returns Query result with crawler data
 *
 * @example
 * ```tsx
 * // API-backed crawler
 * const { data: crawler } = useCrawler('uuid-from-database')
 *
 * // Cache-only crawler (no API calls, cleared on refresh)
 * const { data: localCrawler } = useCrawler(LOCAL_ID)
 * ```
 */
export const useCrawler = useEntity

/**
 * Hook to create a new crawler
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Creates in Supabase, returns database row
 * - Cache-only: Adds to cache only, uses LOCAL_ID
 *
 * Automatically creates crawler bays and invalidates the crawler cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const createCrawler = useCreateCrawler()
 *
 * // API-backed crawler
 * await createCrawler.mutate({
 *   name: 'The Wanderer',
 * })
 *
 * // Cache-only crawler
 * await createCrawler.mutate({
 *   id: LOCAL_ID,
 *   name: 'The Wanderer',
 * })
 * ```
 */
export const useCreateCrawler = useCreateEntity

/**
 * Hook to update a crawler
 *
 * Supports both API-backed and cache-only (local) data.
 * Automatically invalidates the crawler cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const updateCrawler = useUpdateCrawler()
 *
 * await updateCrawler.mutate({
 *   id: crawlerId,
 *   updates: { current_sp: 10 },
 * })
 * ```
 */
export const useUpdateCrawler = useUpdateEntity

/**
 * Hook to delete a crawler
 *
 * Automatically invalidates the crawler cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteCrawler = useDeleteCrawler()
 *
 * await deleteCrawler.mutate(crawlerId)
 * ```
 */
export const useDeleteCrawler = useDeleteEntity
