/**
 * Type guards over reference data.
 *
 * There is no shape guard for a System versus a Module: they share one schema,
 * and the only field that distinguishes them is the `schemaName` stamped at
 * load time, so the discriminant is `entity.schemaName === 'systems'`.
 *
 * The package barrel (`lib/index.ts`) re-exports, by name, only what consumers import.
 */
import type { RefAbility, RefClass, RefMetaEntity, RefObjectAdvancedClass } from './schemas/index';
/**
 * Type guard to check if an entity is an Ability
 * @param entity - The entity to check (null/undefined accepted; both return false)
 * @returns True if the entity is an Ability
 */
export declare function isAbility(entity: RefMetaEntity | null | undefined): entity is RefAbility;
/**
 * Type guard to check if an entity is a Core Class
 * @param entity - The entity to check
 * @returns True if the entity is a Core Class
 */
export declare function isCoreClass(entity: RefMetaEntity): entity is RefClass & {
    coreTrees: string[];
};
/**
 * Type guard to check if an entity is an Advanced/Hybrid Class
 * @param entity - The entity to check
 * @returns True if the entity is an Advanced/Hybrid Class
 */
export declare function isBaseAdvancedClass(entity: RefMetaEntity): entity is RefObjectAdvancedClass;
