/**
 * `toEntityModel` — an entity (and a player's instance of it) resolved ONCE
 * into everything a form draws. Pure: no React, no DOM, no CSS. The agreed
 * language is `docs/design-system/entity-display-language.md`.
 */
import type { RefMetaEntity, RefObjectAnyPattern } from '../schemas/index';
import type { EntityInstance, EntityModel, EntityRef } from './types';
/**
 * A glossary entry by name: exact, else lower-cased (the glossaries store
 * lower-case names; a datavalue prints its rule capitalised). `undefined` when
 * the glossary does not carry it, or is not loaded.
 */
export declare function glossaryRef(schemaName: 'traits' | 'keywords', name: string): EntityRef | undefined;
/**
 * Resolve an entity — or, with `view.pattern`, one of a chassis's patterns —
 * into its model. `instance` changes identity only where a player's copy
 * does: its title and whether it is user-made.
 */
export declare function toEntityModel(entity: RefMetaEntity, instance?: EntityInstance, view?: {
    pattern?: RefObjectAnyPattern;
}): EntityModel;
