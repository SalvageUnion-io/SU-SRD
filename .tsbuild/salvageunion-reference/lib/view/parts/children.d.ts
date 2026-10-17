/**
 * An entity's CHILDREN — what it nests (grants, drones, a commander, a
 * pattern's loadout) — and its ACTIONS.
 */
import type { RefEntity, RefMetaAction, RefMetaEntity, RefObjectAnyPattern } from '../../schemas/index';
import type { EntityRef } from '../types';
/** A labelled group of nested entities. */
export type NestedGroup = {
    label: string;
    entities: RefEntity[];
};
/**
 * A class's ability trees, as its Discord card lists them: a Core class's Core
 * trees in its page's order, each tree's abilities in level order; a Hybrid
 * Class's own tree. Advanced and Legendary trees are not listed. A tree with
 * no abilities is dropped; any other entity has none.
 */
export declare function classTrees(entity: RefMetaEntity): NestedGroup[];
/**
 * The Hybrid Classes a Core class advances into: those one of its Core trees
 * opens (`ability-tree-requirements`). None for a Hybrid Class, the Salvager
 * or any other entity.
 */
export declare function classAdvancement(entity: RefMetaEntity): RefEntity[];
/**
 * Every entity a card nests, grouped: GRANTS (`resolveGrantedEntities`),
 * DRONES a chassis ability names, and a crawler's commander as NPCS —
 * synthesized into an npcs-schema record so it renders as one. De-duplicated
 * by `schemaName:id`. Patterns and actions are not here.
 */
export declare function nestedEntityGroups(entity: RefMetaEntity): NestedGroup[];
/**
 * What a chassis's Discord card nests beyond its model's children: DRONES its
 * abilities name (the Little Sestra's Sestra Drone), once each, and its
 * PATTERNS, each a link to its own page and nothing more.
 */
export declare function chassisCardGroups(chassis: EntityRef): {
    label: string;
    items: EntityRef[];
}[];
/**
 * A pattern's loadout, grouped: Systems, Modules, Drones. MULTIPLICITY IS
 * PRESERVED — one entry per installed copy, whether the data says `count` or
 * repeats the entry; an explicit `count: 0` installs nothing. A drone resolves
 * through `ref ?? name` (an instance name over a shared stat block). A
 * Bio-Titan pattern has no loadout, so it groups to nothing.
 */
export declare function patternGroups(pattern: RefObjectAnyPattern): NestedGroup[];
/** Systems and modules named by name arrays, resolved; unknown names dropped. */
export declare function resolveLoadout(systemNames: string[], moduleNames: string[]): {
    systems: RefEntity[];
    modules: RefEntity[];
};
/**
 * A vehicle's SYSTEMS: every item it lists, in the book's order and count (the
 * Power Loader's "Locomotion System / Rigging Arm x 2"). The book prints a
 * vehicle's equipment as one list, so each draws as a card the drone way,
 * whether the data names a systems entry or the vehicle's own action; a
 * vehicle has no ACTIONS slab. A name that resolves to neither is dropped.
 */
export declare function vehicleSystemNames(entity: RefMetaEntity): string[];
/**
 * A drone's or vehicle's OWN systems/modules loadout: a drone's from its name
 * arrays, a vehicle's from every item it lists (`vehicleSystemNames`).
 */
export declare function droneOwnLoadout(entity: RefMetaEntity): {
    systems: RefEntity[];
    modules: RefEntity[];
};
/** The "Titanic Actions" meta-descriptor and its kin: always their own row. */
export declare function isTitanicAction(action: {
    name?: string;
}): boolean;
/**
 * The SELF-action — named like its entity, by `name` or `displayName` — which
 * folds into the entity: its facets read as the entity's own, so only an
 * action that IS the entity folds. A lone action of another name does not.
 */
export declare function foldedActionOf<T extends {
    name?: string;
    displayName?: string;
}>(foldableActions: T[], entityName: string): T | undefined;
/**
 * An entity's actions, split: the folded self-action, and every other visible
 * one (titanic ones included). A granting ability has none of its own.
 */
export declare function entityActions(entity: RefMetaEntity, entityName: string): {
    folded: RefMetaAction | undefined;
    others: RefMetaAction[];
};
