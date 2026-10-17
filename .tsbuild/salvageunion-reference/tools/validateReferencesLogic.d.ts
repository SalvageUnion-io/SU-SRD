/**
 * Pure logic for cross-reference validation in the Salvage Union data.
 * Checks that every by-name reference resolves: pattern systems/modules and
 * drones (and their preselected choices), drone modules, catalog-choice
 * shortlists (which must name a schema),
 * `tableName` / `rollTable` (any depth, any file), guide `guideRef` and step
 * `schemaEntities`, faction `formation` members and ability `grants`.
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=references`) and the tests share one implementation.
 */
export type ValidationError = {
    file: string;
    entityName: string;
    field: string;
    referencedName: string;
    message: string;
};
/**
 * Refs that are known not to resolve and wait on an owner decision. Each one
 * is tolerated only at its exact file, entity, field and name, so the same
 * name unresolved anywhere else still fails; an entry that stops matching fails, so
 * the list cannot outlive its fix.
 */
export declare const KNOWN_UNRESOLVED_REFS: ReadonlyArray<{
    file: string;
    entityName: string;
    field: string;
    referencedName: string;
    reason: string;
}>;
/** Run every cross-reference check over the supplied data bag. */
export declare function findReferenceErrors(filesByName: Record<string, unknown[]>, known?: typeof KNOWN_UNRESOLVED_REFS): ValidationError[];
