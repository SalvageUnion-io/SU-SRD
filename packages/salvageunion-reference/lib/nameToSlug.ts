/**
 * Entity-name slugification.
 *
 * Zero imports by design: `BaseModel` indexes every row by slug, and
 * `lib/slug.ts` (which owns the entity-lookup helpers) imports
 * `lib/ModelFactory.ts`, which imports `BaseModel`. Keeping the pure string
 * transform in its own module is what breaks that cycle —
 * `BaseModel -> nameToSlug` terminates immediately.
 *
 * `nameToSlug` remains public API and is still re-exported from `lib/slug.ts`
 * and the package barrel; this module is an internal home, not a new surface.
 */

/**
 * Defensive cap on input length before any regex processing in `nameToSlug`.
 * `nameToSlug` is exported public API — real entity names in `data/*.json` top
 * out at ~50 characters, so this is generous headroom, never expected to
 * truncate real data. It bounds worst-case regex work to a constant for any
 * caller (current or future) that passes untrusted/oversized input; it is
 * belt-and-suspenders alongside the quantifier fix below, not a substitute
 * for it (see CodeQL js/polynomial-redos note on `nameToSlug`).
 */
const MAX_SLUG_INPUT_LENGTH = 256

/**
 * Converts a name to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 *
 * CodeQL js/polynomial-redos note: the trailing-hyphen-trim regex used to be
 * `/^-+|-+$/g`. The `-+$` branch has a quantifier immediately followed by an
 * anchor with nothing after it in the string to guarantee the match, which is
 * the classic superlinear (O(n^2)) backtracking shape for the query
 * (e.g. `"a" + "-".repeat(n) + "a"` forces a retry at every start position).
 * The fix collapses whitespace/hyphen runs into a single hyphen first
 * (`[\s-]+` — safe: nothing follows the quantifier, so no backtracking), which
 * guarantees at most one leading and one trailing hyphen remains. That lets
 * the final trim drop its quantifier entirely (`/^-|-$/g`), leaving no
 * superlinear regex in the function.
 */
export function nameToSlug(name: string): string {
  const input = name.length > MAX_SLUG_INPUT_LENGTH ? name.slice(0, MAX_SLUG_INPUT_LENGTH) : name
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
    .replace(/[\s-]+/g, '-') // Collapse runs of whitespace and/or hyphens into a single hyphen
    .replace(/^-|-$/g, '') // Remove a leading/trailing hyphen (at most one remains after the collapse above)
}
