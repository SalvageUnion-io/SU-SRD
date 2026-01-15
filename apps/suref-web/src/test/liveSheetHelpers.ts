/**
 * Core test helpers for live sheets
 *
 * Utilities for creating test data, managing cache state, and querying test results
 */

import { QueryClient } from '@tanstack/react-query'
import { generateLocalId, LOCAL_ID, isLocalId } from '../lib/cacheHelpers'
import { pilotsKeys } from '../hooks/pilot'
import { mechsKeys } from '../hooks/mech/useMechs'
import { entitiesKeys } from '../hooks/suentity/useSUEntities'
import type { Tables, Json } from '../types/database-generated.types'
import type { HydratedEntity } from '../types/hydrated'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'

/**
 * Create a local pilot in cache with default or custom values
 */
export function createLocalPilot(
  queryClient: QueryClient,
  id: string = LOCAL_ID,
  overrides?: Partial<Tables<'pilots'>>
): Tables<'pilots'> {
  const now = new Date().toISOString()
  const pilot: Tables<'pilots'> = {
    id,
    image_url: null,
    callsign: 'Test Pilot',
    max_hp: 10,
    max_ap: 5,
    current_damage: 0,
    current_ap: 5,
    current_tp: 0,
    abilities: [],
    equipment: [],
    active: false,
    private: true,
    user_id: 'local',
    appearance: null,
    background: null,
    background_used: false,
    crawler_id: null,
    created_at: now,
    updated_at: now,
    notes: null,
    keepsake: null,
    keepsake_used: false,
    motto: null,
    motto_used: false,
    ...overrides,
  }

  queryClient.setQueryData(pilotsKeys.byId(id), pilot)
  return pilot
}

/**
 * Create a local mech in cache with default or custom values
 */
export function createLocalMech(
  queryClient: QueryClient,
  id: string = generateLocalId(),
  overrides?: Partial<Tables<'mechs'>>
): Tables<'mechs'> {
  const now = new Date().toISOString()
  const mech: Tables<'mechs'> = {
    id,
    systems: [],
    modules: [],
    created_at: now,
    updated_at: now,
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
    ...overrides,
  }

  queryClient.setQueryData(mechsKeys.byId(id), mech)
  return mech
}

/**
 * Create a local entity (ability/equipment/etc) in cache
 */
export function createLocalEntity(
  queryClient: QueryClient,
  parentId: string,
  schemaName: SURefEnumSchemaName,
  schemaRefId: string,
  metadata: unknown = null
): HydratedEntity {
  const ref = SalvageUnionReference.get(schemaName, schemaRefId)
  if (!ref) {
    throw new Error(`Reference not found: ${schemaName}/${schemaRefId}`)
  }

  const now = new Date().toISOString()
  // For tests, assume pilot parent type for local IDs
  const pilotId = isLocalId(parentId) ? parentId : null
  const mechId = null
  const crawlerId = null

  const entity: HydratedEntity = {
    id: generateLocalId(),
    created_at: now,
    updated_at: now,
    pilot_id: pilotId,
    mech_id: mechId,
    crawler_id: crawlerId,
    parent_entity_id: null,
    schema_name: schemaName,
    schema_ref_id: schemaRefId,
    metadata: metadata as Json,
    ref: ref as SURefEntity,
    choices: [],
  }

  const parentTypeKey = pilotId ? 'pilot' : mechId ? 'mech' : 'crawler'
  const queryKey = entitiesKeys.forParent(parentTypeKey, parentId)
  const currentEntities = queryClient.getQueryData<HydratedEntity[]>(queryKey) || []
  queryClient.setQueryData(queryKey, [...currentEntities, entity])

  return entity
}

/**
 * Get pilot data from cache
 */
export function getPilotFromCache(
  queryClient: QueryClient,
  id: string
): Tables<'pilots'> | undefined {
  return queryClient.getQueryData<Tables<'pilots'>>(pilotsKeys.byId(id))
}

/**
 * Get hydrated pilot data from cache
 * Note: This simulates hydration by fetching pilot + entities
 */
export async function getHydratedPilotFromCache(
  queryClient: QueryClient,
  id: string
): Promise<{
  pilot: Tables<'pilots'> | undefined
  entities: HydratedEntity[]
}> {
  const pilot = getPilotFromCache(queryClient, id)
  const parentType = 'pilot'
  const queryKey = entitiesKeys.forParent(parentType, id)
  const entities = queryClient.getQueryData<HydratedEntity[]>(queryKey) || []

  return { pilot, entities }
}

/**
 * Get entities from cache for a parent
 */
export function getEntitiesFromCache(
  queryClient: QueryClient,
  parentType: 'pilot' | 'mech' | 'crawler',
  parentId: string
): HydratedEntity[] {
  const queryKey = entitiesKeys.forParent(parentType, parentId)
  return queryClient.getQueryData<HydratedEntity[]>(queryKey) || []
}

/**
 * Wait for hydration to complete
 * Useful for waiting for async operations in tests
 */
export async function waitForHydration(
  queryClient: QueryClient,
  parentType: 'pilot' | 'mech' | 'crawler',
  parentId: string,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now()
  const queryKey = entitiesKeys.forParent(parentType, parentId)

  while (Date.now() - startTime < timeout) {
    const data = queryClient.getQueryData<HydratedEntity[]>(queryKey)
    if (data !== undefined) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error(`Hydration timeout after ${timeout}ms`)
}
