/**
 * resolveChoiceView — pure resolver for granted-equipment choices.
 *
 * Given an entity (e.g. Custom Sniper Rifle) carrying a base `datavalues`
 * content block, base `traits`, and a set of `choices`, plus the player's
 * current `selections`, compute the live dataview:
 *
 *   { datavalues, traits, prompts }
 *
 * - `datavalues`: the base datavalue row with applied effects (setRange
 *   replaces Range, addDamage bumps Damage), and unresolved required-choice
 *   prompts removed once resolved.
 * - `traits`: base traits with `addTrait`/`removeTrait` effects applied
 *   (explicit on a `source.kind: 'options'` option, or inferred from a
 *   shortlist `source.kind: 'catalog'` choice). Adding an existing trait
 *   upgrades its amount (Explosive 1 → 2).
 * - `prompts`: one entry per unresolved required choice (nothing selected),
 *   e.g. { choiceId, label, text: 'Choose: Ballistic or Energy' }.
 *
 * The function is deterministic and performs no I/O. It is the single source
 * of truth shared by srd (ephemeral selection state) and the Cantina
 * (persisted selection state). It reads a choice's `source` and `cardinality`.
 */
import type { RefObjectChoice, RefObjectContentBlock, RefObjectDataValue, RefObjectTrait } from './schemas/index';
/**
 * Selections keyed by choice id, each holding the selected option values.
 */
export type ChoiceSelections = Record<string, string[]>;
/**
 * Unresolved required-choice prompt surfaced in the dataview row.
 */
type ChoicePrompt = {
    choiceId: string;
    label: string;
    text: string;
};
/**
 * The resolved dataview for an entity given a set of selections.
 */
export type ResolvedChoiceView = {
    datavalues: RefObjectDataValue[];
    traits: RefObjectTrait[];
    prompts: ChoicePrompt[];
};
/**
 * Minimal structural shape the resolver needs from an entity. Kept local so
 * the resolver accepts any entity carrying content + choices without forcing
 * the caller through the full RefEntity union.
 */
type ResolvableEntity = {
    content?: RefObjectContentBlock[];
    traits?: RefObjectTrait[];
    choices?: RefObjectChoice[];
};
/**
 * Resolve the live dataview for an entity given a set of choice selections.
 */
export declare function resolveChoiceView(entity: ResolvableEntity, selections: ChoiceSelections): ResolvedChoiceView;
export {};
