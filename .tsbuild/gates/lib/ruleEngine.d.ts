/**
 * The shared engine behind `tools/check-rule-sets.ts`'s rule sets — design
 * tokens, styling ownership, the stylesheet entry, the copy lint and more.
 *
 * One engine, because three copies of a `walk()`, an exemption lookup, a
 * baseline read, a ratchet comparison and a report drift in three directions:
 * a rule pinned at zero becomes a ratchet in name only, and a ratchet lets an
 * improvement go unrecorded, so a new violation can be added back without
 * failing anything.
 *
 * What the engine owns, so no rule set has to:
 *
 *   - **the walk** — `listFiles`, a `Bun.Glob` scan that never enters
 *     `node_modules`, `dist`, dot-directories or machine-written `generated/`
 *     trees;
 *   - **exemptions** — `isExempt`, one shape everywhere: a path fragment, the
 *     rules it waives, and a written reason;
 *   - **the verdict** — `evaluate`, which knows two kinds of rule:
 *       * `zero` — any finding fails. There is no baseline entry to maintain,
 *         because the only legal count is none;
 *       * `ratchet` — a committed baseline burning down. The count may not
 *         rise, AND it may not fall without the baseline falling with it: an
 *         unrecorded improvement is slack that the next regression spends.
 *   - **the baseline file** — one JSON document keyed by rule set, holding
 *     ratchet rules only.
 */
export type Finding = {
    file: string;
    line: number;
    detail: string;
};
type RuleMode = 'zero' | 'ratchet';
export type Rule = {
    /** Stable id, used by exemptions and the baseline. */
    id: string;
    /** Which law this enforces — cited back to the author on failure. */
    rule: string;
    /** What to do instead. */
    fix: string;
    mode: RuleMode;
};
export type Exemption = {
    file: string;
    rules: readonly string[];
    reason: string;
};
export type RuleSet = {
    /** Stable id: the baseline key and the `--only=` value. */
    id: string;
    label: string;
    rules: readonly Rule[];
    /**
     * Hard preconditions, run before the scan in the CLI (scan floors, workspace
     * coverage). They exit the process on failure, which is why tests call
     * `scan` directly against a fixture root instead.
     */
    preflight?: (root: string) => void;
    /** Every rule's findings, keyed by rule id. Pure given `root`. */
    scan: (root: string) => Record<string, Finding[]>;
    /** Where a genuinely-correct case is declared, printed after a failure. */
    exemptionsLive: string;
    /** A line printed on success, after the count summary. */
    summary?: (root: string) => string;
};
/** Rule set id -> ratchet rule id -> allowed count. */
export type Baseline = Record<string, Record<string, number>>;
/**
 * Every file under `dirs` (repo-relative) whose name ends in one of
 * `extensions`, as sorted repo-relative paths.
 *
 * `generated/` is skipped because a machine-written file is not a place a
 * violation can be fixed — the only edit that survives is to the generator.
 * A missing directory yields nothing rather than throwing; the scan floors each
 * rule set asserts are what turn "found nothing" into a failure.
 */
export declare function listFiles(root: string, dirs: readonly string[], extensions: readonly string[]): string[];
/** A path is exempt from a rule when an entry's `file` fragment occurs in it. */
export declare function isExempt(exemptions: readonly Exemption[], relPath: string, ruleId: string): boolean;
type RuleVerdict = {
    rule: Rule;
    found: number;
    allowed: number;
    findings: Finding[];
    /** Why this rule fails, or null when it passes. */
    problem: 'nonzero' | 'regressed' | 'unrecorded-improvement' | null;
};
export type SetVerdict = {
    set: RuleSet;
    rules: RuleVerdict[];
    /** Baseline entries naming a rule that is not a ratchet rule of this set. */
    staleBaselineKeys: string[];
    ok: boolean;
};
/** Compare one rule set's findings with its slice of the baseline. */
export declare function evaluate(set: RuleSet, results: Record<string, Finding[]>, baseline?: Record<string, number>): SetVerdict;
/** The ratchet counts `--update-baseline` would write for one rule set. */
export declare function ratchetCounts(set: RuleSet, results: Record<string, Finding[]>): Record<string, number>;
/**
 * Ratchet rules whose new count is HIGHER than the committed one.
 *
 * `tools/check-rule-sets.ts --update-baseline` refuses them unless
 * `--allow-increase` is passed, for the one legitimate reason: a rule made
 * STRICTER counts what was always there. It may raise the baseline once, in its own commit,
 * with the reason written down. Drift may not.
 */
export declare function increases(previous: Record<string, number>, next: Record<string, number>): string[];
export declare function readBaseline(path: string): Baseline;
/** Human-readable failure report for one set. Empty when the set passed. */
export declare function formatFailures(verdict: SetVerdict, updateCommand: string): string[];
export {};
