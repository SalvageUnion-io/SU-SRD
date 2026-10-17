/**
 * The FACETS an entity states after its stats (E17): the action type, the
 * action's range and damage, a crawler tech level's population, a hybrid
 * class's requirement, its traits and its datavalues.
 *
 * `facetCells` keeps them as ONE ordered list tagged by kind, because today's
 * card still prints them as one line; the model splits the list into
 * `actionType`, `facts` and `traits`.
 */
import type { ChoiceSelections } from '../../resolveChoiceView';
import type { RefMetaEntity, RefObjectChoice, RefObjectContentBlock, RefObjectDamage, RefObjectTrait } from '../../schemas/index';
import type { StatGroup } from '../types';
/** The fields an action states about itself. */
export type ActionFacets = {
    actionType?: string;
    range?: string[];
    damage?: RefObjectDamage;
    traits?: RefObjectTrait[];
    activationCost?: string | number;
    actionSource?: string;
};
/** One facet, in line order. */
export type FacetCell = {
    key: string;
    label: string;
    value?: string;
    /** An action type, a fact, or a named rule (trait or keyword). */
    kind: 'action-type' | 'fact' | 'trait';
    /** The raw action type, for `action-type` cells. */
    actionType?: string;
    /** A fact's short form. */
    short?: string;
    /** A fact's part of the stat order (`StatGroup`): an action's, unless it says. */
    group?: StatGroup;
    /** A fact's value in short form, for compact cells (`rangeCodes`). */
    shortValue?: string;
    /** A named rule's glossary lookup. */
    mention?: {
        schemaName: 'traits' | 'keywords';
        name: string;
    };
    /** Changed by a choice or scaled by the Tech Level. */
    modified?: true;
};
/** An action type as the book prints it (`ACTION_TYPE_LABELS`): "Turn" → "Turn Action". */
export declare function formatActionType(type: string): string;
/** The cost as a pennant prints it: "2 AP", "1 EP", "X EP". */
export declare function formatCost(cost: string | number, currency: string | number | undefined): string;
/**
 * An action's type, range, damage and traits. `mechActionType` splits the type
 * the way the book prints a few abilities — "Turn Action (Mech) // Short
 * Action (Pilot)" (core book p.248-249) — Mech first.
 */
export declare function actionFacets(action: ActionFacets, mechActionType?: string): FacetCell[];
/**
 * A crawler tech level's population band, as the book's table prints it
 * (p.218). `populationMax` null (or a legacy 0) is open-ended: "25,000+".
 */
export declare function populationRange(entity: RefMetaEntity): string | undefined;
/**
 * Every facet, in line order: the entity's own action (or its folded
 * self-action's) facets, the population band, a hybrid's requirement, its
 * traits (deduped against the folded action's), any trait a choice added,
 * then every datavalue — scaled by `effTechLevel` and marked `modified` where
 * a choice or the Tech Level changed it.
 */
export declare function facetCells(options: {
    entity: RefMetaEntity;
    entityName: string;
    /** The entity's own fields, when it IS an action. */
    action: ActionFacets | undefined;
    /** The self-action folded into it. */
    foldedAction: (ActionFacets & {
        name?: string;
        content?: RefObjectContentBlock[];
    }) | undefined;
    choices: RefObjectChoice[];
    selections?: ChoiceSelections;
    /** Datavalue label (lowered) → per-level increment. */
    perTechLevelByLabel: ReadonlyMap<string, number>;
    effTechLevel: number | undefined;
}): FacetCell[];
/**
 * The datavalues that scale with Tech Level (`perTechLevel`), by lowered label:
 * Custom Sniper Rifle damage "+1 SP per Tech Level".
 */
export declare function perTechLevelByLabel(entity: RefMetaEntity): Map<string, number>;
