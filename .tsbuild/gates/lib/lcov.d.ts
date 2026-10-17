/**
 * Bun's lcov, read and merged. Bun writes one record per loaded source file:
 * `SF`, `FNF`/`FNH` (no per-function `FN` lines), a `DA:<line>,<hits>` per
 * reported line, then `LF` (the count of `DA` lines) and `LH` (those with hits).
 *
 * Which lines Bun reports depends on what ran. A function that executed is
 * reported as its code lines, run or not. One that never executed (and is not
 * inside one that did) is reported as a single 0-hit range: comments and blank
 * lines included, its last line left out, sometimes starting on the line its
 * previous sibling ended. So two runs over the same file can disagree on its
 * line set, and neither the union (comments inflate `LF`) nor the intersection
 * (last lines drop out) matches what one run over every test would report.
 * `mergeLcov` resolves each disputed line by the run that executed the most of
 * the functions around it; on the Cantina suite that reproduces a serial run's
 * `DA` lines exactly.
 */
/** A function's first and last source line, 1-based. */
export type FunctionRange = readonly [start: number, end: number];
/**
 * One lcov from several Bun runs over disjoint test files, giving the same
 * `LF` and `LH` per file as a single run over all of them. Each line keeps the
 * most hits any run recorded. `functionRanges` is consulted only for a file
 * whose runs disagree on its line set. `FNH` takes the largest per-run value,
 * a lower bound (Bun names no functions).
 */
export declare function mergeLcov(reports: readonly string[], functionRanges: (path: string) => readonly FunctionRange[]): string;
