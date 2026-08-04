/**
 * Plain field extractors: read one property straight off an entity, narrowing
 * it to the type the reference data promises and returning `undefined` when the
 * entity does not carry it.
 *
 * Every function here is total, synchronous and dependency-free — nothing in
 * this module consults the ORM, the action map, or another entity. Anything
 * that has to RESOLVE something (an action name, a self-action fallback, a
 * pattern) lives in `actionResolution.ts` or `patterns.ts` instead.
 *
 * Split out of the old `lib/utilities.ts` grab bag; still re-exported from
 * there (and from the package barrel), so this is an internal home, not a new
 * public surface.
 */

import type { SURefMetaEntity, SURefObjectGrant } from './types/index.js'

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
 * Extract a Union Crawler tech level's Upkeep Cost — the Scrap (of the Crawler's
 * own Tech Level) it costs to keep running through a Downtime.
 * @param entity - The entity to extract from
 * @returns The upkeep cost or undefined
 */

export function getUpkeepCost(entity: SURefMetaEntity): number | undefined {
  return 'upkeepCost' in entity && typeof entity.upkeepCost === 'number'
    ? entity.upkeepCost
    : undefined
}

/**
 * Extract a Union Crawler tech level's Upgrade Cost — the Upgrade Pool total
 * that unlocks the next Tech Level. `null` in the data at the MAXIMUM tier
 * (there is nothing to upgrade to), which reads back as `undefined` here so the
 * stat simply does not render.
 * @param entity - The entity to extract from
 * @returns The upgrade cost, or undefined at the maximum tech level
 */

export function getUpgradeCost(entity: SURefMetaEntity): number | undefined {
  return 'upgradeCost' in entity && typeof entity.upgradeCost === 'number'
    ? entity.upgradeCost
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
 * Extract tree from an entity
 * @param entity - The entity to extract from
 * @returns The tree or undefined
 */

export function getTree(entity: SURefMetaEntity): unknown | undefined {
  return 'tree' in entity ? entity.tree : undefined
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
 * Get effects from an entity
 * Note: Effects only exist at base level, not in actions
 * @param entity - The entity to extract from
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
