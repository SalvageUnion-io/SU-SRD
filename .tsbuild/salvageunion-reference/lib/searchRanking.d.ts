/**
 * Search matching and ranking — the pure half of search, shared by every
 * matcher in the repo.
 *
 * There are two matchers and there have to be: the ORM-backed `search()` in
 * `search.ts`, which walks the loaded entity corpus field by field, and srd's
 * `searchCompactIndex`, which runs in the browser against the build-time
 * `/search-index.json` so the site never ships the corpus. They differ in what
 * they match AGAINST. They must not differ in how a match is decided or ranked
 * — a result that sits first in one and fifth in the other is a bug nobody can
 * see from either side.
 *
 * So the rules live here, once: the query tokenisation, the AND-of-tokens rule
 * with its name-only typo forgiveness, and the name-priority score tiers. srd
 * calls {@link scoreSearchMatch} with the facts it has, and the ORM calls the same
 * function with the extra facts only it can know.
 *
 * Nothing in this module touches the ORM or the data, so importing it costs a
 * browser bundle nothing but these functions.
 */
/** A normalised query: the whole lowered string plus its whitespace tokens. */
export type SearchQuery = {
    loweredQuery: string;
    tokens: string[];
};
/** Normalise a raw query, or `null` when it is blank (a blank query matches nothing). */
export declare function tokenizeSearchQuery(query: string): SearchQuery | null;
/** The lowered name split into words — what typo forgiveness is measured against. */
export declare function searchNameWords(nameText: string): string[];
/**
 * Does every token land? AND semantics: each token must either appear
 * literally (`hasLiteral` — the caller knows what it is matching against), or,
 * for a token of {@link TYPO_MIN_TOKEN_LENGTH}+ characters, be one edit away
 * from a word of the NAME ("hellfyre" → "Hellfire"). Typo forgiveness is
 * name-only on purpose: fuzzy-matching prose turns every query into noise.
 */
export declare function matchSearchTokens(tokens: readonly string[], nameWords: readonly string[], hasLiteral: (token: string) => boolean): {
    matches: boolean;
    usedTypo: boolean;
};
/** What a matcher knows about one hit. The optional facts are ORM-only. */
export type SearchMatchFacts = SearchQuery & {
    /** The entity name, lowered. */
    nameText: string;
    /** Whether {@link matchSearchTokens} needed typo forgiveness. */
    usedTypo: boolean;
    /** The entity description, lowered — a whole-query hit there earns +10. */
    descriptionText?: string;
    /** How many distinct fields held a token — +5 each. */
    matchedFieldCount?: number;
};
/**
 * The relevance score of a hit. Higher ranks first.
 *
 * Name-priority tiers, first that applies: exact name 100, name prefix 50,
 * whole query inside the name 25, every token inside the name ("heavy laser" →
 * "Heavy Arc Laser") 20. Then the ORM-only refinements, which a caller without
 * per-field data simply omits: +10 for the whole query in the description, +5
 * per matched field. A typo-assisted match loses 15, which keeps it below every
 * literal hit of the same tier.
 */
export declare function scoreSearchMatch(facts: SearchMatchFacts): number;
