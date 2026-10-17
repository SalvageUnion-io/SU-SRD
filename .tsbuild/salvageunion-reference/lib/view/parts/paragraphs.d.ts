/**
 * Prose for a narrow column: a Discord card prints each of the book's
 * sentences on a line of its own.
 */
/**
 * A paragraph as its sentences, the book's words unchanged. A sentence ends at
 * `.`, `!` or `?` before a capital or a quote, so "e.g. a" and "p.23" never
 * break.
 */
export declare function splitSentences(text: string): string[];
