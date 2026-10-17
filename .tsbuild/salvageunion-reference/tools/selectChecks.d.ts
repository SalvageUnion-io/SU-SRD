/**
 * `--only=a,b` parsing for `validate.ts`, kept in its own module so it can be
 * tested without importing the runner — which pulls every check adapter and
 * the data loader into the coverage set on import.
 */
/** The ids of every check `validate.ts` runs, in run order. */
export declare const CHECK_IDS: readonly ['ids', 'duplicate-keys', 'self-citations', 'slugs', 'references', 'actions', 'action-backrefs', 'orphans', 'content-dupes', 'traits', 'parity'];
export type CheckId = (typeof CHECK_IDS)[number];
/** The checks named by `--only=a,b`, or all of them. Throws on an unknown id. */
export declare function selectChecks<T extends {
    id: string;
}>(checks: readonly T[], argv: readonly string[]): T[];
