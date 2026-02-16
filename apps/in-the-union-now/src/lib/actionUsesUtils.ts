import type { SURefMetaAction, SURefEnumSchemaName, SURefEntity } from 'salvageunion-reference'
import {
  SalvageUnionReference,
  extractVisibleActions,
  getRequiredTraits,
} from 'salvageunion-reference'
import type { Json } from '../types/database-generated.types'
import type { EntityRefRow, PilotRow } from '../types/common'

/**
 * Get the numeric AP activation cost from an action.
 * Returns null for undefined, 0, 'X', or 'Variable' costs.
 */
export function getActionActivationCost(action: SURefMetaAction): number | null {
  if (!('activationCost' in action)) return null
  const cost = action.activationCost
  if (typeof cost === 'number' && cost > 0) return cost
  return null
}

/**
 * Get the max uses from an action's traits.
 * Looks for { type: "uses", amount: N } in the traits array.
 */
export function getActionMaxUses(action: SURefMetaAction): number | null {
  if (!('traits' in action) || !Array.isArray(action.traits)) return null
  const usesTrait = action.traits.find((t) => t.type === 'uses' && typeof t.amount === 'number')
  if (usesTrait && typeof usesTrait.amount === 'number') return usesTrait.amount
  return null
}

type ActionUsesMetadata = {
  actionUses?: Record<string, number>
}

/**
 * Parse entity ref metadata into typed structure.
 */
function parseMetadata(metadata: Json | null): ActionUsesMetadata {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return {}
  return metadata as ActionUsesMetadata
}

/**
 * Get remaining uses for a specific action from ref metadata.
 * Returns null if uses aren't being tracked yet (= full uses available).
 */
export function getRemainingUses(actionName: string, refMetadata: Json | null): number | null {
  const parsed = parseMetadata(refMetadata)
  if (!parsed.actionUses) return null
  const remaining = parsed.actionUses[actionName]
  return typeof remaining === 'number' ? remaining : null
}

/**
 * Compute new metadata JSON after decrementing one use of an action.
 * Preserves other metadata keys. Lazy-inits from maxUses if not tracked yet.
 */
export function decrementActionUses(
  actionName: string,
  maxUses: number,
  currentMetadata: Json | null
): Json {
  const parsed = parseMetadata(currentMetadata)
  const currentUses = parsed.actionUses?.[actionName]
  const remaining = typeof currentUses === 'number' ? currentUses : maxUses

  return {
    ...parsed,
    actionUses: {
      ...parsed.actionUses,
      [actionName]: Math.max(0, remaining - 1),
    },
  } as unknown as Json
}

type DisabledReasonOptions = {
  action: SURefMetaAction
  pilot: PilotRow
  pilotTraits: Set<string>
  usesRemaining: number | null
  maxUses: number | null
}

/**
 * Determine why an action can't be used, or null if it can.
 * Checks in order: required traits → AP → uses.
 */
export function getActionDisabledReason(opts: DisabledReasonOptions): string | null {
  const { action, pilot, pilotTraits, usesRemaining, maxUses } = opts

  // Check required traits
  const required = getRequiredTraits(action)
  for (const trait of required) {
    if (!pilotTraits.has(trait.toLowerCase())) {
      const displayName = trait.charAt(0).toUpperCase() + trait.slice(1)
      return `Requires trait: ${displayName}`
    }
  }

  // Check AP cost
  const cost = getActionActivationCost(action)
  if (cost !== null && pilot.ap < cost) {
    return 'Not enough AP'
  }

  // Check uses
  const effectiveRemaining = usesRemaining ?? maxUses
  if (effectiveRemaining !== null && effectiveRemaining <= 0) {
    return 'Out of uses'
  }

  return null
}

/**
 * Collect all trait types that a pilot "has" via their entity refs.
 * Iterates pilot equipment/ability refs, resolves each entity,
 * and collects trait types from all their traits arrays.
 */
export function getPilotTraits(refs: EntityRefRow[]): Set<string> {
  const traitSet = new Set<string>()

  for (const ref of refs) {
    const schemaName = ref.schema_name as SURefEnumSchemaName
    const entity = SalvageUnionReference.get(schemaName, ref.schema_ref_id) as
      | SURefEntity
      | undefined
    if (!entity) continue

    // Collect traits from entity's traits array
    if ('traits' in entity && Array.isArray(entity.traits)) {
      for (const trait of entity.traits) {
        if (
          trait &&
          typeof trait === 'object' &&
          'type' in trait &&
          typeof trait.type === 'string'
        ) {
          traitSet.add(trait.type.toLowerCase())
        }
      }
    }

    // Also collect traits from the entity's actions
    const actions = extractVisibleActions(entity)
    if (actions) {
      for (const action of actions) {
        if (action.traits && Array.isArray(action.traits)) {
          for (const trait of action.traits) {
            if (trait && typeof trait.type === 'string') {
              traitSet.add(trait.type.toLowerCase())
            }
          }
        }
      }
    }
  }

  return traitSet
}
