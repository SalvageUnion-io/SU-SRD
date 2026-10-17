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
import type { RefMetaAction, RefMetaEntity, RefObjectAnyPattern, RefObjectChoice, RefObjectTrait } from './schemas/index';
/** Clear the cached action map so the next lookup reads fresh data. Called by `preload()`. */
export declare function invalidateActionMap(): void;
/**
 * Extract actions from an entity
 * Resolves action names to full action objects from actions schema
 * @param entity - The entity to extract from
 * @returns The actions array or undefined
 */
export declare function extractActions(entity: RefMetaEntity): RefMetaAction[] | undefined;
/**
 * The visible actions a pattern ADDS to its host — a Bio-Titan pattern's
 * `actions`, resolved. A mech pattern adds none (its difference is its
 * systems and modules), so it resolves to an empty list.
 */
export declare function extractPatternActions(pattern: RefObjectAnyPattern): RefMetaAction[];
/**
 * Extract visible (non-hidden) actions from an entity
 * @param entity - The entity to extract from
 * @returns The visible actions array or undefined
 */
export declare function extractVisibleActions(entity: RefMetaEntity): RefMetaAction[] | undefined;
/**
 * Extract chassis abilities from a chassis
 * Resolves ability names to full ability objects from actions schema
 * @param entity - The entity to extract from
 * @returns The chassis abilities array or undefined
 */
export declare function getChassisAbilities(entity: RefMetaEntity): RefMetaAction[] | undefined;
type DamageValue = {
    damageType: string;
    amount: number | string;
};
/**
 * Get action type from an entity (self-action fallback).
 */
export declare function getActionType(entity: RefMetaEntity): string | undefined;
/**
 * Get range from an entity (self-action fallback).
 */
export declare function getRange(entity: RefMetaEntity): string[] | undefined;
/**
 * Get damage from an entity (self-action fallback).
 */
export declare function getDamage(entity: RefMetaEntity): DamageValue | undefined;
/**
 * Get traits from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract traits from
 * @returns The traits array or undefined if not present
 */
export declare function getTraits(entity: RefMetaEntity): RefObjectTrait[] | undefined;
/**
 * Get choices from an entity
 * Checks action choices first (if action name matches entity name), then root-level choices
 * If both base entity and a granted entity have actions with the same name, action choices
 * are filtered out (handled by grantable UI) but root-level choices are still returned
 * @param entity - The entity to extract choices from
 * @returns The choices array or undefined if not present
 */
export declare function getChoices(entity: RefMetaEntity): RefObjectChoice[] | undefined;
export {};
