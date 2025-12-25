/**
 * TanStack Query hooks for pilot management
 *
 * Provides hooks for fetching and mutating pilots with:
 * - Automatic caching
 * - Optimistic updates for better UX
 * - Cache invalidation on mutations
 * - Loading and error states
 * - Support for both API-backed and cache-only (local) data
 *
 * Use LOCAL_ID as the pilot ID to work with cache-only data that doesn't
 * persist to the database.
 */

import { createEntityHooks } from '../createEntityHooks'
import { LOCAL_ID } from '../../lib/cacheHelpers'
import type { Tables } from '../../types/database-generated.types'

export { LOCAL_ID }

type Pilot = Tables<'pilots'>

const defaultPilot: Pilot = {
  id: LOCAL_ID,
  image_url: null,
  callsign: 'Unknown Name',
  max_hp: 10,
  max_ap: 5,
  current_damage: 0,
  current_ap: 0,
  abilities: [],
  equipment: [],
  active: false,
  private: true,
  user_id: 'local',
  appearance: null,
  background: null,
  background_used: null,
  crawler_id: null,
  created_at: new Date().toISOString(),
  current_tp: 0,
  notes: null,
  keepsake: null,
  keepsake_used: null,
  motto: null,
  motto_used: null,
  updated_at: new Date().toISOString(),
}

const { keys: pilotsKeys, useEntity, useCreateEntity, useUpdateEntity, useDeleteEntity } =
  createEntityHooks<Pilot>({
    tableName: 'pilots',
    defaultEntity: defaultPilot,
  })

/**
 * Query key factory for pilots
 * Ensures consistent cache keys across the app
 */
export { pilotsKeys }

/**
 * Hook to fetch a single pilot by ID
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Pass a database ID, fetches from Supabase
 * - Cache-only: Pass LOCAL_ID, returns cached data only (no API call)
 *
 * @param id - Pilot ID, or LOCAL_ID for cache-only
 * @returns Query result with pilot data
 *
 * @example
 * ```tsx
 * // API-backed pilot
 * const { data: pilot } = usePilot('uuid-from-database')
 *
 * // Cache-only pilot (no API calls, cleared on refresh)
 * const { data: localPilot } = usePilot(LOCAL_ID)
 * ```
 */
export const usePilot = useEntity

/**
 * Hook to create a new pilot
 *
 * Supports both API-backed and cache-only (local) data:
 * - API-backed: Creates in Supabase, returns database row
 * - Cache-only: Adds to cache only, generates local ID
 *
 * Automatically invalidates the pilot cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const createPilot = useCreatePilot()
 *
 * // API-backed pilot
 * await createPilot.mutate({
 *   callsign: 'Alex',
 * })
 *
 * // Cache-only pilot
 * await createPilot.mutate({
 *   id: LOCAL_ID,
 *   callsign: 'Alex',
 * })
 * ```
 */
export const useCreatePilot = useCreateEntity

/**
 * Hook to update a pilot
 *
 * Supports both API-backed and cache-only (local) data.
 * Automatically invalidates the pilot cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const updatePilot = useUpdatePilot()
 *
 * await updatePilot.mutate({
 *   id: pilotId,
 *   updates: { current_hp: 8 },
 * })
 * ```
 */
export const useUpdatePilot = useUpdateEntity

/**
 * Hook to delete a pilot
 *
 * Automatically invalidates the pilot cache on success.
 *
 * @returns Mutation object with mutate/mutateAsync functions
 *
 * @example
 * ```tsx
 * const deletePilot = useDeletePilot()
 *
 * deletePilot.mutate(pilotId)
 * ```
 */
export const useDeletePilot = useDeleteEntity
