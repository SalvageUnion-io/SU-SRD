/**
 * Pure logic for two duplication checks: an object in a data file that
 * spells the same key twice, and an `additionalSources` entry that repeats
 * its own row's citation.
 *
 * `JSON.parse` keeps the LAST value and says nothing, so every consumer and
 * every other check reads that one, and the text above it is dead. A chassis
 * re-cited to a new page while its old `"page"` stayed further down the object
 * read the old page everywhere. This reads the raw text, which is the only
 * place the duplicate is visible.
 */
type DuplicateKey = {
    /** JSON path of the object holding the duplicate, e.g. `[29]` or `[3].patterns[0]`. */
    path: string;
    key: string;
    /** 1-based line of each occurrence. */
    lines: number[];
};
/** Every key spelled more than once in the same object, at any depth of `text`. */
export declare function findDuplicateKeys(text: string): DuplicateKey[];
/**
 * Every `additionalSources` entry, at any depth of a row (rows and patterns
 * both cite), that repeats the citation of the object it sits on. A row
 * re-cited to a reprint keeps the reprint as a second source by accident;
 * it adds nothing and reads as two printings.
 */
export declare function findSelfCitations(filesByName: Record<string, unknown[]>): Array<{
    file: string;
    path: string;
    source: string;
}>;
export {};
