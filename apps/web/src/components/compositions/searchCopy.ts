/**
 * The searcher's empty result (chrome.md K8): a search that matched nothing
 * says so in these words, on every search surface — the Union bar's box, the
 * results page and the entity searcher. An empty collection is "No <things>
 * yet." (`EmptyState`), never this.
 */
export const NO_RESULTS = 'No results found.'

/** The same, naming what was searched for. */
export function noResultsFor(query: string): string {
  return `No results found for “${query}”.`
}
