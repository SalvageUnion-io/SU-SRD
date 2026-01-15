/**
 * TanStack Query hooks for player choice management
 *
 * Provides hooks for fetching and mutating player choices with:
 * - Automatic caching
 * - Optimistic updates for better UX
 * - Cache invalidation on mutations
 * - Loading and error states
 *
 * NESTED CHOICES:
 * - Supports choices that belong to entities OR other choices
 * - Use usePlayerChoices(entityId) for entity choices
 * - Use useNestedChoices(choiceId) for nested choices
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Tables, TablesInsert } from '../../types/database-generated.types'
import type { HydratedEntity } from '../../types/hydrated'
import {
  fetchChoicesForEntity,
  fetchChoicesForChoice,
  upsertPlayerChoice,
  deletePlayerChoice,
  deleteChoicesForEntity,
  deleteChoicesForChoice,
} from '../../lib/api/playerChoices'
import { entitiesKeys } from './useSUEntities'
import { isLocalId, generateLocalId } from '../../lib/cacheHelpers'

/**
 * Query key factory for player choices
 * Ensures consistent cache keys across the app
 */
export const playerChoicesKeys = {
  all: ['player_choices'] as const,
  forEntity: (entityId: string) => [...playerChoicesKeys.all, 'entity', entityId] as const,
  forChoice: (choiceId: string) => [...playerChoicesKeys.all, 'choice', choiceId] as const,
}

/**
 * Hook to fetch player choices for an entity
 *
 * For local entities (with local IDs), returns empty array and relies on cache.
 * For API-backed entities, fetches from Supabase.
 *
 * @param entityId - ID of entity
 * @returns Query result with player choices
 *
 * @example
 * ```tsx
 * const { data: choices, isLoading } = usePlayerChoices(entityId)
 * const weaponChoice = choices?.find(c => c.choice_ref_id === 'weapon')
 * ```
 */
export function usePlayerChoices(entityId: string | undefined) {
  const isLocal = entityId ? isLocalId(entityId) : false

  return useQuery({
    queryKey: playerChoicesKeys.forEntity(entityId!),
    queryFn: () => fetchChoicesForEntity(entityId!),
    enabled: !!entityId && !isLocal,

    initialData: isLocal ? [] : undefined,
  })
}

/**
 * Hook to fetch nested choices for a player choice
 *
 * For local choices (with local IDs), returns empty array and relies on cache.
 * For API-backed choices, fetches from Supabase.
 *
 * @param choiceId - ID of parent choice
 * @returns Query result with nested player choices
 *
 * @example
 * ```tsx
 * const { data: nestedChoices, isLoading } = useNestedChoices(choiceId)
 * ```
 */
export function useNestedChoices(choiceId: string | undefined) {
  const isLocal = choiceId ? isLocalId(choiceId) : false

  return useQuery({
    queryKey: playerChoicesKeys.forChoice(choiceId!),
    queryFn: () => fetchChoicesForChoice(choiceId!),
    enabled: !!choiceId && !isLocal,

    initialData: isLocal ? [] : undefined,
  })
}

/**
 * Get all selections for a specific choice_ref_id
 *
 * @param choices - Array of all player choices
 * @param choiceRefId - Choice reference ID to filter by
 * @returns Array of selections for this choice
 */
export function getSelectionsForChoice(
  choices: Tables<'player_choices'>[],
  choiceRefId: string
): Tables<'player_choices'>[] {
  return choices.filter((c) => c.choice_ref_id === choiceRefId)
}

/**
 * Hook to upsert a player choice
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Upserts in Supabase
 * - Cache-only: Upserts in cache only
 *
 * For multi-select choices, always adds a new selection.
 * For single-select choices, replaces existing selection.
 *
 * Automatically invalidates the appropriate choice cache on success.
 * Also invalidates the parent's entity cache to update the hydrated entity.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const upsertChoice = useUpsertPlayerChoice()
 *
 * // Entity choice (single-select)
 * await upsertChoice.mutate({
 *   data: {
 *     entity_id: entityId,
 *     choice_ref_id: 'weapon',
 *     value: 'systems::laser-rifle',
 *   },
 *   isMultiSelect: false,
 * })
 *
 * // Multi-select choice
 * await upsertChoice.mutate({
 *   data: {
 *     entity_id: entityId,
 *     choice_ref_id: 'modification',
 *     value: 'Rangefinder',
 *   },
 *   isMultiSelect: true,
 * })
 * ```
 */
export function useUpsertPlayerChoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      data,
      isMultiSelect = false,
    }: {
      data: TablesInsert<'player_choices'>
      isMultiSelect?: boolean
    }) => {
      const entityId = data.entity_id
      const choiceId = (data as { player_choice_id?: string }).player_choice_id

      if ((entityId && isLocalId(entityId)) || (choiceId && isLocalId(choiceId))) {
        const queryKey = entityId
          ? playerChoicesKeys.forEntity(entityId)
          : playerChoicesKeys.forChoice(choiceId!)

        const currentChoices = queryClient.getQueryData<Tables<'player_choices'>[]>(queryKey) || []

        let updatedChoices: Tables<'player_choices'>[]
        const now = new Date().toISOString()

        if (isMultiSelect) {
          // For multi-select, always add a new selection
          const newChoice: Tables<'player_choices'> = {
            id: generateLocalId(),
            created_at: now,
            updated_at: now,
            entity_id: data.entity_id || null,
            player_choice_id: (data as { player_choice_id?: string }).player_choice_id || null,
            choice_ref_id: data.choice_ref_id!,
            value: data.value!,
          }
          updatedChoices = [...currentChoices, newChoice]
          queryClient.setQueryData(queryKey, updatedChoices)
          return newChoice
        } else {
          // For single-select, replace existing selection
          const existingIndex = currentChoices.findIndex(
            (c) => c.choice_ref_id === data.choice_ref_id
          )

          const existingChoice = existingIndex >= 0 ? currentChoices[existingIndex] : undefined
          const upsertedChoice: Tables<'player_choices'> = {
            id: existingChoice?.id ?? generateLocalId(),
            created_at: existingChoice?.created_at ?? now,
            updated_at: now,
            entity_id: data.entity_id || null,
            player_choice_id: (data as { player_choice_id?: string }).player_choice_id || null,
            choice_ref_id: data.choice_ref_id!,
            value: data.value!,
          }

          updatedChoices =
            existingIndex >= 0
              ? currentChoices.map((c, i) => (i === existingIndex ? upsertedChoice : c))
              : [...currentChoices, upsertedChoice]

          queryClient.setQueryData(queryKey, updatedChoices)
          return upsertedChoice
        }
      }

      return upsertPlayerChoice(data, isMultiSelect)
    },

    onMutate: async ({ data, isMultiSelect = false }) => {
      const entityId = data.entity_id
      const choiceId = (data as { player_choice_id?: string }).player_choice_id

      if ((entityId && isLocalId(entityId)) || (choiceId && isLocalId(choiceId))) {
        return
      }

      const queryKey = entityId
        ? playerChoicesKeys.forEntity(entityId)
        : choiceId
          ? playerChoicesKeys.forChoice(choiceId)
          : null

      if (!queryKey) return

      await queryClient.cancelQueries({ queryKey: queryKey as readonly string[] })

      const previousChoices = queryClient.getQueryData<Tables<'player_choices'>[]>(queryKey) || []

      const now = new Date().toISOString()
      let updatedChoices: Tables<'player_choices'>[]

      if (isMultiSelect) {
        // For multi-select, always add new selection
        const optimisticChoice: Tables<'player_choices'> = {
          id: generateLocalId(),
          created_at: now,
          updated_at: now,
          entity_id: data.entity_id || null,
          player_choice_id: (data as { player_choice_id?: string }).player_choice_id || null,
          choice_ref_id: data.choice_ref_id!,
          value: data.value!,
        }
        updatedChoices = [...previousChoices, optimisticChoice]
      } else {
        // For single-select, replace existing
        const existingIndex = previousChoices.findIndex(
          (c) => c.choice_ref_id === data.choice_ref_id
        )

        const existingChoice = existingIndex >= 0 ? previousChoices[existingIndex] : undefined
        const optimisticChoice: Tables<'player_choices'> = {
          id: existingChoice?.id ?? generateLocalId(),
          created_at: existingChoice?.created_at ?? now,
          updated_at: now,
          entity_id: data.entity_id || null,
          player_choice_id: (data as { player_choice_id?: string }).player_choice_id || null,
          choice_ref_id: data.choice_ref_id!,
          value: data.value!,
        }

        updatedChoices =
          existingIndex >= 0
            ? previousChoices.map((c, i) => (i === existingIndex ? optimisticChoice : c))
            : [...previousChoices, optimisticChoice]
      }

      queryClient.setQueryData(queryKey, updatedChoices)

      return { previousChoices, queryKey, entityId, choiceId, isMultiSelect }
    },

    onError: (_err, _data, context) => {
      if (context?.previousChoices && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousChoices)
      }
    },

    onSuccess: (choice) => {
      const entityId = choice.entity_id
      const choiceId = (choice as { player_choice_id?: string }).player_choice_id

      if ((entityId && isLocalId(entityId)) || (choiceId && isLocalId(choiceId))) {
        queryClient.setQueriesData<HydratedEntity[]>(
          { queryKey: entitiesKeys.all },
          (oldEntities) => {
            if (!oldEntities) return oldEntities

            return oldEntities.map((entity) => {
              if (entity.id === entityId) {
                const existingIndex =
                  entity.choices?.findIndex((c) => c.choice_ref_id === choice.choice_ref_id) ?? -1

                // For multi-select, append; for single-select, replace
                // Note: We can't reliably detect multi-select from cache, so we'll just replace
                // The UI will handle displaying multiple selections correctly
                const currentChoices = entity.choices ?? []
                const updatedChoices =
                  existingIndex >= 0
                    ? currentChoices.map((c, i) => (i === existingIndex ? choice : c))
                    : [...currentChoices, choice]

                return {
                  ...entity,
                  choices: updatedChoices,
                }
              }
              return entity
            })
          }
        )
        return
      }

      if (entityId) {
        queryClient.invalidateQueries({
          queryKey: playerChoicesKeys.forEntity(entityId),
        })
      }
      if (choiceId) {
        queryClient.invalidateQueries({
          queryKey: playerChoicesKeys.forChoice(choiceId),
        })
      }

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.all,
      })
    },
  })
}

/**
 * Hook to delete a player choice
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Deletes from Supabase
 * - Cache-only: Removes from cache only
 *
 * Automatically invalidates the appropriate choice cache on success.
 * Also invalidates the parent's entity cache to update the hydrated entity.
 * Cascade delete will automatically remove nested choices.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteChoice = useDeletePlayerChoice()
 *
 * deleteChoice.mutate({
 *   id: choiceId,
 *   entityId: entityId,  // For entity choices
 *   choiceId: parentChoiceId,  // For nested choices
 * })
 * ```
 */
export function useDeletePlayerChoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      entityId,
      choiceId,
    }: {
      id: string
      entityId?: string
      choiceId?: string
    }) => {
      if ((entityId && isLocalId(entityId)) || (choiceId && isLocalId(choiceId)) || isLocalId(id)) {
        const queryKey = entityId
          ? playerChoicesKeys.forEntity(entityId)
          : choiceId
            ? playerChoicesKeys.forChoice(choiceId)
            : null

        if (queryKey) {
          const currentChoices = queryClient.getQueryData<Tables<'player_choices'>[]>(queryKey)
          if (currentChoices) {
            const updatedChoices = currentChoices.filter((c) => c.id !== id)
            queryClient.setQueryData(queryKey, updatedChoices)
          }
        }

        return
      }

      return deletePlayerChoice(id)
    },
    onSuccess: (_, variables) => {
      if (
        (variables.entityId && isLocalId(variables.entityId)) ||
        (variables.choiceId && isLocalId(variables.choiceId)) ||
        isLocalId(variables.id)
      ) {
        queryClient.setQueriesData<HydratedEntity[]>(
          { queryKey: entitiesKeys.all },
          (oldEntities) => {
            if (!oldEntities) return oldEntities

            return oldEntities.map((entity) => {
              if (entity.id === variables.entityId) {
                return {
                  ...entity,
                  choices: (entity.choices ?? []).filter((c) => c.id !== variables.id),
                }
              }
              return entity
            })
          }
        )
        return
      }

      if (variables.entityId) {
        queryClient.invalidateQueries({
          queryKey: playerChoicesKeys.forEntity(variables.entityId),
        })
      }
      if (variables.choiceId) {
        queryClient.invalidateQueries({
          queryKey: playerChoicesKeys.forChoice(variables.choiceId),
        })
      }

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.all,
      })
    },
  })
}

/**
 * Hook to delete all choices for an entity
 *
 * Automatically invalidates the entity's choice cache on success.
 * Also invalidates the parent's entity cache to update the hydrated entity.
 * Cascade delete will automatically remove nested choices.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteAllChoices = useDeleteChoicesForEntity()
 *
 * await deleteAllChoices.mutate({ entityId })
 * ```
 */
export function useDeleteChoicesForEntity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ entityId }: { entityId: string }) => deleteChoicesForEntity(entityId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: playerChoicesKeys.forEntity(variables.entityId),
      })

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.all,
      })
    },
  })
}

/**
 * Hook to delete all nested choices for a player choice
 *
 * Automatically invalidates the choice's cache on success.
 * Also invalidates the parent's entity cache to update the hydrated entity.
 * Cascade delete will automatically remove deeply nested choices.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteNestedChoices = useDeleteChoicesForChoice()
 *
 * await deleteNestedChoices.mutate({ choiceId })
 * ```
 */
export function useDeleteChoicesForChoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ choiceId }: { choiceId: string }) => deleteChoicesForChoice(choiceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: playerChoicesKeys.forChoice(variables.choiceId),
      })

      queryClient.invalidateQueries({
        queryKey: entitiesKeys.all,
      })
    },
  })
}
