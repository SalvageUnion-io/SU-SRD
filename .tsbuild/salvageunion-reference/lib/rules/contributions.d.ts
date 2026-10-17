/**
 * Resolving declared contributions into numbers (ADR-029).
 *
 * The numeric half of the converged modifier model. Content declares WHAT it
 * changes (`ContributionSchema`); this module works out how much that is worth
 * for a given holder, and — crucially — keeps each contribution's SOURCE
 * attached, so a derivation can hand the provenance panel "Beefcake +7" instead
 * of an anonymous addend.
 *
 * Pure and side-effect-free ([ADR-006](../../../../docs/ARCHITECTURE.md#decisions)):
 * no I/O, no ORM writes, no mutation of inputs.
 */
/** The stat keys a contribution may target. Mirrors `ContributionStatSchema`. */
export type ContributionStat = 'structurePoints' | 'energyPoints' | 'heatCapacity' | 'cargoCapacity' | 'systemSlots' | 'moduleSlots' | 'maxHp' | 'maxAp' | 'inventorySlots';
export type ContributionTarget = 'self' | 'pilot' | 'pilotedMech' | 'crawler';
export type ContributionAmount = number | {
    flat?: number;
    perTechLevel: number;
} | {
    fromStat: ContributionStat;
};
/** A contribution as declared on a piece of reference content. */
export type DeclaredContribution = {
    stat: ContributionStat;
    amount: ContributionAmount;
    target?: ContributionTarget;
    stacks?: boolean;
    voidWhen?: 'damaged' | 'destroyed';
    /** `activated` applies only while switched on in Guided Play (ADR-038 §2). */
    duration?: 'permanent' | 'activated';
    note?: string;
};
/** A resolved contribution: an amount, and the content that produced it. */
export type ResolvedContribution = {
    /** Display name of the granting entity, e.g. 'Beefcake'. */
    source: string;
    /** Slug/name ref so provenance UI can link back to it. */
    ref: string;
    stat: ContributionStat;
    /** Signed, already multiplied by copies and resolved against tech level. */
    amount: number;
    /** How many copies contributed (1 unless the item stacks and is installed twice). */
    copies: number;
};
/**
 * Resolve a declared amount.
 *
 * `perTechLevel` needs the target's tech level; a caller that cannot supply one
 * resolves it to the flat part rather than guessing, so an unknown tech level
 * under-counts visibly instead of inventing a number.
 */
export declare function resolveAmount(amount: ContributionAmount, techLevel?: number, stats?: Partial<Record<ContributionStat, number>>): number;
/**
 * Every contribution the named abilities declare for `target`/`stat`.
 *
 * Abilities do not stack per copy — holding an ability twice is not a thing —
 * so each resolved contribution is one copy.
 */
/**
 * Which `duration: 'activated'` contributions are currently switched on.
 *
 * Manual expiry by design: a player toggles an activated effect on and off.
 * Salvage Union states real durations ("this effect lasts for 1 hour"), but the
 * app has no play clock and inventing one would put time into the data layer —
 * so the table keeps time and the app keeps state, which is the same division
 * ADR-001's honour system already relies on.
 *
 * Never on the entity: The Cantina keeps it on the pilot's seat in a Game (ADR-038).
 */
export type ActiveEffects = Readonly<Record<string, boolean>>;
export declare function abilityContributions(abilityRefs: readonly string[] | undefined, target: ContributionTarget, stat: ContributionStat, techLevel?: number, active?: ActiveEffects, stats?: Partial<Record<ContributionStat, number>>): ResolvedContribution[];
/** Sum of resolved contributions — the number a derivation folds in. */
export declare function sumContributions(contributions: readonly ResolvedContribution[]): number;
/**
 * Contributions declared by the mech's own installed systems and modules.
 *
 * An installed item's contribution targets `self` — the host mech — so
 * `target` is not consulted here.
 *
 * `stats` supplies the host's own values for `fromStat` amounts: Hull
 * Magnetiser raises Cargo "by its System Slot Value", a number that changes
 * with the chassis and so cannot be written as a constant.
 */
export declare function installedContributions(installedRefs: readonly string[] | undefined, stat: ContributionStat, options?: {
    techLevel?: number;
    active?: ActiveEffects;
    stats?: Partial<Record<ContributionStat, number>>;
}): ResolvedContribution[];
