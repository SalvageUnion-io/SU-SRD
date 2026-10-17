/**
 * What an agent session loads: the instruction text a session working in some
 * directories reads before it starts. doc-drift's `load` check
 * (`tools/check-doc-drift.ts`) totals it per named profile and holds each total
 * to a ratchet; the profiles and their ceilings live there.
 */
/** The outcome of one check: `failures` empty means it passed. */
type CheckResult = {
    ok: string;
    failures: string[];
};
/**
 * A kind of agent session: the directories it works in, and the docs its loaded
 * text tells it to read before working (beyond what loads by itself).
 */
/** `skip`: directories under `dirs` that belong to another session (the Cantina inside `apps/web`). */
export type SessionProfile = {
    dirs: string[];
    reads: string[];
    skip?: string[];
};
/** How far under its ceiling a profile may fall before the ceiling must come down. */
export declare const SESSION_SLACK = 500;
/** Repo-relative paths of the `.md` files at or below `dir`, sorted. */
export declare function markdownIn(root: string, dir: string): string[];
/**
 * "This path is gitignored at the repo root": absent in CI by design, so its
 * existence proves nothing. Handles the rule shapes the root `.gitignore` uses.
 */
export declare function gitignoredMatcher(root: string): (candidate: string) => boolean;
/** Repo-relative paths a doc imports by a line of its own: `@path`, relative to the doc. */
export declare function importsOf(doc: string, source: string): string[];
/** A rule's `paths:` globs from its front matter; empty when it has none (it always loads). */
export declare function rulePaths(source: string): string[];
/**
 * The files a session in `profile` loads: the root CLAUDE.md, every CLAUDE.md
 * under its directories, each with its `@path` imports, every rule whose
 * `paths:` match a file there (or that has none), and the profile's `reads`.
 */
export declare function sessionLoad(root: string, profile: SessionProfile): string[];
/** Each profile's total against its ceiling: over fails, more than `SESSION_SLACK` under too. */
export declare function checkSessionLoad(root: string, profiles: Record<string, SessionProfile>, ceilings: Record<string, number>): CheckResult;
export {};
