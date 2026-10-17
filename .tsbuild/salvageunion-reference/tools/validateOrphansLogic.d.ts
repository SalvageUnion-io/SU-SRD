/**
 * Pure logic for orphan detection in Salvage Union data.
 * An "orphan" is an entity that exists in its data file but is never referenced
 * by any other entity.
 */
export type OrphanResult = {
    file: string;
    name: string;
};
/**
 * An entry in the intentional-orphan allowlist. Keyed by the same
 * `{ file, name }` shape the checker emits so a match is exact — and so a stale
 * entry (one whose orphan no longer exists) is detectable.
 */
export type AllowlistEntry = {
    file: string;
    name: string;
};
export type PartitionedOrphans = {
    /** Detected orphans NOT on the allowlist — these should fail the check. */
    unexpected: OrphanResult[];
    /** Detected orphans that matched an allowlist entry — reported, non-fatal. */
    allowlisted: OrphanResult[];
    /**
     * Allowlist entries that no longer correspond to a current orphan (the entity
     * got referenced, renamed, or removed). Stale entries rot silently and can
     * mask a genuinely-orphaned successor, so they are surfaced and should fail
     * too.
     */
    staleAllowlist: AllowlistEntry[];
};
/**
 * Split the detected orphans into `unexpected` (not allowlisted → should fail)
 * and `allowlisted` (known-intentional → informational), and separately report
 * `staleAllowlist` entries that are no longer orphaned. Keeping the allowlist
 * honest is the whole point: an entry that no longer matches a real orphan must
 * be removed, or it can hide a future orphan that reuses the same name.
 */
export declare function partitionOrphansByAllowlist(orphans: OrphanResult[], allowlist: AllowlistEntry[]): PartitionedOrphans;
type EntityEntry = Record<string, unknown>;
type CollectReferencedActionsInput = {
    systems: EntityEntry[];
    modules: EntityEntry[];
    abilities: EntityEntry[];
    equipment: EntityEntry[];
    chassis: EntityEntry[];
    otherEntities: EntityEntry[];
};
/**
 * Traverse all entity lists and collect every action name that is referenced.
 */
export declare function collectReferencedActionNames(input: CollectReferencedActionsInput): Set<string>;
type CollectReferencedLoadoutInput = {
    chassis: EntityEntry[];
    drones: EntityEntry[];
    /** Mech-scale boss/monster entries that may be equipped with named systems or modules */
    bioTitans: EntityEntry[];
    /**
     * Every known name of this kind. A top-level drone lists its modules under
     * `systems` too, so this set decides which kind each drone entry is.
     */
    knownNames: Set<string>;
    /** Vehicles carry systems only: pass them for `'systems'`, never `'modules'`. */
    vehicles?: EntityEntry[];
};
/**
 * Traverse chassis patterns, vehicles, drones, and bio-titans to collect every
 * referenced system (`key: 'systems'`) or module (`key: 'modules'`) name.
 */
export declare function collectReferencedLoadoutNames(key: 'systems' | 'modules', input: CollectReferencedLoadoutInput): Set<string>;
/**
 * Given every row of one data file and the set of referenced names, return the
 * rows nothing references.
 */
export declare function findOrphans(file: string, rows: EntityEntry[], referencedNames: Set<string>): OrphanResult[];
export type OrphanCheckResult = {
    unexpected: OrphanResult[];
    allowlisted: OrphanResult[];
    staleAllowlist: AllowlistEntry[];
};
/**
 * Orchestration entry point: given the full data bag (filename -> parsed
 * array), run the entire orphan-detection pipeline (referenced-name
 * collection, orphan detection, allowlist partitioning, stale-allowlist
 * detection). `tools/validate.ts` and the tests both call this, so they
 * can never diverge.
 */
export declare function runOrphanCheck(filesByName: Record<string, unknown[]>): OrphanCheckResult;
export {};
