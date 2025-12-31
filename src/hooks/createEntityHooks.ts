/**
 * Factory for creating entity CRUD hooks
 *
 * Generates consistent hooks for fetching and mutating entities with:
 * - Automatic caching
 * - Optimistic updates for better UX
 * - Cache invalidation on mutations
 * - Loading and error states
 * - Support for both API-backed and cache-only (local) data
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { TablesInsert, TablesUpdate } from '../types/database-generated.types'
import { fetchEntity, createEntity, updateEntity, deleteEntity } from '../lib/api'
import { isLocalId } from '../lib/cacheHelpers'
import type { ValidTable } from '../types/common'

export interface CreateEntityHooksOptions<T extends { id: string }> {
  /**
   * Table name for the entity
   */
  tableName: ValidTable

  /**
   * Default entity to use for local/cache-only entities
   */
  defaultEntity: T

  /**
   * Optional callback to run after successful entity creation
   * Useful for creating related entities (e.g., crawler bays)
   */
  onCreateSuccess?: (newEntity: T, queryClient: QueryClient) => Promise<void> | void
}

export interface EntityHooks<T extends { id: string }> {
  /**
   * Query key factory for consistent cache keys
   */
  keys: {
    all: readonly [ValidTable]
    byId: (id: string) => readonly [ValidTable, string]
  }

  /**
   * Hook to fetch a single entity by ID
   * Supports both API-backed and cache-only (local) data
   */
  useEntity: (id: string | undefined) => {
    data: T | undefined
    isLoading: boolean
    error: unknown
  }

  /**
   * Hook to create a new entity
   * Supports both API-backed and cache-only (local) data
   */
  useCreateEntity: () => {
    mutate: (data: TablesInsert<ValidTable>) => void
    mutateAsync: (data: TablesInsert<ValidTable>) => Promise<T>
    isPending: boolean
  }

  /**
   * Hook to update an entity
   * Supports both API-backed and cache-only (local) data
   * Includes optimistic updates for better UX
   */
  useUpdateEntity: () => {
    mutate: (variables: { id: string; updates: TablesUpdate<ValidTable> }) => void
    mutateAsync: (variables: { id: string; updates: TablesUpdate<ValidTable> }) => Promise<T>
    isPending: boolean
  }

  /**
   * Hook to delete an entity
   * Automatically invalidates cache on success
   */
  useDeleteEntity: () => {
    mutate: (id: string) => void
    mutateAsync: (id: string) => Promise<void>
    isPending: boolean
  }
}

/**
 * Create entity hooks for a given table
 *
 * @example
 * ```tsx
 * const { keys, useEntity, useCreateEntity, useUpdateEntity, useDeleteEntity } =
 *   createEntityHooks({
 *     tableName: 'pilots',
 *     defaultEntity: defaultPilot,
 *   })
 * ```
 */
export function createEntityHooks<T extends { id: string }>({
  tableName,
  defaultEntity,
  onCreateSuccess,
}: CreateEntityHooksOptions<T>): EntityHooks<T> {
  const keys = {
    all: [tableName] as const,
    byId: (id: string) => [tableName, id] as const,
  }

  function useEntity(id: string | undefined) {
    const isLocal = isLocalId(id)

    return useQuery({
      queryKey: keys.byId(id!),
      queryFn: isLocal ? async () => defaultEntity : () => fetchEntity<T>(tableName, id!),
      enabled: !!id,
      initialData: isLocal ? defaultEntity : undefined,
    })
  }

  function useCreateEntity() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (data: TablesInsert<ValidTable>) => {
        const entityId = (data as unknown as T).id

        if (entityId && isLocalId(entityId)) {
          queryClient.setQueryData(keys.byId(entityId), defaultEntity)
          return defaultEntity
        }

        return createEntity<T>(tableName, data as unknown as T)
      },
      onSuccess: async (newEntity) => {
        if (onCreateSuccess) {
          await onCreateSuccess(newEntity, queryClient)
        }

        if (isLocalId(newEntity.id)) return

        queryClient.invalidateQueries({
          queryKey: keys.byId(newEntity.id),
        })
      },
    })
  }

  function useUpdateEntity() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<ValidTable> }) => {
        if (isLocalId(id)) {
          const currentEntity = queryClient.getQueryData<T>(keys.byId(id))
          if (!currentEntity) {
            throw new Error(`${tableName} not found in cache`)
          }

          const updatedEntity: T = {
            ...currentEntity,
            ...updates,
            updated_at: new Date().toISOString(),
          } as T

          queryClient.setQueryData(keys.byId(id), updatedEntity)
          return updatedEntity
        }

        await updateEntity<T>(tableName, id, updates as Partial<T>)

        return fetchEntity<T>(tableName, id)
      },

      onMutate: async ({ id, updates }) => {
        if (isLocalId(id)) return

        await queryClient.cancelQueries({ queryKey: keys.byId(id) })

        const previousEntity = queryClient.getQueryData<T>(keys.byId(id))

        if (previousEntity) {
          queryClient.setQueryData<T>(keys.byId(id), {
            ...previousEntity,
            ...updates,
            updated_at: new Date().toISOString(),
          } as T)
        }

        return { previousEntity, id }
      },

      onError: (_err, _variables, context) => {
        if (context?.previousEntity) {
          queryClient.setQueryData(keys.byId(context.id), context.previousEntity)
        }
      },

      onSuccess: (_updatedEntity, variables) => {
        if (isLocalId(variables.id)) return

        queryClient.invalidateQueries({
          queryKey: keys.byId(variables.id),
        })
      },
    })
  }

  function useDeleteEntity() {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: async (id: string) => {
        if (isLocalId(id)) {
          queryClient.removeQueries({ queryKey: keys.byId(id) })
          return
        }

        await deleteEntity(tableName, id)
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: keys.all,
        })
      },
    })
  }

  return {
    keys,
    useEntity,
    useCreateEntity,
    useUpdateEntity,
    useDeleteEntity,
  }
}
