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
 * The package barrel (`lib/index.ts`) re-exports, by name, only what
 * consumers import.
 */
import type { RefMetaEntity, RefObjectGrant } from './schemas/index';
/**
 * Extract tech level from an entity
 * @param entity - The entity to extract from
 * @returns The tech level (number, 'B', 'N') or undefined
 */
export declare function getTechLevel(entity: RefMetaEntity): number | 'B' | 'N' | undefined;
/**
 * Extract tech level from an entity as a numeric value
 * Normalizes 'B' and 'N' to 1 for math operations
 * @param entity - The entity to extract from
 * @returns The tech level as a number or undefined
 */
export declare function getTechLevelNumber(entity: RefMetaEntity): number | undefined;
/**
 * Extract salvage value from an entity
 * @param entity - The entity to extract from
 * @returns The salvage value or undefined
 */
export declare function getSalvageValue(entity: RefMetaEntity): number | undefined;
/**
 * Extract slots required from an entity
 * @param entity - The entity to extract from
 * @returns The slots required or undefined
 */
export declare function getSlotsRequired(entity: RefMetaEntity): number | undefined;
/**
 * Extract page reference from an entity
 * @param entity - The entity to extract from
 * @returns The page number or undefined
 */
export declare function getPageReference(entity: RefMetaEntity): number | undefined;
/**
 * Extract structure points from an entity
 * @param entity - The entity to extract from
 * @returns The structure points or undefined
 */
export declare function getStructurePoints(entity: RefMetaEntity): number | undefined;
/**
 * Extract energy points from an entity
 * @param entity - The entity to extract from
 * @returns The energy points or undefined
 */
export declare function getEnergyPoints(entity: RefMetaEntity): number | undefined;
/**
 * Extract heat capacity from an entity
 * @param entity - The entity to extract from
 * @returns The heat capacity or undefined
 */
export declare function getHeatCapacity(entity: RefMetaEntity): number | undefined;
/**
 * Extract system slots from an entity
 * @param entity - The entity to extract from
 * @returns The number of system slots or undefined
 */
export declare function getSystemSlots(entity: RefMetaEntity): number | undefined;
/**
 * Extract module slots from an entity
 * @param entity - The entity to extract from
 * @returns The number of module slots or undefined
 */
export declare function getModuleSlots(entity: RefMetaEntity): number | undefined;
/**
 * Extract cargo capacity from an entity
 * @param entity - The entity to extract from
 * @returns The cargo capacity or undefined
 */
export declare function getCargoCapacity(entity: RefMetaEntity): number | undefined;
/**
 * Extract a Union Crawler tech level's Upkeep Cost — the Scrap (of the Crawler's
 * own Tech Level) it costs to keep running through a Downtime.
 * @param entity - The entity to extract from
 * @returns The upkeep cost or undefined
 */
export declare function getUpkeepCost(entity: RefMetaEntity): number | undefined;
/**
 * Extract a Union Crawler tech level's Upgrade Cost — the Upgrade Pool total
 * that unlocks the next Tech Level. `null` in the data at the MAXIMUM tier
 * (there is nothing to upgrade to), which reads back as `undefined` here so the
 * stat simply does not render.
 * @param entity - The entity to extract from
 * @returns The upgrade cost, or undefined at the maximum tech level
 */
export declare function getUpgradeCost(entity: RefMetaEntity): number | undefined;
/**
 * Extract hit points from an entity
 * Used for NPCs, Creatures, Squads, and Meld
 * @param entity - The entity to extract from
 * @returns The hit points or undefined
 */
export declare function getHitPoints(entity: RefMetaEntity): number | undefined;
/**
 * Extract blackMarket flag from an entity
 * @param entity - The entity to extract from
 * @returns True if the entity is from the Black Market, false if not, undefined if not present
 */
export declare function getBlackMarket(entity: RefMetaEntity): boolean | undefined;
/**
 * Extract content from an entity
 * @param entity - The entity to extract from
 * @returns The content or undefined
 */
export declare function getContent(entity: RefMetaEntity): unknown | undefined;
/**
 * Extract name from an entity
 * @param entity - The entity to extract from
 * @returns The name or undefined
 */
export declare function getName(entity: RefMetaEntity): string | undefined;
/**
 * Extract source from an entity
 * @param entity - The entity to extract from
 * @returns The source or undefined
 */
export declare function getSource(entity: RefMetaEntity): string | undefined;
/**
 * Extract booklet code from an entity (e.g. "CR" / "PH" / "PC" / "CB" for SUSS).
 * Only meaningful when the primary source is a multi-booklet product.
 * @param entity - The entity to extract from
 * @returns The booklet code or undefined
 */
export declare function getBooklet(entity: RefMetaEntity): string | undefined;
/**
 * Extract tree from an entity
 * @param entity - The entity to extract from
 * @returns The tree or undefined
 */
export declare function getTree(entity: RefMetaEntity): unknown | undefined;
/**
 * Extract bioSalvageValue from an entity
 * @param entity - The entity to extract from
 * @returns The bioSalvageValue or undefined
 */
export declare function getBioSalvageValue(entity: RefMetaEntity): number | undefined;
/**
 * Get display name from an entity
 * Falls back to name if displayName is not provided
 * @param entity - The entity to extract display name from
 * @returns The display name or name, or undefined if neither is present
 */
export declare function getReferenceEntityName(entity: RefMetaEntity): string | undefined;
/**
 * Get description from an entity
 * @param entity - The entity to extract description from
 * @returns The description or undefined if not an ability
 */
export declare function getDescription(entity: RefMetaEntity): string | undefined;
/**
 * Get grants from an entity
 * @param entity - The entity to extract grants from
 * @returns The grants array or undefined if not present
 */
export declare function getGrants(entity: RefMetaEntity): RefObjectGrant[] | undefined;
