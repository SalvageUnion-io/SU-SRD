/**
 * Utility functions for Salvage Union entities
 * Type guards and property extractors
 */

import type {
  SURefMetaEntity,
  SURefMetaAction,
  SURefObjectGrant,
  SURefEntity,
  SURefEnumSchemaName,
  SURefObjectSystemModule,
  SURefObjectTable,
  SURefObjectTrait,
  SURefObjectChoice,
  SURefObjectActionOptions,
} from './types/index.js'
import type {
  SURefAbility,
  SURefBioTitan,
  SURefChassis,
  SURefClass,
  SURefCrawler,
  SURefCrawlerBay,
  SURefCreature,
  SURefDistance,
  SURefDrone,
  SURefEquipment,
  SURefFaction,
  SURefKeyword,
  SURefMeld,
  SURefModule,
  SURefNPC,
  SURefRollTable,
  SURefSquad,
  SURefSystem,
  SURefTrait,
  SURefVehicle,
  SURefMetaAbilityTreeRequirement,
  SURefMetaCrawlerTechLevel,
  SURefObjectAdvancedClass,
  SURefObjectBonusPerTechLevel,
  SURefObjectFormationMech,
  SURefObjectNpc,
  SURefObjectPattern,
} from './types/index.js'
import { getDataMaps } from './ModelFactory.js'
import { getModel } from './helpers.js'

// ============================================================================
// TYPE UTILITIES
// ============================================================================

/**
 * Get all possible keys from a union type
 */
type AllKeys<T> = T extends unknown ? keyof T : never

/**
 * All possible property keys across all SURefMetaEntity types
 */
type SURefMetaEntityKeys = AllKeys<SURefMetaEntity>

/**
 * Get the type of a property across all types in the union
 * Returns the union of all possible types for that property
 */
type PropertyType<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never

// ============================================================================
// PROPERTY EXTRACTORS
// ============================================================================

/**
 * Type-safe property extractor for SURefMetaEntity
 * @param entity - The entity to extract from
 * @param propertyName - The property name to extract
 * @returns The property value or undefined if not present
 */
export function extractProperty<K extends SURefMetaEntityKeys>(
  entity: SURefMetaEntity,
  propertyName: K
): PropertyType<SURefMetaEntity, K> | undefined {
  if (entity !== null && typeof entity === 'object' && propertyName in entity) {
    return (entity as unknown as Record<string, unknown>)[propertyName as string] as PropertyType<
      SURefMetaEntity,
      K
    >
  }
  return undefined
}

/**
 * Extract tech level from an entity
 * @param entity - The entity to extract from
 * @returns The tech level (number, 'B', 'N') or undefined
 */
export function getTechLevel(entity: SURefMetaEntity): number | 'B' | 'N' | undefined {
  if ('techLevel' in entity) {
    const techLevel = entity.techLevel
    if (typeof techLevel === 'number' || techLevel === 'B' || techLevel === 'N') {
      return techLevel
    }
  }
  return undefined
}

/**
 * Extract tech level from an entity as a numeric value
 * Normalizes 'B' and 'N' to 1 for math operations
 * @param entity - The entity to extract from
 * @returns The tech level as a number or undefined
 */
export function getTechLevelNumber(entity: SURefMetaEntity): number | undefined {
  if ('techLevel' in entity) {
    const techLevel = entity.techLevel
    if (typeof techLevel === 'number') {
      return techLevel
    }
    if (techLevel === 'B' || techLevel === 'N') {
      return 1
    }
  }
  return undefined
}

/**
 * Extract salvage value from an entity
 * @param entity - The entity to extract from
 * @returns The salvage value or undefined
 */
export function getSalvageValue(entity: SURefMetaEntity): number | undefined {
  return 'salvageValue' in entity && typeof entity.salvageValue === 'number'
    ? entity.salvageValue
    : undefined
}

/**
 * Extract slots required from an entity
 * @param entity - The entity to extract from
 * @returns The slots required or undefined
 */
export function getSlotsRequired(entity: SURefMetaEntity): number | undefined {
  return 'slotsRequired' in entity && typeof entity.slotsRequired === 'number'
    ? entity.slotsRequired
    : undefined
}

/**
 * Extract required slots from an entity (alias for getSlotsRequired)
 * @param entity - The entity to extract from
 * @returns The required slots or undefined
 */
export function getRequiredSlots(entity: SURefMetaEntity): number | undefined {
  return getSlotsRequired(entity)
}

/**
 * Extract page reference from an entity
 * @param entity - The entity to extract from
 * @returns The page number or undefined
 */
export function getPageReference(entity: SURefMetaEntity): number | undefined {
  return 'page' in entity && typeof entity.page === 'number' ? entity.page : undefined
}

/**
 * Extract actions from an entity
 * Resolves action names to full action objects from actions schema
 * @param entity - The entity to extract from
 * @returns The actions array or undefined
 */
export function extractActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined {
  if (!('actions' in entity) || !Array.isArray(entity.actions)) {
    return undefined
  }

  const actionNames = entity.actions as string[]

  // Resolve each action name to its full action object from actions schema
  const { dataMap } = getDataMaps()
  const actionsData = dataMap['actions'] as SURefMetaAction[] | undefined

  if (!actionsData) {
    console.warn('actions schema not found')
    return undefined
  }

  // Create a map of action name to action object
  const actionMap = new Map<string, SURefMetaAction>()
  actionsData.forEach((action) => {
    actionMap.set(action.name, action)
  })

  // Resolve each action name to its object
  const resolved: SURefMetaAction[] = []
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
 * Find action with name matching entity name
 * Used to determine if action stats should be extracted into entity header
 * @param entity - The entity to check
 * @returns The matching action or undefined
 */
function findMatchingAction(entity: SURefMetaEntity): SURefMetaAction | undefined {
  if (!('name' in entity) || typeof entity.name !== 'string') {
    return undefined
  }

  const entityName = entity.name
  const visibleActions = extractVisibleActions(entity)

  if (!visibleActions || visibleActions.length === 0) {
    return undefined
  }

  return visibleActions.find((action) => action.name === entityName)
}

/**
 * Extract visible (non-hidden) actions from an entity
 * @param entity - The entity to extract from
 * @returns The visible actions array or undefined
 */
export function extractVisibleActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined {
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
export function getChassisAbilities(entity: SURefMetaEntity): SURefMetaAction[] | undefined {
  if (!('chassisAbilities' in entity) || !Array.isArray(entity.chassisAbilities)) {
    return undefined
  }

  const chassisAbilities = entity.chassisAbilities

  // Chassis abilities are now stored as an array of ability names (strings)
  // Resolve each name to its full ability object from the actions schema
  const { dataMap } = getDataMaps()
  const actionsData = dataMap['actions'] as SURefMetaAction[] | undefined

  if (!actionsData) {
    console.warn('actions schema not found')
    return undefined
  }

  // Create a map of ability name to ability object
  const abilityMap = new Map<string, SURefMetaAction>()
  actionsData.forEach((ability) => {
    abilityMap.set(ability.name, ability)
  })

  // Resolve each ability name to its object
  // Use a Set to track IDs to prevent duplicates (in case same ability is referenced multiple times)
  const seenIds = new Set<string>()
  const resolved: SURefMetaAction[] = []
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

/**
 * Extract structure points from an entity
 * @param entity - The entity to extract from
 * @returns The structure points or undefined
 */
export function getStructurePoints(entity: SURefMetaEntity): number | undefined {
  return 'structurePoints' in entity && typeof entity.structurePoints === 'number'
    ? entity.structurePoints
    : undefined
}

/**
 * Extract energy points from an entity
 * @param entity - The entity to extract from
 * @returns The energy points or undefined
 */
export function getEnergyPoints(entity: SURefMetaEntity): number | undefined {
  return 'energyPoints' in entity && typeof entity.energyPoints === 'number'
    ? entity.energyPoints
    : undefined
}

/**
 * Extract heat capacity from an entity
 * @param entity - The entity to extract from
 * @returns The heat capacity or undefined
 */
export function getHeatCapacity(entity: SURefMetaEntity): number | undefined {
  return 'heatCapacity' in entity && typeof entity.heatCapacity === 'number'
    ? entity.heatCapacity
    : undefined
}

/**
 * Extract system slots from an entity
 * @param entity - The entity to extract from
 * @returns The number of system slots or undefined
 */
export function getSystemSlots(entity: SURefMetaEntity): number | undefined {
  return 'systemSlots' in entity && typeof entity.systemSlots === 'number'
    ? entity.systemSlots
    : undefined
}

/**
 * Extract module slots from an entity
 * @param entity - The entity to extract from
 * @returns The number of module slots or undefined
 */
export function getModuleSlots(entity: SURefMetaEntity): number | undefined {
  return 'moduleSlots' in entity && typeof entity.moduleSlots === 'number'
    ? entity.moduleSlots
    : undefined
}

/**
 * Extract cargo capacity from an entity
 * @param entity - The entity to extract from
 * @returns The cargo capacity or undefined
 */
export function getCargoCapacity(entity: SURefMetaEntity): number | undefined {
  return 'cargoCapacity' in entity && typeof entity.cargoCapacity === 'number'
    ? entity.cargoCapacity
    : undefined
}

/**
 * Extract hit points from an entity
 * Used for NPCs, Creatures, Squads, and Meld
 * @param entity - The entity to extract from
 * @returns The hit points or undefined
 */
export function getHitPoints(entity: SURefMetaEntity): number | undefined {
  return 'hitPoints' in entity && typeof entity.hitPoints === 'number'
    ? entity.hitPoints
    : undefined
}

/**
 * Extract asset URL from an entity
 * @param entity - The entity to extract from
 * @returns The asset URL or undefined
 */
export function getAssetUrl(entity: SURefMetaEntity): string | undefined {
  return 'asset_url' in entity && typeof entity.asset_url === 'string'
    ? entity.asset_url
    : undefined
}

/**
 * Extract blackMarket flag from an entity
 * @param entity - The entity to extract from
 * @returns True if the entity is from the Black Market, false if not, undefined if not present
 */
export function getBlackMarket(entity: SURefMetaEntity): boolean | undefined {
  return 'blackMarket' in entity && typeof entity.blackMarket === 'boolean'
    ? entity.blackMarket
    : undefined
}

// ============================================================================
// ADDITIONAL PROPERTY EXTRACTORS
// ============================================================================

/**
 * Extract asset_url from an entity
 * @param entity - The entity to extract from
 * @returns The asset_url or undefined
 */
export function getAsset_url(entity: SURefMetaEntity): string | undefined {
  return 'asset_url' in entity && typeof entity.asset_url === 'string'
    ? entity.asset_url
    : undefined
}

/**
 * Extract content from an entity
 * @param entity - The entity to extract from
 * @returns The content or undefined
 */
export function getContent(entity: SURefMetaEntity): unknown | undefined {
  return 'content' in entity ? entity.content : undefined
}

/**
 * Extract id from an entity
 * @param entity - The entity to extract from
 * @returns The id or undefined
 */
export function getId(entity: SURefMetaEntity): string | undefined {
  return 'id' in entity && typeof entity.id === 'string' ? entity.id : undefined
}

/**
 * Extract indexable from an entity
 * @param entity - The entity to extract from
 * @returns The indexable or undefined
 */
export function getIndexable(entity: SURefMetaEntity): boolean | undefined {
  return 'indexable' in entity && typeof entity.indexable === 'boolean'
    ? entity.indexable
    : undefined
}

/**
 * Extract name from an entity
 * @param entity - The entity to extract from
 * @returns The name or undefined
 */
export function getName(entity: SURefMetaEntity): string | undefined {
  return 'name' in entity && typeof entity.name === 'string' ? entity.name : undefined
}

/**
 * Extract source from an entity
 * @param entity - The entity to extract from
 * @returns The source or undefined
 */
export function getSource(entity: SURefMetaEntity): unknown | undefined {
  return 'source' in entity ? entity.source : undefined
}

/**
 * Extract page from an entity
 * @param entity - The entity to extract from
 * @returns The page or undefined
 */
export function getPage(entity: SURefMetaEntity): number | undefined {
  return 'page' in entity && typeof entity.page === 'number' ? entity.page : undefined
}

/**
 * Extract actions from an entity
 * Note: This function returns the raw string array. Use extractActions() to get resolved action objects.
 * @param entity - The entity to extract from
 * @returns The actions or undefined
 */
export function getActions(entity: SURefMetaEntity): unknown | undefined {
  return 'actions' in entity ? entity.actions : undefined
}

/**
 * Extract npc from an entity
 * @param entity - The entity to extract from
 * @returns The npc or undefined
 */
export function getNpc(entity: SURefMetaEntity): SURefObjectNpc | undefined {
  return 'npc' in entity &&
    entity.npc !== null &&
    typeof entity.npc === 'object' &&
    !Array.isArray(entity.npc)
    ? entity.npc
    : undefined
}

/**
 * Extract systems from an entity
 * @param entity - The entity to extract from
 * @returns The systems or undefined
 */
export function getSystems(entity: SURefMetaEntity): unknown | undefined {
  return 'systems' in entity ? entity.systems : undefined
}

/**
 * Extract tree from an entity
 * @param entity - The entity to extract from
 * @returns The tree or undefined
 */
export function getTree(entity: SURefMetaEntity): unknown | undefined {
  return 'tree' in entity ? entity.tree : undefined
}

/**
 * Extract level from an entity
 * @param entity - The entity to extract from
 * @returns The level or undefined
 */
export function getLevel(entity: SURefMetaEntity): unknown | undefined {
  return 'level' in entity ? entity.level : undefined
}

/**
 * Extract mechActionType from an entity
 * @param entity - The entity to extract from
 * @returns The mechActionType or undefined
 */
export function getMechActionType(entity: SURefMetaEntity): unknown | undefined {
  return 'mechActionType' in entity ? entity.mechActionType : undefined
}

/**
 * Extract activationCurrency from an entity
 * @param entity - The entity to extract from
 * @returns The activationCurrency or undefined
 */
export function getActivationCurrency(entity: SURefMetaEntity): string | undefined {
  return 'activationCurrency' in entity && typeof entity.activationCurrency === 'string'
    ? entity.activationCurrency
    : undefined
}

/**
 * Extract requirement from an entity
 * @param entity - The entity to extract from
 * @returns The requirement or undefined
 */
export function getRequirement(entity: SURefMetaEntity): string[] | undefined {
  return 'requirement' in entity && Array.isArray(entity.requirement)
    ? (entity.requirement as string[])
    : undefined
}

/**
 * Extract patterns from an entity
 * @param entity - The entity to extract from
 * @returns The patterns or undefined
 */
export function getPatterns(entity: SURefMetaEntity): SURefObjectPattern[] | undefined {
  return 'patterns' in entity && Array.isArray(entity.patterns) ? entity.patterns : undefined
}

/**
 * Extract damagedEffect from an entity
 * @param entity - The entity to extract from
 * @returns The damagedEffect or undefined
 */
export function getDamagedEffect(entity: SURefMetaEntity): string | undefined {
  return 'damagedEffect' in entity && typeof entity.damagedEffect === 'string'
    ? entity.damagedEffect
    : undefined
}

/**
 * Extract populationMin from an entity
 * @param entity - The entity to extract from
 * @returns The populationMin or undefined
 */
export function getPopulationMin(entity: SURefMetaEntity): number | undefined {
  return 'populationMin' in entity && typeof entity.populationMin === 'number'
    ? entity.populationMin
    : undefined
}

/**
 * Extract populationMax from an entity
 * @param entity - The entity to extract from
 * @returns The populationMax or undefined
 */
export function getPopulationMax(entity: SURefMetaEntity): number | undefined {
  return 'populationMax' in entity && typeof entity.populationMax === 'number'
    ? entity.populationMax
    : undefined
}

/**
 * Extract bonusPerTechLevel from an entity
 * @param entity - The entity to extract from
 * @returns The bonusPerTechLevel or undefined
 */
export function getBonusPerTechLevel(
  entity: SURefMetaEntity
): SURefObjectBonusPerTechLevel | undefined {
  return 'bonusPerTechLevel' in entity &&
    entity.bonusPerTechLevel !== null &&
    typeof entity.bonusPerTechLevel === 'object' &&
    !Array.isArray(entity.bonusPerTechLevel)
    ? entity.bonusPerTechLevel
    : undefined
}

/**
 * Extract goals from an entity
 * @param entity - The entity to extract from
 * @returns The goals or undefined
 */
export function getGoals(entity: SURefMetaEntity): string | undefined {
  return 'goals' in entity && typeof entity.goals === 'string' ? entity.goals : undefined
}

/**
 * Extract assets from an entity
 * @param entity - The entity to extract from
 * @returns The assets or undefined
 */
export function getAssets(entity: SURefMetaEntity): string | undefined {
  return 'assets' in entity && typeof entity.assets === 'string' ? entity.assets : undefined
}

/**
 * Extract weaknesses from an entity
 * @param entity - The entity to extract from
 * @returns The weaknesses or undefined
 */
export function getWeaknesses(entity: SURefMetaEntity): string | undefined {
  return 'weaknesses' in entity && typeof entity.weaknesses === 'string'
    ? entity.weaknesses
    : undefined
}

/**
 * Extract formation from an entity
 * @param entity - The entity to extract from
 * @returns The formation or undefined
 */
export function getFormation(entity: SURefMetaEntity): SURefObjectFormationMech[] | undefined {
  return 'formation' in entity && Array.isArray(entity.formation) ? entity.formation : undefined
}

/**
 * Extract bioSalvageValue from an entity
 * @param entity - The entity to extract from
 * @returns The bioSalvageValue or undefined
 */
export function getBioSalvageValue(entity: SURefMetaEntity): number | undefined {
  return 'bioSalvageValue' in entity && typeof entity.bioSalvageValue === 'number'
    ? entity.bioSalvageValue
    : undefined
}

/**
 * Extract section from an entity
 * @param entity - The entity to extract from
 * @returns The section or undefined
 */
export function getSection(entity: SURefMetaEntity): string | undefined {
  return 'section' in entity && typeof entity.section === 'string' ? entity.section : undefined
}

/**
 * Extract damageType from an entity
 * @param entity - The entity to extract from
 * @returns The damageType or undefined
 */
export function getDamageType(entity: SURefMetaEntity): unknown | undefined {
  return 'damageType' in entity ? entity.damageType : undefined
}

// ============================================================================
// TYPE GUARDS - Property-based
// ============================================================================

/**
 * Type guard to check if an entity has a techLevel property
 * @param entity - The entity to check
 * @returns True if the entity has a techLevel property
 */
export function hasTechLevel(
  entity: SURefMetaEntity
): entity is SURefMetaEntity & { techLevel: number | 'B' | 'N' } {
  return (
    'techLevel' in entity &&
    (typeof entity.techLevel === 'number' || entity.techLevel === 'B' || entity.techLevel === 'N')
  )
}

/**
 * Type guard to check if an entity has a salvageValue property
 * @param entity - The entity to check
 * @returns True if the entity has a salvageValue property
 */
export function hasSalvageValue(
  entity: SURefMetaEntity
): entity is SURefMetaEntity & { salvageValue: number } {
  return 'salvageValue' in entity && typeof entity.salvageValue === 'number'
}

/**
 * Type guard to check if an entity has a slotsRequired property
 * @param entity - The entity to check
 * @returns True if the entity has a slotsRequired property
 */
export function hasSlotsRequired(
  entity: SURefMetaEntity
): entity is SURefMetaEntity & { slotsRequired: number } {
  return 'slotsRequired' in entity && typeof entity.slotsRequired === 'number'
}

/**
 * Type guard to check if an entity has actions
 * @param entity - The entity to check
 * @returns True if the entity has an actions array
 */
export function hasActions(
  entity: SURefMetaEntity
): entity is SURefMetaEntity & { actions: string[] } {
  return 'actions' in entity && Array.isArray(entity.actions)
}

/**
 * Type guard to check if an entity has traits
 * @param entity - The entity to check
 * @returns True if the entity has a traits property (either at base level or in action property)
 */
export function hasTraits(
  entity: SURefMetaEntity
): entity is SURefMetaEntity & { traits?: unknown[] } {
  // Check if traits exists at base level
  const hasBaseTraits =
    'traits' in entity && (entity.traits === undefined || Array.isArray(entity.traits))

  // Check if traits exists in actions[0] property
  // Check resolved actions[0] property (actions are now strings, need to resolve)
  const resolvedActions = extractActions(entity)
  const hasActionTraits = Boolean(
    resolvedActions &&
      resolvedActions.length > 0 &&
      resolvedActions[0] !== null &&
      typeof resolvedActions[0] === 'object' &&
      'traits' in resolvedActions[0] &&
      (resolvedActions[0].traits === undefined || Array.isArray(resolvedActions[0].traits))
  )

  return hasBaseTraits || hasActionTraits
}

// ============================================================================
// TYPE GUARDS - Schema-specific
// ============================================================================

/**
 * Type guard to check if an entity is an Ability
 * @param entity - The entity to check
 * @returns True if the entity is an Ability
 */
export function isAbility(entity: SURefMetaEntity): entity is SURefAbility {
  return entity !== null && typeof entity === 'object' && 'tree' in entity && 'level' in entity
}

/**
 * Type guard to check if an entity is a AbilityTreeRequirement
 * @param entity - The entity to check
 * @returns True if the entity is a AbilityTreeRequirement
 */
export function isAbilityTreeRequirement(
  entity: SURefMetaEntity
): entity is SURefMetaAbilityTreeRequirement {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'requirement' in entity
  )
}

/**
 * Type guard to check if an entity is a BioTitan
 * @param entity - The entity to check
 * @returns True if the entity is a BioTitan
 */
export function isBioTitan(entity: SURefMetaEntity): entity is SURefBioTitan {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'structurePoints' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a System
 * Note: Systems and Modules share the same schema, so this checks for
 * the presence of required system/module properties
 * @param entity - The entity to check
 * @returns True if the entity is a System
 */
export function isSystem(entity: SURefMetaEntity): entity is SURefSystem {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'techLevel' in entity &&
    'salvageValue' in entity &&
    'slotsRequired' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a Module
 * Note: Systems and Modules share the same schema, so this checks for
 * the presence of required system/module properties
 * @param entity - The entity to check
 * @returns True if the entity is a Module
 */
export function isModule(entity: SURefMetaEntity): entity is SURefModule {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'techLevel' in entity &&
    'salvageValue' in entity &&
    'slotsRequired' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a Chassis
 * @param entity - The entity to check
 * @returns True if the entity is a Chassis
 */
export function isChassis(entity: SURefMetaEntity): entity is SURefChassis {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'patterns' in entity &&
    'structurePoints' in entity &&
    'energyPoints' in entity &&
    'heatCapacity' in entity
  )
}

/**
 * Type guard to check if an entity is a CrawlerBay
 * @param entity - The entity to check
 * @returns True if the entity is a CrawlerBay
 */
export function isCrawlerBay(entity: SURefMetaEntity): entity is SURefCrawlerBay {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'damagedEffect' in entity &&
    'npc' in entity
  )
}

/**
 * Type guard to check if an entity is a CrawlerTechLevel
 * @param entity - The entity to check
 * @returns True if the entity is a CrawlerTechLevel
 */
export function isCrawlerTechLevel(entity: SURefMetaEntity): entity is SURefMetaCrawlerTechLevel {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'techLevel' in entity &&
    'structurePoints' in entity &&
    'populationMin' in entity &&
    'populationMax' in entity
  )
}

/**
 * Type guard to check if an entity is a Crawler
 * @param entity - The entity to check
 * @returns True if the entity is a Crawler
 */
export function isCrawler(entity: SURefMetaEntity): entity is SURefCrawler {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'npc' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a Creature
 * @param entity - The entity to check
 * @returns True if the entity is a Creature
 */
export function isCreature(entity: SURefMetaEntity): entity is SURefCreature {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'hitPoints' in entity
  )
}

/**
 * Type guard to check if an entity is a Distance
 * @param entity - The entity to check
 * @returns True if the entity is a Distance
 */
export function isDistance(entity: SURefMetaEntity): entity is SURefDistance {
  return 'id' in entity && 'name' in entity && 'source' in entity && 'page' in entity
}

/**
 * Type guard to check if an entity is a Drone
 * @param entity - The entity to check
 * @returns True if the entity is a Drone
 */
export function isDrone(entity: SURefMetaEntity): entity is SURefDrone {
  return 'id' in entity && 'name' in entity && 'source' in entity && 'page' in entity
}

/**
 * Type guard to check if an entity is a Equipment
 * @param entity - The entity to check
 * @returns True if the entity is a Equipment
 */
export function isEquipment(entity: SURefMetaEntity): entity is SURefEquipment {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a Faction
 * @param entity - The entity to check
 * @returns True if the entity is a Faction
 */
export function isFaction(entity: SURefMetaEntity): entity is SURefFaction {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'goals' in entity &&
    'assets' in entity &&
    'weaknesses' in entity
  )
}

/**
 * Type guard to check if an entity is a Keyword
 * @param entity - The entity to check
 * @returns True if the entity is a Keyword
 */
export function isKeyword(entity: SURefMetaEntity): entity is SURefKeyword {
  return 'id' in entity && 'name' in entity && 'source' in entity && 'page' in entity
}

/**
 * Type guard to check if an entity is a Meld
 * @param entity - The entity to check
 * @returns True if the entity is a Meld
 */
export function isMeld(entity: SURefMetaEntity): entity is SURefMeld {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a NPC
 * @param entity - The entity to check
 * @returns True if the entity is a NPC
 */
export function isNPC(entity: SURefMetaEntity): entity is SURefNPC {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'hitPoints' in entity
  )
}

/**
 * Type guard to check if an entity is a RollTable
 * @param entity - The entity to check
 * @returns True if the entity is a RollTable
 */
export function isRollTable(entity: SURefMetaEntity): entity is SURefRollTable {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'section' in entity &&
    'table' in entity
  )
}

/**
 * Type guard to check if an entity is a Squad
 * @param entity - The entity to check
 * @returns True if the entity is a Squad
 */
export function isSquad(entity: SURefMetaEntity): entity is SURefSquad {
  return (
    'id' in entity &&
    'name' in entity &&
    'source' in entity &&
    'page' in entity &&
    'actions' in entity
  )
}

/**
 * Type guard to check if an entity is a Trait
 * @param entity - The entity to check
 * @returns True if the entity is a Trait
 */
export function isTrait(entity: SURefMetaEntity): entity is SURefTrait {
  return 'id' in entity && 'name' in entity && 'source' in entity && 'page' in entity
}

/**
 * Type guard to check if an entity is a Vehicle
 * @param entity - The entity to check
 * @returns True if the entity is a Vehicle
 */
export function isVehicle(entity: SURefMetaEntity): entity is SURefVehicle {
  return 'id' in entity && 'name' in entity && 'source' in entity && 'page' in entity
}

/**
 * Type guard to check if an entity is a Core Class
 * @param entity - The entity to check
 * @returns True if the entity is a Core Class
 */
export function isCoreClass(
  entity: SURefMetaEntity
): entity is SURefClass & { coreTrees: string[] } {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'maxAbilities' in entity &&
    'coreTrees' in entity &&
    'advanceable' in entity
  )
}

/**
 * Type guard to check if an entity is an Advanced Class
 * @param entity - The entity to check
 * @returns True if the entity is an Advanced Class
 */
export function isBaseAdvancedClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass {
  return (
    entity !== null &&
    typeof entity === 'object' &&
    'advancedTree' in entity &&
    !('hybridTree' in entity)
  )
}

/**
 * Type guard to check if an entity is an Advanced Class (base class with advancedTree, not a hybrid)
 * @param entity - The entity to check
 * @returns True if the entity is an Advanced Class
 */
export function isAdvancedClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass {
  return isBaseAdvancedClass(entity) && !('hybrid' in entity && entity.hybrid === true)
}

/**
 * Type guard to check if an entity is a Hybrid Class
 * Note: This is also exported from helpers.ts, but we keep it here for backwards compatibility
 * @param entity - The entity to check
 * @returns True if the entity is a Hybrid Class
 */
export function isHybridClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass {
  return isBaseAdvancedClass(entity) && 'hybrid' in entity && entity.hybrid === true
}

/**
 * Type guard to check if an entity is a class (any type)
 * @param entity - The entity to check
 * @returns True if the entity is a Core, Advanced, or Hybrid class
 */
export function isClass(entity: SURefMetaEntity): entity is SURefClass {
  return isCoreClass(entity) || isAdvancedClass(entity) || isHybridClass(entity)
}

/**
 * Type guard to check if an entity is a System or Module
 * @param entity - The entity to check
 * @returns True if the entity is a System or Module
 */
export function isSystemOrModule(entity: SURefMetaEntity): entity is SURefSystem | SURefModule {
  return isSystem(entity) || isModule(entity)
}

// ============================================================================
// ACTION PROPERTY GETTERS
// ============================================================================

/**
 * Get display name from an entity
 * Falls back to name if displayName is not provided
 * @param entity - The entity to extract display name from
 * @returns The display name or name, or undefined if neither is present
 */
export function getEntityDisplayName(entity: SURefMetaEntity): string | undefined {
  // Check for displayName first (for actions)
  if ('displayName' in entity && typeof entity.displayName === 'string') {
    return entity.displayName
  }

  // Fall back to name
  if ('name' in entity && typeof entity.name === 'string') {
    return entity.name
  }

  return undefined
}

/**
 * Get description from an entity
 * @param entity - The entity to extract description from
 * @returns The description or undefined if not an ability
 */
export function getDescription(entity: SURefMetaEntity): string | undefined {
  // Only return description for abilities
  if ('description' in entity && typeof entity.description === 'string') {
    return entity.description
  }

  return undefined
}

/**
 * Check if an entity is a system module (has actions but no id)
 * System modules are used in custom system options and pattern system modules
 * @param entity - The entity to check
 * @returns True if the entity is a system module
 */
export function isSystemModule(entity: SURefMetaEntity): boolean {
  return 'actions' in entity && !('id' in entity)
}

/**
 * Get entity name from a system module
 * Extracts the name from the first visible action in the system module
 * @param entity - The system module entity
 * @returns The entity name or undefined if not found
 */
export function getEntityNameFromSystemModule(entity: SURefObjectSystemModule): string | undefined {
  const resolvedActions = extractActions(entity as SURefMetaEntity)
  return resolvedActions?.find((a) => !a.hidden)?.name
}

/**
 * Normalize pattern name by removing " Pattern" suffix
 * @param patternName - The pattern name to normalize
 * @returns The normalized pattern name
 */
export function normalizePatternName(patternName: string): string {
  return patternName.replace(/\s+Pattern$/i, '')
}

/**
 * Find an action by name in an entity
 * @param entity - The entity to search
 * @param name - The action name to find
 * @returns The matching action or undefined
 */
export function findActionByName(
  entity: SURefMetaEntity,
  name: string
): SURefMetaAction | undefined {
  const visibleActions = extractVisibleActions(entity)
  if (!visibleActions || visibleActions.length === 0) {
    return undefined
  }
  return visibleActions.find((action) => action.name === name || action.displayName === name)
}

/**
 * Filter actions excluding a specific name
 * Used to filter out actions where the action name matches the entity name
 * @param actions - The actions array to filter
 * @param excludeName - The name to exclude
 * @returns Filtered actions array
 */
export function filterActionsExcludingName(
  actions: SURefMetaAction[],
  excludeName: string
): SURefMetaAction[] {
  return actions.filter(
    (action) => action.displayName !== excludeName && action.name !== excludeName
  )
}

/**
 * Get activation cost from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract activation cost from
 * @returns The activation cost or undefined if not present
 */
export function getActivationCost(entity: SURefMetaEntity): number | string | undefined {
  // Check base level first
  if (
    'activationCost' in entity &&
    (typeof entity.activationCost === 'number' || typeof entity.activationCost === 'string')
  ) {
    return entity.activationCost
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'activationCost' in matchingAction &&
    (typeof matchingAction.activationCost === 'number' ||
      typeof matchingAction.activationCost === 'string')
  ) {
    return matchingAction.activationCost
  }

  return undefined
}

/**
 * Get action type from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract action type from
 * @returns The action type or undefined if not present
 */
export function getActionType(entity: SURefMetaEntity): string | undefined {
  // Check base level first
  if ('actionType' in entity && typeof entity.actionType === 'string') {
    return entity.actionType
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'actionType' in matchingAction &&
    typeof matchingAction.actionType === 'string'
  ) {
    return matchingAction.actionType
  }

  return undefined
}

/**
 * Get range from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract range from
 * @returns The range array or undefined if not present
 */
export function getRange(entity: SURefMetaEntity): string[] | undefined {
  // Check base level first
  if ('range' in entity && Array.isArray(entity.range)) {
    return entity.range
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'range' in matchingAction &&
    Array.isArray(matchingAction.range)
  ) {
    return matchingAction.range
  }

  return undefined
}

/**
 * Get damage from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract damage from
 * @returns The damage object or undefined if not present
 */
export function getDamage(entity: SURefMetaEntity):
  | {
      damageType: string
      amount: number | string
    }
  | undefined {
  // Check base level first
  if ('damage' in entity && entity.damage !== null && typeof entity.damage === 'object') {
    return entity.damage as { damageType: string; amount: number | string }
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'damage' in matchingAction &&
    matchingAction.damage !== null &&
    typeof matchingAction.damage === 'object'
  ) {
    return matchingAction.damage as {
      damageType: string
      amount: number | string
    }
  }

  return undefined
}

/**
 * Get traits from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract traits from
 * @returns The traits array or undefined if not present
 */
export function getTraits(entity: SURefMetaEntity): SURefObjectTrait[] | undefined {
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
 * Get effects from an entity
 * Note: Effects only exist at base level, not in actions
 * @param entity - The entity to extract effects from
 * @returns The effects array or undefined if not present
 */
export function getEffects(entity: SURefMetaEntity):
  | Array<{
      label?: string
      value: string
    }>
  | undefined {
  // Check base level only (effects don't exist in actions)
  if ('effects' in entity && Array.isArray(entity.effects)) {
    return entity.effects
  }

  return undefined
}

/**
 * Get table from an entity
 * Checks base level, nested action property, and tableName references
 * @param entity - The entity to extract table from
 * @returns The table object or undefined if not present
 */
export function getTable(entity: SURefMetaEntity): SURefObjectTable | undefined {
  // Check base level first
  if ('table' in entity && entity.table !== null && typeof entity.table === 'object') {
    return entity.table
  }

  // Check for tableName reference
  if ('tableName' in entity && typeof entity.tableName === 'string') {
    const rollTablesModel = getModel('roll-tables')
    if (rollTablesModel) {
      const rollTable = rollTablesModel.find(
        (rt) => 'name' in rt && rt.name === entity.tableName
      ) as SURefRollTable | undefined
      if (rollTable && rollTable.table) {
        return rollTable.table
      }
    }
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'table' in matchingAction &&
    matchingAction.table !== null &&
    typeof matchingAction.table === 'object'
  ) {
    return matchingAction.table
  }

  // Check for tableName in matching action
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'tableName' in matchingAction &&
    typeof matchingAction.tableName === 'string'
  ) {
    const rollTablesModel = getModel('roll-tables')
    if (rollTablesModel) {
      const rollTable = rollTablesModel.find(
        (rt) => 'name' in rt && rt.name === matchingAction.tableName
      ) as SURefRollTable | undefined
      if (rollTable && rollTable.table) {
        return rollTable.table
      }
    }
  }

  return undefined
}

/**
 * Get options from an entity
 * Checks both base level and nested action property
 * @param entity - The entity to extract options from
 * @returns The options array or undefined if not present
 */
export function getOptions(entity: SURefMetaEntity): SURefObjectActionOptions | undefined {
  // Check base level first
  if ('options' in entity && Array.isArray(entity.options)) {
    return entity.options
  }

  // Check action property (only if action name matches entity name)
  const matchingAction = findMatchingAction(entity)
  if (
    matchingAction !== undefined &&
    matchingAction !== null &&
    typeof matchingAction === 'object' &&
    'options' in matchingAction &&
    Array.isArray(matchingAction.options)
  ) {
    return matchingAction.options
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
export function getChoices(entity: SURefMetaEntity): SURefObjectChoice[] | undefined {
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

        const schema = grant.schema as SURefEnumSchemaName
        const model = getModel(schema.toLowerCase())
        if (!model) continue

        const grantedEntity = model.find((e: SURefEntity) => e.name === grant.name)
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

/**
 * Get grants from an entity
 * @param entity - The entity to extract grants from
 * @returns The grants array or undefined if not present
 */
export function getGrants(entity: SURefMetaEntity): SURefObjectGrant[] | undefined {
  if ('grants' in entity && Array.isArray(entity.grants)) {
    return entity.grants
  }

  return undefined
}

/**
 * Represents a parsed trait reference from text
 */
export interface ParsedTraitReference {
  /** The full matched text including brackets */
  fullMatch: string
  /** The trait name (e.g., "Hot", "Burn", "Explosive") */
  traitName: string
  /** The parameter if present (e.g., "3", "X", "2") */
  parameter?: string
  /** The start index of the match in the original text */
  startIndex: number
  /** The end index of the match in the original text */
  endIndex: number
}

/**
 * Parse trait references from text
 * Handles both simple [[TraitName]] and parameterized [[[TraitName] (param)]] formats
 * @param text - The text to parse for trait references
 * @returns Array of parsed trait references
 *
 * @example
 * const text = "This has the [[Shield]] Trait and [[[Hot] (3)]] Trait"
 * const refs = parseTraitReferences(text)
 * // => [
 * //   { fullMatch: "[[Shield]]", traitName: "Shield", startIndex: 13, endIndex: 23 },
 * //   { fullMatch: "[[[Hot] (3)]]", traitName: "Hot", parameter: "3", startIndex: 35, endIndex: 48 }
 * // ]
 */
export function parseTraitReferences(text: string): ParsedTraitReference[] {
  const references: ParsedTraitReference[] = []

  // Pattern for parameterized traits: [[[TraitName] (param)]]
  const paramPattern = /\[\[\[([A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+)*)\]\s+\(([^)]+)\)\]\]/g

  // Pattern for simple traits: [[TraitName]]
  const simplePattern = /\[\[([A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+)*)\]\]/g

  // Find all parameterized trait references first
  let match: RegExpExecArray | null
  while ((match = paramPattern.exec(text)) !== null) {
    const traitName = match[1]
    const parameter = match[2]
    if (traitName && parameter) {
      references.push({
        fullMatch: match[0],
        traitName,
        parameter,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
  }

  // Find all simple trait references
  while ((match = simplePattern.exec(text)) !== null) {
    // Skip if this position is already covered by a parameterized match
    const isAlreadyMatched = references.some(
      (ref) => match!.index >= ref.startIndex && match!.index < ref.endIndex
    )

    if (!isAlreadyMatched) {
      const traitName = match[1]
      if (traitName) {
        references.push({
          fullMatch: match[0],
          traitName,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        })
      }
    }
  }

  // Sort by start index
  references.sort((a, b) => a.startIndex - b.startIndex)

  return references
}
