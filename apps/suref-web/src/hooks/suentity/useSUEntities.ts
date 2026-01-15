/**
 * TanStack Query hooks for entity management
 *
 * Provides hooks for fetching and mutating entities with:
 * - Automatic caching
 * - Optimistic updates for better UX
 * - Cache invalidation on mutations
 * - Loading and error states
 * - Support for both API-backed and cache-only (local) data
 *
 * Use LOCAL_ID as the parent ID to work with cache-only data that doesn't
 * persist to the database.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TablesInsert, TablesUpdate } from '../../types/database-generated.types'
import { logger } from '../../lib/logger'
import {
  fetchEntitiesForParent,
  createNormalizedEntity,
  updateNormalizedEntity,
  deleteNormalizedEntity,
} from '../../lib/api/normalizedEntities'
import { LOCAL_ID, isLocalId, generateLocalId, addToCache } from '../../lib/cacheHelpers'
import type { HydratedEntity } from '../../types/hydrated'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

export { LOCAL_ID }

/**
 * Query key factory for entities
 * Ensures consistent cache keys across the app
 */
export const entitiesKeys = {
  all: ['entities'] as const,
  forParent: (parentType: 'pilot' | 'mech' | 'crawler', parentId: string) =>
    [...entitiesKeys.all, parentType, parentId] as const,
}

/**
 * Hook to fetch entities for a parent (pilot, mech, or crawler)
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Pass a database ID, fetches from Supabase
 * - Cache-only: Pass LOCAL_ID, returns cached data only (no API call)
 *
 * @param parentType - Type of parent entity
 * @param parentId - ID of parent entity, or LOCAL_ID for cache-only
 * @returns Query result with hydrated entities
 *
 * @example
 * ```tsx
 * // API-backed entities
 * const { data: entities } = useEntitiesFor('pilot', pilotId)
 *
 * // Cache-only entities (no API calls, cleared on refresh)
 * const { data: localEntities } = useEntitiesFor('pilot', LOCAL_ID)
 * ```
 */
export function useEntitiesFor(
  parentType: 'pilot' | 'mech' | 'crawler',
  parentId: string | undefined
) {
  const isLocal = isLocalId(parentId)

  return useQuery({
    queryKey: entitiesKeys.forParent(parentType, parentId!),
    queryFn: isLocal
      ? async () => [] as HydratedEntity[]
      : () => fetchEntitiesForParent(parentType, parentId!),
    enabled: !!parentId,

    initialData: isLocal ? [] : undefined,
  })
}

/**
 * Hook to create a new entity
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Creates in Supabase, returns database row
 * - Cache-only: Adds to cache only, generates local ID
 *
 * Automatically invalidates the parent's entity cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const createEntity = useCreateEntity()
 *
 * // API-backed entity
 * await createEntity.mutate({
 *   pilot_id: 'uuid-from-db',
 *   schema_name: 'abilities',
 *   schema_ref_id: 'bionic-senses',
 * })
 *
 * // Cache-only entity
 * await createEntity.mutate({
 *   pilot_id: LOCAL_ID,
 *   schema_name: 'abilities',
 *   schema_ref_id: 'bionic-senses',
 * })
 * ```
 */
export function useCreateEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: TablesInsert<'suentities'>) => {
      const parentType = data.pilot_id ? 'pilot' : data.mech_id ? 'mech' : 'crawler'
      const parentId = data.pilot_id || data.mech_id || data.crawler_id

      if (!parentId) {
        throw new Error('Parent ID is required')
      }

      if (isLocalId(parentId)) {
        const ref = SalvageUnionReference.get(
          data.schema_name as SURefEnumSchemaName,
          data.schema_ref_id
        )

        if (!ref) {
          throw new Error(`Reference not found: ${data.schema_name}/${data.schema_ref_id}`)
        }

        const localEntity: HydratedEntity = {
          id: generateLocalId(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          pilot_id: data.pilot_id || null,
          mech_id: data.mech_id || null,
          crawler_id: data.crawler_id || null,
          parent_entity_id: null,
          schema_name: data.schema_name,
          schema_ref_id: data.schema_ref_id,
          metadata: data.metadata || null,
          ref,
          choices: [],
        }

        const queryKey = [...entitiesKeys.forParent(parentType, parentId)]
        addToCache(queryClient, queryKey, localEntity)

        return localEntity
      }

      return createNormalizedEntity(data)
    },

    onMutate: async (data) => {
      const parentType = data.pilot_id ? 'pilot' : data.mech_id ? 'mech' : 'crawler'
      const parentId = data.pilot_id || data.mech_id || data.crawler_id

      if (!parentId || isLocalId(parentId)) return

      await queryClient.cancelQueries({ queryKey: entitiesKeys.forParent(parentType, parentId) })

      const previousEntities = queryClient.getQueryData(
        entitiesKeys.forParent(parentType, parentId)
      )

      const ref = SalvageUnionReference.get(
        data.schema_name as SURefEnumSchemaName,
        data.schema_ref_id
      )

      if (!ref) {
        throw new Error(`Reference not found: ${data.schema_name}/${data.schema_ref_id}`)
      }

      const optimisticEntity: HydratedEntity = {
        id: generateLocalId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pilot_id: data.pilot_id || null,
        mech_id: data.mech_id || null,
        crawler_id: data.crawler_id || null,
        parent_entity_id: null,
        schema_name: data.schema_name,
        schema_ref_id: data.schema_ref_id,
        metadata: data.metadata || null,
        ref,
        choices: [],
      }

      const queryKey = [...entitiesKeys.forParent(parentType, parentId)]
      addToCache(queryClient, queryKey, optimisticEntity)

      return { previousEntities, parentType, parentId }
    },

    onError: (_err, _data, context) => {
      if (context) {
        queryClient.setQueryData(
          entitiesKeys.forParent(
            context.parentType as 'pilot' | 'mech' | 'crawler',
            context.parentId
          ),
          context.previousEntities
        )
      }
    },

    onSuccess: async (newEntity) => {
      logger.log('New entity created:', newEntity)
      const parentType = newEntity.pilot_id ? 'pilot' : newEntity.mech_id ? 'mech' : 'crawler'
      const parentId = newEntity.pilot_id || newEntity.mech_id || newEntity.crawler_id

      if (!parentId) return

      const ref = newEntity.ref
      if (ref && 'grants' in ref && Array.isArray(ref.grants) && ref.grants.length > 0) {
        for (const grant of ref.grants) {
          if (grant && typeof grant === 'object' && 'name' in grant && 'schema' in grant) {
            const grantSchema = grant.schema as SURefEnumSchemaName
            const grantName = grant.name as string

            const grantedItem = SalvageUnionReference.findIn(
              grantSchema,
              (item) => item.name === grantName
            )

            if (grantedItem) {
              const grantedEntityData: TablesInsert<'suentities'> = {
                pilot_id: newEntity.pilot_id,
                mech_id: newEntity.mech_id,
                crawler_id: newEntity.crawler_id,
                parent_entity_id: newEntity.id,
                schema_name: grantSchema,
                schema_ref_id: grantedItem.id,
                metadata: null,
              }

              try {
                if (isLocalId(parentId)) {
                  const localGrantedEntity: HydratedEntity = {
                    id: generateLocalId(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    pilot_id: grantedEntityData.pilot_id || null,
                    mech_id: grantedEntityData.mech_id || null,
                    crawler_id: grantedEntityData.crawler_id || null,
                    parent_entity_id: grantedEntityData.parent_entity_id || null,
                    schema_name: grantedEntityData.schema_name,
                    schema_ref_id: grantedEntityData.schema_ref_id,
                    metadata: grantedEntityData.metadata || null,
                    ref: grantedItem,
                    choices: [],
                    parentEntity: newEntity,
                  }

                  const queryKey = [...entitiesKeys.forParent(parentType, parentId)]
                  addToCache(queryClient, queryKey, localGrantedEntity)
                } else {
                  await createNormalizedEntity(grantedEntityData)
                  logger.log('Granted entity created:', grantName, 'for parent:', newEntity.id)
                }
              } catch (error) {
                logger.error(`Failed to create granted entity ${grantName}:`, error)
              }
            } else {
              logger.warn(`Granted item not found: ${grantName} in schema ${grantSchema}`)
            }
          }
        }
      }

      if (isLocalId(parentId)) return

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.forParent(parentType, parentId),
      })
    },
  })
}

/**
 * Hook to update an entity's metadata
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Updates in Supabase
 * - Cache-only: Updates cache only
 *
 * Automatically invalidates the parent's entity cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const updateEntity = useUpdateEntity()
 *
 * await updateEntity.mutate({
 *   id: entityId,
 *   updates: { metadata: { customName: 'My Custom Name' } },
 * })
 * ```
 */
export function useUpdateEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'suentities'> }) => {
      if (isLocalId(id)) {
        const allQueries = queryClient.getQueriesData<HydratedEntity[]>({
          queryKey: entitiesKeys.all,
        })

        for (const [queryKey, entities] of allQueries) {
          if (!entities) continue

          const entity = entities.find((e) => e.id === id)
          if (entity) {
            const updatedEntities = entities.map((e) =>
              e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
            )
            queryClient.setQueryData(queryKey, updatedEntities)

            return { ...entity, ...updates, updated_at: new Date().toISOString() }
          }
        }

        throw new Error(`Entity not found in cache: ${id}`)
      }

      return updateNormalizedEntity(id, updates)
    },

    onMutate: async ({ id, updates }) => {
      if (isLocalId(id)) return

      const allQueries = queryClient.getQueriesData<HydratedEntity[]>({
        queryKey: entitiesKeys.all,
      })

      let parentType: 'pilot' | 'mech' | 'crawler' | undefined
      let parentId: string | undefined
      let queryKey: unknown[] | undefined

      for (const [key, entities] of allQueries) {
        if (!entities) continue

        const entity = entities.find((e) => e.id === id)
        if (entity) {
          parentType = entity.pilot_id ? 'pilot' : entity.mech_id ? 'mech' : 'crawler'
          parentId = entity.pilot_id || entity.mech_id || entity.crawler_id || undefined
          queryKey = key as unknown[]
          break
        }
      }

      if (!parentType || !parentId || !queryKey) return

      await queryClient.cancelQueries({ queryKey: entitiesKeys.forParent(parentType, parentId) })

      const previousEntities = queryClient.getQueryData<HydratedEntity[]>(queryKey)

      if (previousEntities) {
        const updatedEntities = previousEntities.map((e) =>
          e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
        )
        queryClient.setQueryData(queryKey, updatedEntities)
      }

      return { previousEntities, queryKey, parentType, parentId }
    },

    onError: (_err, _variables, context) => {
      if (context?.previousEntities && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousEntities)
      }
    },

    onSuccess: (updatedEntity) => {
      const parentType = updatedEntity.pilot_id
        ? 'pilot'
        : updatedEntity.mech_id
          ? 'mech'
          : 'crawler'
      const parentId = updatedEntity.pilot_id || updatedEntity.mech_id || updatedEntity.crawler_id

      if (!parentId) return

      if (isLocalId(parentId)) return

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.forParent(parentType, parentId),
      })
    },
  })
}

/**
 * Hook to delete an entity
 *
 * Automatically invalidates the parent's entity cache on success.
 * Cascade delete will automatically remove associated player_choices.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteEntity = useDeleteEntity()
 *
 * await deleteEntity.mutate({
 *   id: entityId,
 *   parentType: 'pilot',
 *   parentId: pilotId,
 * })
 * ```
 */
export function useDeleteEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      parentType,
      parentId,
    }: {
      id: string
      parentType: string
      parentId: string
    }) => {
      if (isLocalId(parentId)) {
        const queryKey = entitiesKeys.forParent(
          parentType as 'pilot' | 'mech' | 'crawler',
          parentId
        )
        const currentEntities = queryClient.getQueryData<HydratedEntity[]>(queryKey)

        if (currentEntities) {
          const collectEntityIdsToDelete = (
            entityId: string,
            entities: HydratedEntity[]
          ): string[] => {
            const idsToDelete = [entityId]

            const children = entities.filter((e) => e.parent_entity_id === entityId)
            for (const child of children) {
              idsToDelete.push(...collectEntityIdsToDelete(child.id, entities))
            }
            return idsToDelete
          }

          const idsToDelete = collectEntityIdsToDelete(id, currentEntities)
          const updatedEntities = currentEntities.filter(
            (entity) => !idsToDelete.includes(entity.id)
          )
          queryClient.setQueryData(queryKey, updatedEntities)
        }

        return
      }

      await deleteNormalizedEntity(id)
    },
    onSuccess: (_, variables) => {
      if (isLocalId(variables.parentId)) return

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.forParent(
          variables.parentType as 'pilot' | 'mech' | 'crawler',
          variables.parentId
        ),
      })
    },
  })
}
