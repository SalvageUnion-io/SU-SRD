/**
 * Pure logic for trait-data validation in Salvage Union data.
 *
 * Five checks, all fixture-free (they flow from the schema/data, not from any
 * named entity):
 *
 *  1. Trait casing — every `traits[].type` must be lowercase. The convention is
 *     lowercase everywhere, and case-sensitive consumers (e.g. getInventorySlots
 *     matches `heavy`/`portable`) silently misbehave on a capitalized type.
 *  2. removeTrait resolvability — a choice effect `removeTrait <X>` must target a
 *     trait the entity actually carries (a base `traits[]` entry, or one added by
 *     an `addTrait` effect on the same entity). Otherwise it is a silent no-op,
 *     which usually means the base trait lives somewhere the resolver can't see.
 *  3. Vocabulary membership — every `traits[].type` must resolve against traits.json
 *     or keywords.json. Unknown types silently fall back to plain text in the UI
 *     (TraitKeywordDisplayView), so they never surface as visible errors.
 *  4. Inline links — every `[[Trait]]` / `[[[Trait] (n)]]` in any string must
 *     name a trait in traits.json (without case, as both renderers resolve it).
 *     A miss renders as an unlinked mark, so a dead link never looks broken.
 *  5. Inline markup — a `[[` the parser cannot read renders as raw brackets,
 *     and `[(CHASSIS)]` already reads "The <chassis>", so "the [(CHASSIS)]"
 *     renders "The The …".
 */
export type TraitIssue = {
    file: string;
    entity: string;
    kind: 'casing' | 'unresolvable-removeTrait' | 'unknown-trait-type' | 'dead-inline-trait' | 'inline-markup';
    detail: string;
};
type Entity = Record<string, unknown>;
/**
 * Collect the `type` of every trait in every `traits[]` array reachable from a
 * node, at any nesting depth (top-level traits, action traits, etc.).
 */
export declare function collectTraitTypes(node: unknown, out?: string[]): string[];
/** Flag any `traits[].type` that is not lowercase. */
export declare function findTraitCasingIssues(file: string, entities: Entity[]): TraitIssue[];
/** Flag any `removeTrait` effect whose target the entity does not carry. */
export declare function findUnresolvableRemoveTraitIssues(file: string, entities: Entity[]): TraitIssue[];
/** Run all checks across a set of loaded data files. */
export declare function findTraitIssues(filesByName: Record<string, Entity[]>): TraitIssue[];
/**
 * Walk every traits[].type in every data file and flag any type that is
 * defined in neither traits.json nor keywords.json.
 */
export declare function findUnknownTraitTypes(filesByName: Record<string, Record<string, unknown>[]>): TraitIssue[];
/**
 * Flag every inline trait link, in any string of any row, whose name is not a
 * trait, and any inline markup that renders wrong. The renderers resolve
 * against traits.json only, ignoring case; the UI library's TraitRef does not
 * trim, so neither does this.
 */
export declare function findDeadInlineTraitLinks(filesByName: Record<string, Record<string, unknown>[]>): TraitIssue[];
export {};
