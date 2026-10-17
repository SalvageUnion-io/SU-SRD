/**
 * Pure logic for the "namesake action back-reference" convention.
 *
 * In the dataset an entity's own granted effect is frequently modeled as an
 * action of the SAME NAME, sourced from that entity's type (`actionSource`).
 * When an action's name exactly matches an entity in its `actionSource` file,
 * that entity is expected to list the action in its `actions[]` — otherwise the
 * action's mechanical detail never resolves from the entity that grants it.
 *
 * This is the generalized form of the bug that left the "Bionic Arms" ability
 * without its own `Passive` action (the +2 Max HP / downtime heal): 16 of 17
 * `Passive`/abilities actions were referenced by their namesake ability, and
 * that one was the lone miss. The convention holds 100% across the current data
 * (systems, modules, equipment, abilities — 361/361 namesake matches). This
 * check keeps it that way: a future unreferenced namesake action fails the build
 * the same way an orphan would, but points at the specific entity to fix.
 *
 * Scope note: the check only fires when an action's name EXACTLY matches an
 * entity in the same source file. Actions granted under a different name (e.g.
 * the "Bionic Arms Attack" turn action granted by the "Bionic Arms" ability) are
 * out of scope here — those are covered by the orphan validator instead.
 */
export type BackrefViolation = {
    source: string;
    actionName: string;
    actionType?: string;
};
export type ActionLike = {
    name?: string;
    displayName?: string;
    actionType?: string;
    actionSource?: string;
};
export type EntityLike = {
    name?: string;
    actions?: unknown;
};
/**
 * For each action whose name matches an entity in its `actionSource` file,
 * verify that entity references the action (by `name`, or by `displayName` for
 * disambiguated variants). Returns one violation per unreferenced namesake
 * (source, name) pair.
 */
export declare function findMissingActionBackrefs(actions: ActionLike[], entitiesBySource: Record<string, EntityLike[]>): BackrefViolation[];
/**
 * Orchestration entry point: given the full data bag (filename -> parsed
 * array), build the `actions` / `entitiesBySource` inputs from
 * ACTION_SOURCE_FILES and run findMissingActionBackrefs. `tools/validate.ts`
 * and the tests both call this, so they can never diverge on which files feed
 * the check.
 */
export declare function runActionBackrefCheck(filesByName: Record<string, unknown[]>): BackrefViolation[];
