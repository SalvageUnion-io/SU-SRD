import type { ProseRuleId } from 'salvageunion-reference/proseDeviations';
export declare const DATA_DIR: string;
export declare const LOCK_PATH: string;
/** Where a string's text comes from: a book, and for a boxed set, a booklet. */
export type Anchor = {
    source: string;
    booklet?: string;
    page?: number;
};
export type ProseItem = {
    /**
     * `file#entityId.path`: stable across row reordering and insertion. A
     * `bookQuote` in source is `<repo path>#bookQuote[n]`, the file's nth call.
     */
    key: string;
    file: string;
    entityId: string;
    entityName: string;
    /** Path inside the entity: `.content[0].value`. */
    path: string;
    /** The field the string sits in (`value`, `name`, `description`, …). */
    field: string;
    kind: 'name' | 'prose';
    text: string;
    anchors: Anchor[];
    /** Sits under a field the dataset assembles itself (`STRUCTURAL_FIELDS`). */
    structural: boolean;
    /** For `[(CHASSIS)]` text: the names of the chassis that own the action. */
    owners: string[];
};
type Row = Record<string, unknown>;
/** A record's citations: its own `source`, then its `additionalSources`. */
export declare function anchorsOf(e: Row): Anchor[];
/**
 * Every string in the dataset that is prose or a printed name, in file order,
 * then every `bookQuote` in the workspaces' source (`collectQuotes`).
 *
 * Actions carry no source of their own: they are printed under whatever
 * references them, so an action inherits the anchors of every entity that
 * lists it in `actions` or `chassisAbilities` (or of the nested record that
 * lists it, when that record carries its own `source`).
 */
export declare function collectProse(dataDir?: string, repoRoot?: string): ProseItem[];
/**
 * Every `bookQuote(anchor, text)` call in the workspaces' source
 * (`salvageunion-reference/lib/bookQuote.ts`), as prose items anchored where
 * the call says. Throws on a call whose arguments are not literals: the scan
 * cannot read a value, and a quote it cannot read would pass the gate unseen.
 */
export declare function collectQuotes(repoRoot?: string): ProseItem[];
/**
 * Typographic folding: curly quotes, dashes, ligatures, subscript digits.
 *
 * The verdict for a string cannot change under this fold — the comparison with
 * the book applies it to both sides — so the hash is taken after it. A change
 * the fold erases (a straight quote made curly) needs no re-verification; any
 * other edit changes the hash.
 */
export declare function fold(s: string): string;
/** The lock's hash of a data string: 16 hex digits of SHA-256 over the folded text. */
export declare function proseHash(text: string): string;
export declare const VERDICTS: readonly ['verbatim', 'deviation', 'authored', 'unverified', 'unverified-source'];
type Verdict = (typeof VERDICTS)[number];
/**
 * The closed list of reason codes. Rule ids come from the allowlist; the rest
 * qualify a `verbatim` match or name an `unverified` near-miss's drift class.
 */
declare const VERBATIM_REASONS: readonly ['elsewhere', 'other-book', 'artefact'];
export declare const DRIFT_REASONS: readonly ['typo', 'spelling', 'paraphrase', 'omission', 'added-text', 'split-merged', 'no-match', 'stat-mismatch'];
export type Reason = ProseRuleId | (typeof VERBATIM_REASONS)[number] | (typeof DRIFT_REASONS)[number];
export type LockEntry = {
    hash: string;
    verdict: Verdict;
    reason?: Reason;
};
export type Lock = {
    /** Book file each source was verified against, e.g. `Salvage Union Digital Edition 2.0a`. */
    editions: Record<string, string>;
    entries: Map<string, LockEntry>;
};
export declare function parseLockEntry(raw: unknown): LockEntry | string;
export declare function formatLockEntry(e: LockEntry): string;
export type LockFile = {
    editions: Record<string, string>;
    entries: Record<string, unknown>;
};
export declare function readLockFile(path?: string): LockFile | undefined;
/**
 * Serialise the lock with sorted keys. Every entry is a string, so two-space
 * `JSON.stringify` is already Biome's format: one entry per line.
 */
export declare function serializeLock(file: LockFile): string;
export declare function toLockFile(lock: Lock): LockFile;
export declare function writeLockFile(file: LockFile, path?: string): void;
/** What the lock holds a verdict for: a prose string, or a stat block's rendered fields. */
export type LockItem = {
    key: string;
    text: string;
};
export type LockDiff<T extends LockItem = ProseItem> = {
    /** Current strings with no entry, or an entry for different text. */
    unverified: {
        item: T;
        was?: LockEntry;
    }[];
    /** Entries for strings that no longer exist. */
    stale: string[];
    /** Entries that do not parse. */
    malformed: {
        key: string;
        problem: string;
    }[];
    /** Parsed entries, for reporting. */
    entries: Map<string, LockEntry>;
};
/** Hold the data to the lock. Pure: the gate and its tests both call this. */
export declare function compareWithLock<T extends LockItem>(items: T[], file: LockFile): LockDiff<T>;
/** Drop entries for strings that no longer exist. Needs no book: nothing is verified. */
export declare function pruneLock(file: LockFile, items: LockItem[]): LockFile;
export {};
