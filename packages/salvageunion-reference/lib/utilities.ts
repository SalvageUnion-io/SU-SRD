/**
 * Utility functions for Salvage Union entities
 * Type guards and property extractors
 */

import type {
  SURefMetaEntity,
  SURefMetaAction,
  SURefObjectGrant,
  SURefEntity,
  SURefObjectSystemModule,
  SURefObjectTable,
  SURefObjectTrait,
  SURefObjectChoice,
  SURefObjectActionOptions,
} from './types/index.js'
import type {
  SURefAbility,
  SURefChassis,
  SURefClass,
  SURefKeyword,
  SURefModule,
  SURefSystem,
  SURefObjectAdvancedClass,
  SURefObjectFormationMech,
  SURefObjectNpc,
  SURefObjectPattern,
} from './types/index.js'
import { getDataMaps } from './ModelFactory.js'
import { getModel } from './helpers.js'
import { SalvageUnionReference } from './index.js'
import { getEntitySlug } from './slug.js'

/**
 * Base URL of the Netlify-hosted artwork CDN (the su-assets site, backed by a
 * Netlify Blobs store). Asset URLs are derived from this base plus the entity's
 * schema name and slug — see getAssetUrl().
 */
export const ASSET_BASE_URL = 'https://assets.salvageunion.io'

// Cached action map - built once since action data is static
let _actionMap: Map<string, SURefMetaAction> | null = null
function getActionMap(): Map<string, SURefMetaAction> {
  if (_actionMap) return _actionMap
  const { dataMap } = getDataMaps()
  const actionsData = dataMap.actions as SURefMetaAction[] | undefined
  if (!actionsData) return new Map()
  _actionMap = new Map(actionsData.map((a) => [a.name, a]))
  return _actionMap
}

/** Clear the cached action map so the next lookup reads fresh data. Called by `preload()`. */
export function invalidateActionMap(): void {
  _actionMap = null
}

// ============================================================================
// SHARED ENUM TYPES
// ============================================================================

export type ItemCondition = 'intact' | 'damaged' | 'destroyed'
export type ParentType = 'pilot' | 'mech' | 'crawler'

// ============================================================================
// PROPERTY EXTRACTORS
// ============================================================================

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
  return extractActionsFromCarrier(entity)
}

/**
 * Internal widened form of {@link extractActions}: also accepts a bare
 * `SURefObjectSystemModule` (an `actions` carrier that is not itself an
 * entity), so system-module callers don't need an entity assertion.
 */
function extractActionsFromCarrier(
  entity: SURefMetaEntity | SURefObjectSystemModule
): SURefMetaAction[] | undefined {
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

  const abilityMap = getActionMap()
  if (abilityMap.size === 0) {
    console.warn('actions schema not found')
    return undefined
  }

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
 * Derive an entity's asset URL from its schema name and slug.
 *
 * Artwork is unified on WebP, so the whole URL is inferred:
 * `{ASSET_BASE_URL}/{schemaName}/{slug}.webp`. The boolean `hasArtwork` flag
 * marks which entities have artwork; the slug matches `getEntitySlug`, so the
 * artwork path lines up with the entity's canonical reference path.
 *
 * @param entity - The entity to derive from (must carry a stamped `schemaName`)
 * @returns The asset URL, or undefined if the entity has no artwork
 */
export function getAssetUrl(entity: SURefMetaEntity): string | undefined {
  if (!('hasArtwork' in entity) || entity.hasArtwork !== true) {
    return undefined
  }
  if (!('schemaName' in entity) || typeof entity.schemaName !== 'string') {
    return undefined
  }
  const slug = getEntitySlug(entity)
  return `${ASSET_BASE_URL}/${entity.schemaName}/${slug}.webp`
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
 * Extract content from an entity
 * @param entity - The entity to extract from
 * @returns The content or undefined
 */
export function getContent(entity: SURefMetaEntity): unknown | undefined {
  return 'content' in entity ? entity.content : undefined
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
export function getSource(entity: SURefMetaEntity): string | undefined {
  return 'source' in entity && typeof entity.source === 'string' ? entity.source : undefined
}

/**
 * Extract booklet code from an entity (e.g. "CR" / "PH" / "PC" / "CB" for SUSS).
 * Only meaningful when the primary source is a multi-booklet product.
 * @param entity - The entity to extract from
 * @returns The booklet code or undefined
 */
export function getBooklet(entity: SURefMetaEntity): string | undefined {
  return 'booklet' in entity && typeof entity.booklet === 'string' ? entity.booklet : undefined
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
 * Extract tree from an entity
 * @param entity - The entity to extract from
 * @returns The tree or undefined
 */
export function getTree(entity: SURefMetaEntity): unknown | undefined {
  return 'tree' in entity ? entity.tree : undefined
}

/**
 * Extract requirement from an entity
 * @param entity - The entity to extract from
 * @returns The requirement or undefined
 */
export function getRequirement(entity: SURefMetaEntity): string[] | undefined {
  return 'requirement' in entity && Array.isArray(entity.requirement)
    ? entity.requirement
    : undefined
}

/**
 * Extract patterns from an entity
 * @param entity - The entity to extract from
 * @returns The patterns or undefined
 */
export function getPatterns(entity: SURefMetaEntity): SURefObjectPattern[] | undefined {
  return 'patterns' in entity && Array.isArray(entity.patterns)
    ? visiblePatterns(entity.patterns)
    : undefined
}

/**
 * A HIDDEN pattern carries the stored `hidden` data flag — an explicit tag,
 * NEVER computed from source (project data convention; mirrors
 * `legalStarting`). The record stays in the dataset but is withheld from
 * every rendered surface. Takes the primitive the rule reads — the record's
 * `hidden` value (undefined = untagged = visible).
 */
export function isHiddenPattern(hidden: boolean | undefined): boolean {
  return hidden === true
}

/**
 * Drops the stored-`hidden` set from a chassis's patterns. This is the single
 * choke point every render surface goes through, so a pattern tagged `hidden`
 * cannot leak into a card, a generated page, a wizard picker or a bot embed.
 */
export function visiblePatterns<T extends { hidden?: boolean }>(patterns: readonly T[]): T[] {
  return patterns.filter((pattern) => !isHiddenPattern(pattern.hidden))
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
 * Extract recommended flag from an entity
 * @param entity - The entity to extract from
 * @returns True if the entity is recommended, false if not, undefined if not present
 */
export function getRecommended(entity: SURefMetaEntity): boolean | undefined {
  return 'recommended' in entity && typeof entity.recommended === 'boolean'
    ? entity.recommended
    : undefined
}

/**
 * Resolve a formation member to its entity, supporting chassis+pattern and standalone entity types.
 * For chassis: resolves chassis and optionally its pattern.
 * For other schemas (vehicles, drones, squads, npcs): resolves by name.
 * @param member - The formation member from faction data
 * @returns The resolved entity (with optional pattern for chassis), or undefined
 */
export function resolveFormationMember(
  member: SURefObjectFormationMech
): { entity: SURefEntity; pattern?: SURefObjectPattern } | undefined {
  const schemaName = member.schema ?? 'chassis'

  if (schemaName === 'chassis') {
    const chassis = SalvageUnionReference.findIn('chassis', (c) => c.name === member.chassis)
    if (!chassis) return undefined

    if (member.pattern) {
      const patterns = getPatterns(chassis)
      if (patterns) {
        const normalizedInput = normalizePatternName(member.pattern)
        const pattern = patterns.find((p) => normalizePatternName(p.name) === normalizedInput)
        if (pattern) return { entity: chassis, pattern }
      }
    }
    // Chassis found but pattern missing or not matched — still return the chassis
    return { entity: chassis }
  }

  // Non-chassis entity types: look up by name in the given schema
  const found = SalvageUnionReference.findIn(
    schemaName,
    (e) => 'name' in e && e.name === member.chassis
  )
  return found ? { entity: found } : undefined
}

// ============================================================================
// TYPE GUARDS - Data shape
// ============================================================================

/**
 * Type guard to distinguish SURefEntity (structured data with id/name/source/page)
 * from SURefMetaAction or other object types (which lack these fields)
 * @param data - Entity, action, or other object to check
 * @returns True if the data has id, name, source, and page fields
 */
export function isEntityData<T extends object>(
  data: T
): data is T & SURefEntity & { id: string; name: string; source: string; page: number } {
  return 'id' in data && 'name' in data && 'source' in data && 'page' in data
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
 * @param entity - The entity to check (null/undefined accepted; both return false)
 * @returns True if the entity is an Ability
 */
export function isAbility(entity: SURefMetaEntity | null | undefined): entity is SURefAbility {
  return entity !== null && typeof entity === 'object' && 'tree' in entity && 'level' in entity
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
 * Type guard to check if an entity is a Keyword
 * @param entity - The entity to check
 * @returns True if the entity is a Keyword
 */
export function isKeyword(entity: SURefMetaEntity): entity is SURefKeyword {
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
  return isCoreClass(entity) || isBaseAdvancedClass(entity)
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
export function getReferenceEntityName(entity: SURefMetaEntity): string | undefined {
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
  const resolvedActions = extractActionsFromCarrier(entity)
  return resolvedActions?.find((a) => !a.hidden)?.name
}

/**
 * Normalize pattern name by removing " Pattern" suffix
 * @param patternName - The pattern name to normalize
 * @returns The normalized pattern name
 */
export function normalizePatternName(patternName: string): string {
  // Equivalent to `patternName.replace(/\s+Pattern$/i, '')` without that
  // regex's quadratic backtracking on a long whitespace run (the engine
  // retried `\s+` from every position before failing the `Pattern$` literal).
  //
  // Semantics preserved exactly, including the sharp edges:
  //   - no trailing-whitespace tolerance — "Iron Pattern  " is UNCHANGED,
  //     because the suffix must sit at the very end of the string. (A
  //     `trimEnd()`-first rewrite would wrongly strip it.)
  //   - `\s+` requires at least one separator, so bare "Pattern" is UNCHANGED.
  //   - the `i` flag's casing rules are kept by reusing an `i`-flag regex for
  //     the literal rather than hand-rolling `toLowerCase()`, which differs on
  //     characters like `İ` and `ſ`.
  if (!/Pattern$/i.test(patternName)) {
    return patternName
  }
  const suffixStart = patternName.length - 'Pattern'.length
  let cut = suffixStart
  while (cut > 0 && /\s/.test(patternName.charAt(cut - 1))) {
    cut--
  }
  // No whitespace before the literal (e.g. "IronPattern") -> no match.
  return cut === suffixStart ? patternName : patternName.slice(0, cut)
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
/**
 * Resolve a facet field from an entity, falling back to its self-action.
 * The combat facets (activationCost/actionType/range/damage) live only on
 * actions in the data; the entity-level view is derived here. One helper
 * replaces four byte-identical getters (each of whose entity-first branch is
 * dead for every entity in the repo — kept only for a raw action passed in).
 */
function selfActionField<T>(
  entity: SURefMetaEntity,
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

const isNumberOrString = (v: unknown): v is number | string =>
  typeof v === 'number' || typeof v === 'string'
const isString = (v: unknown): v is string => typeof v === 'string'
const isStringArray = (v: unknown): v is string[] => Array.isArray(v)
type DamageValue = { damageType: string; amount: number | string }
const isDamage = (v: unknown): v is DamageValue => v !== null && typeof v === 'object'

export function getActivationCost(entity: SURefMetaEntity): number | string | undefined {
  return selfActionField(entity, 'activationCost', isNumberOrString)
}

/**
 * Get action type from an entity (self-action fallback).
 */
export function getActionType(entity: SURefMetaEntity): string | undefined {
  return selfActionField(entity, 'actionType', isString)
}

/**
 * Get range from an entity (self-action fallback).
 */
export function getRange(entity: SURefMetaEntity): string[] | undefined {
  return selfActionField(entity, 'range', isStringArray)
}

/**
 * Get damage from an entity (self-action fallback).
 */
export function getDamage(entity: SURefMetaEntity): DamageValue | undefined {
  return selfActionField(entity, 'damage', isDamage)
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
 * Get the number of inventory slots an equipment entity occupies.
 * Default is 1. Heavy or Portable traits make it 2.
 */
export function getInventorySlots(entity: SURefMetaEntity): number {
  const traits = getTraits(entity)
  if (traits) {
    for (const t of traits) {
      if (t.type === 'heavy' || t.type === 'portable') return 2
    }
  }
  return 1
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
    const rollTable = SalvageUnionReference.RollTables.find(
      (rt) => 'name' in rt && rt.name === entity.tableName
    )
    if (rollTable?.table) {
      return rollTable.table
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
    const rollTable = SalvageUnionReference.RollTables.find(
      (rt) => 'name' in rt && rt.name === matchingAction.tableName
    )
    if (rollTable?.table) {
      return rollTable.table
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

        const model = getModel(grant.schema.toLowerCase())
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
 * Get required traits from an action
 * @param action - The action to extract required traits from
 * @returns Array of required trait type strings, or empty array if none
 */
export function getRequiredTraits(action: SURefMetaAction): string[] {
  if ('requiredTraits' in action && Array.isArray(action.requiredTraits)) {
    return action.requiredTraits
  }
  return []
}

/**
 * Represents a parsed trait reference from text
 */
export type ParsedTraitReference = {
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

  // The name/param classes exclude their own OPENING delimiter as well as the
  // closing one, so every scan is bounded at the next `[` / `(` instead of
  // running to end-of-string from each of many `[[` starts (quadratic).
  //
  // The word-shape requirement that used to live in the regex
  // (`[A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+)*`) moved to `isTraitName` below:
  // as a regex it nested a quantifier inside a quantifier, which backtracks
  // quadratically on input like `[[[Aa Aa Aa Aa …`. The predicate is a linear
  // scan and accepts exactly the same set of names.

  // Pattern for parameterized traits: [[[TraitName] (param)]]
  const paramPattern = /\[\[\[([^\][]+)\]\s+\(([^)(]+)\)\]\]/g

  // Pattern for simple traits: [[TraitName]]
  const simplePattern = /\[\[([^\][]+)\]\]/g

  // Find all parameterized trait references first
  let match = paramPattern.exec(text)
  while (match !== null) {
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
    match = paramPattern.exec(text)
  }

  // Find all simple trait references
  match = simplePattern.exec(text)
  while (match !== null) {
    const current = match
    // Skip if this position is already covered by a parameterized match
    const isAlreadyMatched = references.some(
      (ref) => current.index >= ref.startIndex && current.index < ref.endIndex
    )

    if (!isAlreadyMatched) {
      const traitName = current[1]
      if (traitName) {
        references.push({
          fullMatch: current[0],
          traitName,
          startIndex: current.index,
          endIndex: current.index + current[0].length,
        })
      }
    }
    match = simplePattern.exec(text)
  }

  // Sort by start index
  references.sort((a, b) => a.startIndex - b.startIndex)

  return references
}
