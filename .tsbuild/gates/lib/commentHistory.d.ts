/**
 * History phrases in code comments: the `history` check of
 * `tools/check-doc-drift.ts`.
 *
 * A comment says what is true of the code beside it and why. The story of how
 * it got that way (the issue that asked for it, the phase that built it, what
 * it did before) lives in git, where `git log -S` and `git blame` find it; in a
 * comment it goes stale while it still reads as current. Each phrase below is
 * the tell of one kind of that narration. A regression test still says what it
 * pins, as the invariant ("the gauge never infers an override"), not as the
 * story of the bug.
 */
/** One denied phrase: its id, what it matches, and what to write instead. */
export type HistoryPhrase = {
    id: string;
    pattern: RegExp;
    instead: string;
};
/** One phrase found in one comment line: the phrase's id, and the words that matched. */
export type HistoryHit = {
    file: string;
    line: number;
    phrase: HistoryPhrase;
    match: string;
};
/** A tracked file the check reads: script or module code, not generated output. */
export declare const isCommentSource: (file: string) => boolean;
/** Every history phrase in `source`'s comments. Pure: the caller reads the file. */
export declare function historyHits(file: string, source: string, phrases?: readonly HistoryPhrase[]): HistoryHit[];
/** The outcome of one check: `failures` empty means it passed. */
type CheckResult = {
    ok: string;
    failures: string[];
};
/**
 * doc-drift's `history` check: every history phrase in a code comment fails,
 * so each is held at zero. Pass `files` to read a fixture; the default is the
 * repo's tracked source, which must clear `SOURCE_FLOOR`. `env` is the
 * environment `git ls-files` runs in: a test passes one without `GIT_*`, so a
 * hook's `GIT_DIR` cannot point it at the outer repo.
 */
export declare function checkCommentHistory(root: string, files?: string[], env?: Record<string, string | undefined>): CheckResult;
export {};
