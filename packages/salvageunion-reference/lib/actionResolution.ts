/**
 * Action resolution: the cached name → action map, and every getter whose
 * answer may come from an entity's SELF-ACTION rather than the entity itself.
 *
 * The dataset stores an entity's actions as NAMES; the combat facets
 * (actionType / range / damage) and the trait and choice payloads live on the
 * resolved action, not on the entity. Every
 * function here therefore has a resolution step — which is exactly what
 * separates it from the plain readers in `entityFields.ts`.
 *
 * The package barrel (`lib/index.ts`) re-exports, by name, only what
 * consumers import.
 */

import { getGrants } from './entityFields'
import { getModel } from './helpers'
import { getDataMaps } from './ModelFactory'
import type {
  RefEntity,
  RefMetaAction,
  RefMetaEntity,
  RefObjectAnyPattern,
  RefObjectChoice,
  RefObjectSystemModule,
  RefObjectTrait,
} from './schemas/index'

// Cached action map - built once since action data is static
let _actionMap: Map<string, RefMetaAction> | null = null
function getActionMap(): Map<string, RefMetaAction> {
  if (_actionMap) return _actionMap
  const { dataMap } = getDataMaps()
  const actionsData = dataMap.actions as RefMetaAction[] | undefined
  if (!actionsData) return new Map()
  _actionMap = new Map(actionsData.map((a) => [a.name, a]))
  return _actionMap
}

/** Clear the cached action map so the next lookup reads fresh data. Called by `preload()`. */

export function invalidateActionMap(): void {
  _actionMap = null
}

/**
 * Extract actions from an entity
 * Resolves action names to full action objects from actions schema
 * @param entity - The entity to extract from
 * @returns The actions array or undefined
 */

export function extractActions(entity: RefMetaEntity): RefMetaAction[] | undefined {
  return extractActionsFromCarrier(entity)
}

/**
 * Internal widened form of {@link extractActions}: also accepts a bare
 * `RefObjectSystemModule` or a Bio-Titan pattern (`actions` carriers that are
 * not themselves entities), so those callers don't need an entity assertion.
 */
function extractActionsFromCarrier(
  entity: RefMetaEntity | RefObjectSystemModule | RefObjectAnyPattern
): RefMetaAction[] | undefined {
  if (!('actions' in entity) || !Array.isArray(entity.actions)) {
    return undefined
  }

  const actionNames = entity.actions

  const actionMap = getActionMap()
  if (actionMap.size === 0) {
    console.warn('actions schema not found')
    return undefined
  }

  // Resolve each action name to its object
  const resolved: RefMetaAction[] = []
  for (const actionName of actionNames) {
    if (typeof actionName !== 'string') {
      console.warn(`Invalid action: expected string, got ${typeof actionName}`)
      continue
    }
    const action = actionMap.get(actionName)
    if (action) {
      resolved.push(action)
    } else {
      console.warn(`Action "${actionName}" not found in actions schema`)
    }
  }

  return resolved.length > 0 ? resolved : undefined
}

/**
 * The visible actions a pattern ADDS to its host — a Bio-Titan pattern's
 * `actions`, resolved. A mech pattern adds none (its difference is its
 * systems and modules), so it resolves to an empty list.
 */

export function extractPatternActions(pattern: RefObjectAnyPattern): RefMetaAction[] {
  if (!('actions' in pattern)) return []
  return (extractActionsFromCarrier(pattern) ?? []).filter((action) => !action.hidden)
}

/**
 * Find action with name matching entity name
 * Used to determine if action stats should be extracted into entity header
 *
 * `displayName` counts as the action's name here, because it IS the name the
 * action renders under (see `getReferenceEntityName`). The dataset uniquifies
 * same-named actions from different sources with a parenthetical suffix —
 * `Bio-Rifle (Equipment)` vs `Bio-Rifle (Chimerium Chosen)` — and keeps the real
 * name in `displayName`; that suffix is an internal identifier, not a claim that
 * the action is something other than its entity. Matched as EITHER field rather
 * than `displayName ?? name` so the check is strictly additive.
 *
 * Kept in step with `foldedActionOf` (`lib/view/parts/children.ts`), which
 * decides the same question for the entity model and the card.
 *
 * @param entity - The entity to check
 * @returns The matching action or undefined
 */
function findMatchingAction(entity: RefMetaEntity): RefMetaAction | undefined {
  if (!('name' in entity) || typeof entity.name !== 'string') {
    return undefined
  }

  const entityName = entity.name
  const visibleActions = extractVisibleActions(entity)

  if (!visibleActions || visibleActions.length === 0) {
    return undefined
  }

  return visibleActions.find(
    (action) => action.name === entityName || action.displayName === entityName
  )
}

/**
 * Extract visible (non-hidden) actions from an entity
 * @param entity - The entity to extract from
 * @returns The visible actions array or undefined
 */

export function extractVisibleActions(entity: RefMetaEntity): RefMetaAction[] | undefined {
  const actions = extractActions(entity)
  if (!actions) return undefined
  return actions.filter((action) => !action.hidden)
}

/**
 * Extract chassis abilities from a chassis
 * Resolves ability names to full ability objects from actions schema
 * @param entity - The entity to extract from
 * @returns The chassis abilities array or undefined
 */

export function getChassisAbilities(entity: RefMetaEntity): RefMetaAction[] | undefined {
  if (!('chassisAbilities' in entity) || !Array.isArray(entity.chassisAbilities)) {
    return undefined
  }

  const chassisAbilities = entity.chassisAbilities

  const abilityMap = getActionMap()
  if (abilityMap.size === 0) {
    console.warn('actions schema not found')
    return undefined
  }

  // Resolve each ability name to its object
  // Use a Set to track IDs to prevent duplicates (in case same ability is referenced multiple times)
  const seenIds = new Set<string>()
  const resolved: RefMetaAction[] = []
  for (const abilityName of chassisAbilities) {
    if (typeof abilityName !== 'string') {
      console.warn(`Invalid chassis ability: expected string, got ${typeof abilityName}`)
      continue
    }
    const ability = abilityMap.get(abilityName)
    if (ability) {
      // Skip if we've already added this ability (duplicate reference)
      if (ability.id && seenIds.has(ability.id)) {
        continue
      }
      if (ability.id) {
        seenIds.add(ability.id)
      }
      resolved.push(ability)
    } else {
      console.warn(`Chassis ability "${abilityName}" not found in actions schema`)
    }
  }

  return resolved.length > 0 ? resolved : undefined
}

// ============================================================================
// SELF-ACTION FACET GETTERS
// ============================================================================

/**
 * Resolve a facet field from an entity, falling back to its self-action.
 * The combat facets (activationCost/actionType/range/damage) live only on
 * actions in the data; the entity-level view is derived here. One helper
 * replaces four byte-identical getters (each of whose entity-first branch is
 * dead for every entity in the repo — kept only for a raw action passed in).
 */
function selfActionField<T>(
  entity: RefMetaEntity,
  key: string,
  valid: (v: unknown) => v is T
): T | undefined {
  const ev = (entity as Record<string, unknown>)[key]
  if (key in entity && valid(ev)) {
    return ev
  }
  const matchingAction = findMatchingAction(entity)
  if (matchingAction && typeof matchingAction === 'object') {
    const av = (matchingAction as Record<string, unknown>)[key]
    if (key in matchingAction && valid(av)) {
      return av
    }
  }
  return undefined
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isStringArray = (v: unknown): v is string[] => Array.isArray(v)
type DamageValue = { damageType: string; amount: number | string }
const isDamage = (v: unknown): v is DamageValue => v !== null && typeof v === 'object'

/**
 * Get action type from an entity (self-action fallback).
 */

export function getActionType(entity: RefMetaEntity): string | undefined {
  return selfActionField(entity, 'actionType', isString)
}

/**
 * Get range from an entity (self-action fallback).
 */

export function getRange(entity: RefMetaEntity): string[] | undefined {
  return selfActionField(entity, 'range', isStringArray)
}

/**
 * Get damage from an entity (self-action fallback).
 */

export function getDamage(entity: RefMetaEntity): DamageValue | undefined {
  return selfActionField(entity, 'damage', isDamage)
}

/**
 * Get traits from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract traits from
 * @returns The traits array or undefined if not present
 */

export function getTraits(entity: RefMetaEntity): RefObjectTrait[] | undefined {
  // Check base level first
  if ('traits' in entity && Array.isArray(entity.traits)) {
    return entity.traits
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'traits' in matchingAction &&
    Array.isArray(matchingAction.traits)
  ) {
    return matchingAction.traits
  }

  return undefined
}

/**
 * Get choices from an entity
 * Checks action choices first (if action name matches entity name), then root-level choices
 * If both base entity and a granted entity have actions with the same name, action choices
 * are filtered out (handled by grantable UI) but root-level choices are still returned
 * @param entity - The entity to extract choices from
 * @returns The choices array or undefined if not present
 */

export function getChoices(entity: RefMetaEntity): RefObjectChoice[] | undefined {
  // Check if entity has an action with matching name that has choices - use those first
  const matchingAction = findMatchingAction(entity)
  const hasMatchingActionWithChoices =
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'choices' in matchingAction &&
    Array.isArray(matchingAction.choices)

  // Check if we should filter out action choices due to duplicate action names in grants
  let shouldFilterActionChoices = false
  if (
    hasMatchingActionWithChoices &&
    matchingAction &&
    'name' in entity &&
    typeof entity.name === 'string'
  ) {
    const entityName = entity.name
    const grants = getGrants(entity)

    if (grants && grants.length > 0) {
      // Check each grant to see if granted entity has an action with the same name
      for (const grant of grants) {
        // Skip 'choice' schema grants as they're handled separately
        if (grant.schema === 'choice') {
          continue
        }

        const model = getModel(grant.schema.toLowerCase())
        if (!model) continue

        // O(1) via the model's name index (was a linear scan per grant).
        const grantedEntity: RefEntity | undefined = model.getByName(grant.name)
        if (!grantedEntity) continue

        // Check if granted entity has an action with the same name as the base entity
        const grantedMatchingAction = findMatchingAction(grantedEntity)
        if (
          grantedMatchingAction !== undefined &&
          grantedMatchingAction !== null &&
          typeof grantedMatchingAction === 'object' &&
          grantedMatchingAction.name === entityName
        ) {
          // Both base entity and granted entity have actions with the same name
          // Filter out action choices (they'll be handled by grantable UI)
          shouldFilterActionChoices = true
          break
        }
      }
    }
  }

  // If we have matching action choices and shouldn't filter them, return them
  if (hasMatchingActionWithChoices && !shouldFilterActionChoices) {
    return matchingAction.choices
  }

  // Fall back to root-level choices (always return these, even if action choices were filtered)
  if ('choices' in entity && Array.isArray(entity.choices)) {
    return entity.choices
  }

  return undefined
}
