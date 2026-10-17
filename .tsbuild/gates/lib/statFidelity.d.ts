import type { Anchor, LockEntry } from './proseFidelity';
type StatKind = 'chassis' | 'pattern' | 'system' | 'module' | 'drone' | 'npc' | 'squad' | 'ability';
/** One printed stat: `{ label: 'TL', value: '2' }`, or `{ label: 'Line', value: <stat line> }`. */
type StatField = {
    label: string;
    value: string;
};
export type StatItem = {
    /** `file#entityId[.path]@stat`: never collides with a prose key. */
    key: string;
    file: string;
    entityId: string;
    entityName: string;
    /** Where the block sits in the entity: '' for its own numbers, `.patterns[2]`, `.actions[0]`. */
    path: string;
    /** The owning entity's schema. */
    kind: StatKind;
    /** For a pattern: its name. For an action: its name as printed (no owner suffix). */
    name?: string;
    /** For a pattern: its index among the chassis' patterns cited to the same page. */
    slot?: number;
    anchors: Anchor[];
    fields: StatField[];
    /** What the lock hashes: every field, in order. */
    text: string;
};
type Row = Record<string, unknown>;
/**
 * An action's stat line as the book sets it: `2EP Turn Action // Range: Close
 * // Damage: 3 SP // Energy // Hot (2)`. Empty when the action has none.
 */
export declare function renderStatLine(a: Row, currency: string, extra?: string[]): string;
/** Every stat block in the dataset, in file order, each field in the book's order. */
export declare function collectStats(dataDir?: string): StatItem[];
/** One book's text layer by page, unfiltered: the stat digits are the point. */
export type Pages = Map<number, string>;
export declare function parsePages(text: string): Pages;
/**
 * A part's name for comparing lists: a configuration in parentheses dropped,
 * a trailing Module/System/Plugin and a plural "s" ignored ("Loudspeaker",
 * "Self-Destruct Module", "Encrypted Comms Plugin").
 */
export declare function partKey(name: string): string;
/** Canonical tokens of a stat line: a cost, an action type, then each other part. */
export declare function statTokens(line: string): string[];
/**
 * Do two stat lines say the same? Order-free, and the action type counts only
 * where the book prints one: a weapon's line leaves its Turn Action implied.
 */
export declare function sameStatLine(data: string, book: string): boolean;
/** What the Core Book extractors read: its pages, every System, Module and trait name. */
export type StatContext = {
    pages: Pages;
    systems: Set<string>;
    modules: Set<string>;
    traits: Set<string>;
};
export declare function statContext(pages: Pages, dataDir?: string): StatContext;
export type StatResult = {
    item: StatItem;
    verdict: LockEntry['verdict'];
    reason?: LockEntry['reason'];
    /** What differs, data then book: printed locally, never written to the lock. */
    diff?: string;
};
/**
 * The verdict for one block. Its own citation is not the Core Book, or there
 * is no Core Book text at hand: `unverified-source`. Its extractor cannot find
 * it: `unverified no-match`. Any field differs: `unverified stat-mismatch`.
 */
export declare function statVerdict(ctx: StatContext | undefined, item: StatItem): StatResult;
export {};
