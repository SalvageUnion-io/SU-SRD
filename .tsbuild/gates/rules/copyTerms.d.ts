/**
 * Copy lint for game terms — the `copy` rule set of `tools/check-rule-sets.ts`.
 *
 * The book capitalises its game nouns: the Core Book writes "Mech" 968 times
 * and "mech" 15, "Pilot" 452 and "pilot" 16. An audit of the Cantina's copy found it
 * lower case about half the time ("mech" 91, "Mech" 77), "TL" where the book
 * says "Tech N" or "Tech Level", "Heat Cap" in prose where the book says "Heat
 * Capacity", and the product named three ways. None of that fails typecheck,
 * lint or a test, so nothing held it.
 *
 * ## The corpus: what counts as copy
 *
 * Every `.ts`/`.tsx` file a user-facing surface ships (`COPY_DIRS`), parsed
 * with oxc, contributes:
 *
 *   - every JSX text node;
 *   - every string literal and template-literal chunk that reads as prose (two
 *     words separated by whitespace), outside an import, the calls whose
 *     arguments are not copy (`isSkippedCall`: a `bookQuote(…)`, the book's
 *     own words held to the book by the rules-fidelity lock; a `console.*`
 *     line; a zod `.describe(…)`) and the JSX attributes that carry markup
 *     rather than words (`NON_COPY_ATTRS`).
 *
 * A one-word string literal is an identifier far more often than copy
 * (`schema === 'mech'`), so it is not read; a one-word JSX text node is copy.
 *
 * ## The rules
 *
 *   - `lowercase-term` — a game term written with a lower-case word. The term
 *     list is `data/keywords.json`, so the dataset is the style guide: a
 *     keyword counts when the dataset's own prose (book text, held verbatim by
 *     the fidelity lock) capitalises it in at least `CAPITALISED_SHARE` of at
 *     least `MIN_USES` uses. That keeps "Mech", "Pilot", "Tech Level" and
 *     "Hit Points", and leaves the keywords the book also uses as plain English
 *     ("move", "damaged", "group").
 *   - `banned-variant` — a spelling the book or the product does not use:
 *     `BANNED`, plus any other casing of the product's names in
 *     `cantina-domain/src/product.ts` (read from that file, never retyped).
 *
 * Both are ratchets against `tools/baselines/rule-sets.json`: today's copy
 * is the baseline, a new finding fails, and a fixed one must be locked in.
 */
import type { Finding, RuleSet } from '../lib/ruleEngine';
export type CopyString = {
    file: string;
    line: number;
    text: string;
};
/** Every copy string in one source file. Pure: the caller reads the file. */
export declare function extractCopy(file: string, source: string): CopyString[];
export declare const DATA_DIR = "packages/salvageunion-reference/data";
/** A keyword is a capitalised term when the dataset capitalises at least this share of its uses… */
export declare const CAPITALISED_SHARE = 0.8;
/** …across at least this many uses. */
export declare const MIN_USES = 5;
/**
 * `term(s)`, any casing, words joined by any whitespace. A hyphen, a slash or
 * a dot joined to a word on either side is a slug, a class name or a host
 * (`su-mech-card`, `/schema/mech/`, `cantina.salvageunion.io`), not a word.
 */
export declare function termPattern(term: string): RegExp;
export type TermUse = {
    term: string;
    capitalised: number;
    lower: number;
};
/** Each keyword with how the dataset's prose spells it. */
export declare function weighTerms(root: string): TermUse[];
/** The keywords the dataset capitalises: the `lowercase-term` list. */
export declare function capitalisedTerms(uses: readonly TermUse[]): string[];
export type Banned = {
    pattern: RegExp;
    /** The spelling to use instead; a match spelled exactly so passes. */
    say: string;
    why: string;
    /** A string that is wholly this (a bare label) is allowed. */
    allowWhole?: RegExp;
};
/** Spellings the book does not use, each with what it says instead and where. */
export declare const BANNED: readonly Banned[];
export declare const PRODUCT_FILE = "packages/cantina-domain/src/product.ts";
/** `name` and `shortName` of `PRODUCT`, read from its source. */
export declare function productNames(root: string): {
    name: string;
    shortName: string;
};
/**
 * Any other casing of the product's two names. A bracketed `[cantina]` is a log
 * tag, not the name.
 */
export declare function productBans(product: {
    name: string;
    shortName: string;
}): Banned[];
/** Findings for a corpus, given the term list and the bans. Pure. */
export declare function lintCopy(copy: readonly CopyString[], terms: readonly string[], bans: readonly Banned[]): Record<string, Finding[]>;
export declare const copyTerms: RuleSet;
