/**
 * The impure edge of `advancement.ts`.
 *
 * `advancement.ts` is pure over neutral inputs (ADR-006) and deliberately does
 * not import `SalvageUnionReference`. Consumers still need the live dataset,
 * and every one of them building it by hand is how two copies of the same
 * tree-offering function ended up in two packages. This module is the single
 * seam where the catalog is read, so the rules stay pure and the callers stay
 * thin.
 *
 * Preload requirement: `classes` and `ability-tree-requirements`.
 */
import type { RefClass } from '../schemas/index';
import type { AdvancementClassInput, AdvancementDataset } from './advancement';
/** Narrow a reference class record to the primitives advancement reads. */
export declare function toAdvancementClass(cls: RefClass): AdvancementClassInput;
/**
 * Build the advancement dataset from the loaded catalog.
 *
 * Not memoised: it is two maps over 11 class records and 20 requirement rows,
 * and a cache would have to be invalidated on preload — a staleness bug in
 * exchange for nothing measurable.
 */
export declare function liveAdvancementDataset(): AdvancementDataset;
/**
 * The ability trees a class may draw from, for a picker.
 *
 * It cannot begin from `coreTrees`: **hybrid classes do not have them**, and a
 * hybrid would be offered only its own tree and its Legendary tree — two of its
 * four. A hybrid's other two trees come from `ability-tree-requirements`.
 *
 * `selectedTrees` are appended so trees the pilot already holds abilities in
 * stay visible and toggleable — including SEALED ones, which are retained
 * permanently and must never disappear from a sheet just because they are
 * closed to new picks.
 *
 * `allLevels: false` is the creation pool and is unchanged: core trees only,
 * which correctly yields nothing for a hybrid (they are not legal creation
 * classes).
 */
export declare function offeredAbilityTrees(cls: AdvancementClassInput, options: {
    allLevels: boolean;
    selectedTrees?: readonly string[];
}): string[];
