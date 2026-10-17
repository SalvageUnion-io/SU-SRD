/**
 * The branch this one merges into, for anything that measures "the branch":
 * the session status hook (`.claude/hooks/session-status.sh`) and the open-pr
 * skill's `--base`.
 *
 * Diffing against `origin/main` was right while every branch came off main.
 * A branch cut from another branch (a release branch, a stacked PR's parent)
 * carries that branch's whole diff against main: the status line counted the
 * parent's commits as this one's. So the base is resolved, first answer wins:
 *
 *   1. `$SU_BASE`, set by hand (`main`, `origin/<branch>`, …);
 *   2. the open PR's `base.ref`, through `gh api` REST (a cloud session's
 *      proxy refuses GraphQL), bounded by a timeout;
 *   3. the upstream, when it is another branch on origin (a branch tracking
 *      its own name on origin says nothing about its base);
 *   4. whichever of `BASE_CANDIDATES` HEAD is fewest commits ahead of (ties
 *      go to the first): today `main` alone, as no other long-lived branch
 *      exists.
 *
 * No answer at all is `null`; callers treat that as "no base", never as main.
 *
 *   bun packages/gates/lib/baseBranch.ts              print `<branch>\t<why>`
 *   bun packages/gates/lib/baseBranch.ts --no-pr      skip the PR lookup
 *   bun packages/gates/lib/baseBranch.ts --pr-base=X  the caller already looked
 */
type BaseSource = 'SU_BASE' | 'pr' | 'upstream' | 'nearest';
export type BaseBranch = {
    /** The branch name on origin, e.g. `main`. */
    branch: string;
    /** The remote-tracking ref to diff against, e.g. `origin/main`. */
    ref: string;
    source: BaseSource;
};
export type BaseInputs = {
    /** `$SU_BASE`, if set. */
    suBase?: string | null;
    /** The open PR's `base.ref`, if one was found. */
    prBase?: string | null;
    /** The upstream as git abbreviates it, e.g. `origin/feature`. */
    upstream?: string | null;
    /** The checked-out branch, `null` when detached. */
    current?: string | null;
    /** Commits HEAD is ahead of each candidate that exists on origin. */
    distances: ReadonlyMap<string, number>;
};
/** A short phrase saying where a base came from, for status lines. */
export declare function describeBase(base: BaseBranch): string;
/** The resolution order above, over inputs already gathered. */
export declare function pickBase(inputs: BaseInputs): BaseBranch | null;
/** `owner/repo` from the origin URL: https, ssh and the cloud git proxy all end in it. */
export declare function repoSlug(url: string): string | null;
/** stdout of a command that exited 0, else `null` (a missing binary included). */
type Env = Record<string, string | undefined>;
export type ResolveOptions = {
    cwd?: string;
    /** `$SU_BASE` is read from it and git and gh run under it; default `process.env`. */
    env?: Env;
    /**
     * The PR's base when the caller already looked it up; `null` skips the
     * lookup. Left out, `gh api` is asked, under `timeoutMs`.
     */
    prBase?: string | null;
    timeoutMs?: number;
};
/** Gather the inputs from git (and gh) and pick the base. */
export declare function resolveBaseBranch(options?: ResolveOptions): Promise<BaseBranch | null>;
/**
 * The CLI flags as `resolveBaseBranch`'s `prBase`: `--no-pr` is `null` (skip
 * the lookup), `--pr-base=X` is `X` (empty is `null`), neither is `undefined`.
 */
export declare function parseCliArgs(argv: readonly string[]): string | null | undefined;
/** The CLI's output line, `<branch>\t<why>`, or `null` when there is no base. */
export declare function cliLine(argv: readonly string[], options?: ResolveOptions): Promise<string | null>;
export {};
