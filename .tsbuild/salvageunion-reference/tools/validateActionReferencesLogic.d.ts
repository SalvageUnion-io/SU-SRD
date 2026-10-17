/**
 * Pure logic for action-reference validation in the Salvage Union data.
 * Checks that all action names referenced in data files exist in
 * actions.json (`actions[]`, a pattern's `actions[]` and `chassisAbilities[]`).
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=actions`) and the tests share one implementation.
 */
export type ActionReferenceError = {
    file: string;
    entityName: string;
    field: string;
    referencedName: string;
    message: string;
    suggestion?: string;
};
/** Run the action-reference check over the supplied data bag. */
export declare function findActionReferenceErrors(filesByName: Record<string, unknown[]>): ActionReferenceError[];
