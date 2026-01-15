/**
 * TanStack Query hooks for mech management
 *
 * Provides hooks for fetching and mutating mechs with:
 * - Automatic caching
 * - Optimistic updates for better UX
 * - Cache invalidation on mutations
 * - Loading and error states
 * - Support for both API-backed and cache-only (local) data
 *
 * Use LOCAL_ID as the mech ID to work with cache-only data that doesn't
 * persist to the database.
 */

import { createEntityHooks } from '../createEntityHooks'
import { LOCAL_ID } from '../../lib/cacheHelpers'
import type { Tables } from '../../types/database-generated.types'

export { LOCAL_ID }

type Mech = Tables<'mechs'>

const defaultMech: Mech = {
  id: LOCAL_ID,
  systems: [],
  modules: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'local',
  pilot_id: null,
  pattern: null,
  quirk: null,
  appearance: null,
  current_damage: 0,
  current_ep: 0,
  current_heat: 0,
  notes: null,
  active: false,
  private: true,
  image_url: null,
}

const {
  keys: mechsKeys,
  useEntity,
  useCreateEntity,
  useUpdateEntity,
  useDeleteEntity,
} = createEntityHooks<Mech>({
  tableName: 'mechs',
  defaultEntity: defaultMech,
})

/**
 * Query key factory for mechs
 * Ensures consistent cache keys across the app
 */
export { mechsKeys }

/**
 * Hook to fetch a single mech by ID
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Pass a database ID, fetches from Supabase
 * - Cache-only: Pass LOCAL_ID, returns cached data only (no API call)
 *
 * @param id - Mech ID, or LOCAL_ID for cache-only
 * @returns Query result with mech data
 *
 * @example
 * ```tsx
 * // API-backed mech
 * const { data: mech } = useMech('uuid-from-database')
 *
 * // Cache-only mech (no API calls, cleared on refresh)
 * const { data: localMech } = useMech(LOCAL_ID)
 * ```
 */
export const useMech = useEntity

/**
 * Hook to create a new mech
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Creates in Supabase, returns database row
 * - Cache-only: Adds to cache only, generates local ID
 *
 * Automatically invalidates the mech cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const createMech = useCreateMech()
 *
 * // API-backed mech
 * await createMech.mutate({
 *   pilot_id: 'uuid-from-db',
 *   name: 'Iron Giant',
 * })
 *
 * // Cache-only mech
 * await createMech.mutate({
 *   id: LOCAL_ID,
 *   pilot_id: null,
 *   name: 'Iron Giant',
 * })
 * ```
 */
export const useCreateMech = useCreateEntity

/**
 * Hook to update a mech
 *
 * Supports both API-backed and cache-only (local) data.
 * Automatically invalidates the mech cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const updateMech = useUpdateMech()
 *
 * await updateMech.mutate({
 *   id: mechId,
 *   updates: { current_damage: 5 },
 * })
 * ```
 */
export const useUpdateMech = useUpdateEntity

/**
 * Hook to delete a mech
 *
 * Automatically invalidates the mech cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deleteMech = useDeleteMech()
 *
 * await deleteMech.mutate(mechId)
 * ```
 */
export const useDeleteMech = useDeleteEntity
