/**
 * Action utilities for live sheet tests
 *
 * Utilities for setting up test state and performing actions
 */

import type { QueryClient } from '@tanstack/react-query'
import { generateLocalId, LOCAL_ID } from '../lib/cacheHelpers'
import { createLocalPilot, getPilotFromCache } from './liveSheetHelpers'
import { createLocalEntity } from './liveSheetHelpers'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Tables } from '../types/database-generated.types'
import { entitiesKeys } from '../hooks/suentity/useSUEntities'
import type { HydratedEntity } from '../types/hydrated'

/**
 * Set up a local pilot with a class selected
 */
export function setupPilotWithClass(
  queryClient: QueryClient,
  pilotId: string = LOCAL_ID,
  classId: string
): string {
  // Create the pilot if it doesn't exist
  let pilot = getPilotFromCache(queryClient, pilotId)
  if (!pilot) {
    pilot = createLocalPilot(queryClient, pilotId)
  }

  // Create class entity
  const classEntity = createLocalEntity(queryClient, pilotId, 'classes', classId)
  return classEntity.id
}

/**
 * Add ability to pilot
 */
export function addAbilityToPilot(
  queryClient: QueryClient,
  pilotId: string,
  abilityId: string
): string {
  // Create ability entity
  const abilityEntity = createLocalEntity(queryClient, pilotId, 'abilities', abilityId)

  // Update pilot TP (this is a simplified version - real implementation would calculate cost)
  const pilot = getPilotFromCache(queryClient, pilotId)
  if (pilot) {
    const ability = SalvageUnionReference.get('abilities', abilityId) as
      | { level?: number | string }
      | undefined
    const cost = ability?.level === 1 ? 1 : ability?.level === 2 ? 2 : ability?.level === 3 ? 3 : 1
    queryClient.setQueryData(
      queryClient.getQueryCache().find({ queryKey: ['pilots', pilotId] })?.queryKey || [
        'pilots',
        pilotId,
      ],
      {
        ...pilot,
        current_tp: (pilot.current_tp || 0) - cost,
      }
    )
  }

  return abilityEntity.id
}

/**
 * Remove ability from pilot
 */
export function removeAbilityFromPilot(
  queryClient: QueryClient,
  pilotId: string,
  abilityEntityId: string
): void {
  const queryKey = entitiesKeys.forParent('pilot', pilotId)
  const entities = queryClient.getQueryData<HydratedEntity[]>(queryKey) || []
  const abilityEntity = entities.find((e) => e.id === abilityEntityId)

  if (abilityEntity) {
    // Remove the entity
    queryClient.setQueryData(
      queryKey,
      entities.filter((e) => e.id !== abilityEntityId)
    )

    // Refund TP
    const pilot = getPilotFromCache(queryClient, pilotId)
    if (pilot && abilityEntity.ref) {
      const ability = abilityEntity.ref as { level?: number | string }
      const cost = ability.level === 1 ? 1 : ability.level === 2 ? 2 : ability.level === 3 ? 3 : 1
      queryClient.setQueryData(
        queryClient.getQueryCache().find({ queryKey: ['pilots', pilotId] })?.queryKey || [
          'pilots',
          pilotId,
        ],
        {
          ...pilot,
          current_tp: (pilot.current_tp || 0) + cost,
        }
      )
    }
  }
}

/**
 * Update pilot resource (HP, AP, or TP)
 */
export function updatePilotResource(
  queryClient: QueryClient,
  pilotId: string,
  resource: 'hp' | 'ap' | 'tp',
  value: number
): void {
  const pilot = getPilotFromCache(queryClient, pilotId)
  if (!pilot) {
    throw new Error(`Pilot ${pilotId} not found`)
  }

  const updates: Partial<Tables<'pilots'>> = {}

  if (resource === 'hp' && pilot.max_hp !== null) {
    updates.current_damage = pilot.max_hp - value
  } else if (resource === 'ap') {
    updates.current_ap = value
  } else if (resource === 'tp') {
    updates.current_tp = value
  }

  queryClient.setQueryData(
    queryClient.getQueryCache().find({ queryKey: ['pilots', pilotId] })?.queryKey || [
      'pilots',
      pilotId,
    ],
    {
      ...pilot,
      ...updates,
      updated_at: new Date().toISOString(),
    }
  )
}

/**
 * Add equipment to pilot inventory
 */
export function addEquipmentToPilot(
  queryClient: QueryClient,
  pilotId: string,
  equipmentId: string
): string {
  return createLocalEntity(queryClient, pilotId, 'equipment', equipmentId).id
}

/**
 * Remove equipment from pilot
 */
export function removeEquipmentFromPilot(
  queryClient: QueryClient,
  pilotId: string,
  equipmentEntityId: string
): void {
  const queryKey = entitiesKeys.forParent('pilot', pilotId)
  const entities = queryClient.getQueryData<HydratedEntity[]>(queryKey) || []
  queryClient.setQueryData(
    queryKey,
    entities.filter((e) => e.id !== equipmentEntityId)
  )
}

/**
 * Create or update a player choice
 */
export function makePlayerChoice(
  queryClient: QueryClient,
  entityId: string,
  choiceRefId: string,
  value: string
): void {
  const choiceKey = ['player_choices', 'entity', entityId]
  const currentChoices = queryClient.getQueryData<Tables<'player_choices'>[]>(choiceKey) || []

  const now = new Date().toISOString()
  const existingIndex = currentChoices.findIndex((c) => c.choice_ref_id === choiceRefId)

  const newChoice: Tables<'player_choices'> = {
    id: generateLocalId(),
    created_at: now,
    updated_at: now,
    entity_id: entityId,
    player_choice_id: null,
    choice_ref_id: choiceRefId,
    value,
  }

  if (existingIndex >= 0) {
    // Replace existing choice
    const updated = [...currentChoices]
    updated[existingIndex] = newChoice
    queryClient.setQueryData(choiceKey, updated)
  } else {
    // Add new choice
    queryClient.setQueryData(choiceKey, [...currentChoices, newChoice])
  }

  // Also update the entity's choices in the hydrated entities cache
  const allQueryKeys = queryClient
    .getQueryCache()
    .getAll()
    .map((query) => query.queryKey)
  for (const queryKey of allQueryKeys) {
    if (
      Array.isArray(queryKey) &&
      queryKey[0] === 'entities' &&
      queryKey[1] === 'pilot' &&
      typeof queryKey[2] === 'string'
    ) {
      const entities = queryClient.getQueryData<HydratedEntity[]>(queryKey)
      if (entities) {
        const entity = entities.find((e) => e.id === entityId)
        if (entity) {
          const updatedEntities = entities.map((e) => {
            if (e.id === entityId) {
              const existingChoiceIndex = e.choices.findIndex(
                (c) => c.choice_ref_id === choiceRefId
              )
              const updatedChoices =
                existingChoiceIndex >= 0
                  ? e.choices.map((c, i) => (i === existingChoiceIndex ? newChoice : c))
                  : [...e.choices, newChoice]
              return { ...e, choices: updatedChoices }
            }
            return e
          })
          queryClient.setQueryData(queryKey, updatedEntities)
        }
      }
    }
  }
}

/**
 * Set up pilot with multiple abilities
 */
export function setupPilotWithAbilities(
  queryClient: QueryClient,
  pilotId: string,
  abilityIds: string[]
): string[] {
  return abilityIds.map((abilityId) => addAbilityToPilot(queryClient, pilotId, abilityId))
}

/**
 * Set up pilot with multiple equipment
 */
export function setupPilotWithEquipment(
  queryClient: QueryClient,
  pilotId: string,
  equipmentIds: string[]
): string[] {
  return equipmentIds.map((equipmentId) => addEquipmentToPilot(queryClient, pilotId, equipmentId))
}
