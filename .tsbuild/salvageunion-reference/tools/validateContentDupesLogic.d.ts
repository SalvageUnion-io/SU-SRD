/**
 * Pure logic for intra-record content duplication in Salvage Union data.
 *
 * A record duplicates its own content when one `content[]` paragraph repeats
 * another paragraph of the SAME record — either verbatim, or by swallowing it
 * whole (an un-split "blob" paragraph sitting alongside the split version of
 * the same prose). Both shapes render the text twice on the entity card.
 *
 * This is exactly how "Can't Stop, Won't Stop" and "Mech-Gyver" regressed: the
 * `Break out Actions (#66)` migration, which lifted action prose out of
 * abilities.json into actions.json, emitted BOTH its un-split source blob and
 * its paragraph-split output for those two records. Nine validators existed at
 * the time and not one looked *inside* a single record's own content array, so
 * it sat undetected. This check closes that gap.
 *
 * Deliberately scoped to a single record: repetition ACROSS records is normal
 * and heavily used in this corpus (the Tech 2–6 Pilot Bay tiers, the
 * Crawler/Pilot/Mech movement rates on the map guides, Minor/Major injury
 * healing). Only self-duplication is a defect.
 */
/** How a paragraph duplicates another within the same record. */
type DupeKind = 
/** Two paragraphs normalize to exactly the same text. */
'exact'
/** One paragraph fully contains another (the un-split "blob" shape). */
 | 'contains';
export type ContentDupe = {
    file: string;
    /** `name` of the owning record, for a human-readable breadcrumb. */
    record: string;
    kind: DupeKind;
    /** 1-based index of the paragraph that repeats/swallows the other. */
    paragraph: number;
    /** 1-based index of the paragraph being repeated/swallowed. */
    duplicateOf: number;
    /** Leading text of the duplicated prose, for the diagnostic message. */
    excerpt: string;
};
/**
 * Paragraphs shorter than this (in words) are ignored.
 *
 * Short stock phrases legitimately recur inside one record — a stat line, a
 * bare "Roll to hit as normal.", a repeated table caption. The duplication this
 * check exists to catch is always a substantial block of rules prose, so a
 * floor buys immunity to that noise at no cost to detection: both known
 * regressions duplicate 20+ word sentences.
 */
export declare const MIN_WORDS = 8;
/**
 * Normalize a paragraph for comparison.
 *
 * Strips `[[Trait]]` link markers, collapses whitespace, and lowercases. The
 * marker-stripping is load-bearing rather than cosmetic: in the "Can't Stop,
 * Won't Stop" regression the blob kept its `[[Vulnerable]]` links while the
 * split copies had degraded to plain `Vulnerable`, so a marker-sensitive
 * comparison would have missed the duplication entirely.
 */
export declare function normalizeParagraph(value: string): string;
/**
 * Find self-duplicating paragraphs within a single `content[]` array.
 *
 * Reports each duplicated pair once. For an `exact` pair only the later
 * paragraph is reported (the earlier one is treated as the original); for a
 * `contains` pair the containing paragraph is reported against the one it
 * swallows.
 */
export declare function findDupesInContent(content: unknown[]): Omit<ContentDupe, 'file' | 'record'>[];
/**
 * Orchestration entry point: given the full data bag (filename -> parsed
 * array), return every intra-record content duplication. `tools/validate.ts`
 * and the tests both call this, so the two can never diverge.
 */
export declare function runContentDupeCheck(filesByName: Record<string, Record<string, unknown>[]>): ContentDupe[];
export {};
