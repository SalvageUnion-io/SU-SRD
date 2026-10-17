export type BookSpec = {
    /** Label used in output and in the lock's `editions`. */
    id: string;
    /** The extract, matched by filename so a new edition needs no code change. */
    file: RegExp;
    /**
     * The data anchors this book answers for. Empty: a fallback-only text.
     * `partial`: the anchor also covers material with no local text, so a miss
     * there is `unverified-source`, not drift.
     */
    answers: {
        source: string;
        booklet?: string;
        partial?: boolean;
    }[];
    /** Load every matching file (a series of one-off PDFs), not only the latest edition. */
    series?: boolean;
    /**
     * For a series whose files each cover one thing: the entity a file covers,
     * from its name. A record of that series is verifiable only when a file
     * covers it (or what owns it); the series' other files are still searched.
     */
    scopeOf?: (file: string) => string | undefined;
};
export declare const BOOK_SPECS: BookSpec[];
/**
 * The extract(s) for each book present in `dir`: the latest edition (names
 * compared with numeric collation), or for a series every file.
 */
export declare function pickFiles(dir: string): Map<BookSpec, string[]>;
/** `pickFiles` over a list of extract file names. */
export declare function pickLatest(files: string[]): Map<BookSpec, string[]>;
/**
 * A book's extract split at its `<!-- page N -->` markers: page number to
 * text. `dropGlyphs` removes layout-glyph lines, a PDF-side clean-up for
 * reading prose; a stat block's digits are such lines, so keep them to read
 * one.
 */
export declare function readPages(path: string, { dropGlyphs }?: {
    dropGlyphs?: boolean | undefined;
}): Map<number, string>;
