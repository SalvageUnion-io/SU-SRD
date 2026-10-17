/**
 * Entity-name slugification.
 *
 * Zero imports by design: `BaseModel` indexes every row by slug, and
 * `lib/slug.ts` (which owns the entity-lookup helpers) imports
 * `lib/ModelFactory.ts`, which imports `BaseModel`. Keeping the pure string
 * transform in its own module is what breaks that cycle —
 * `BaseModel -> nameToSlug` terminates immediately.
 *
 * `nameToSlug` remains public API, re-exported from the package barrel; this
 * module is an internal home, not a new surface.
 */
/**
 * Converts a name to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 *
 * CodeQL js/polynomial-redos note: a trim like `/^-+|-+$/g` is the classic
 * superlinear (O(n^2)) backtracking shape — a quantifier followed by an anchor
 * (`"a" + "-".repeat(n) + "a"` forces a retry at every start position). So
 * whitespace/hyphen runs collapse into a single hyphen first (`[\s-]+` — safe:
 * nothing follows the quantifier, so no backtracking), which guarantees at most
 * one leading and one trailing hyphen remains. That lets the final trim drop its
 * quantifier entirely (`/^-|-$/g`), leaving no
 * superlinear regex in the function.
 */
export declare function nameToSlug(name: string): string;
