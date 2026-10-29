/**
 * The search's address: the home page with the Union bar's search open on a
 * query, `/?q=portable+cryopod`. The Worker's retired-page redirects, the 404
 * page's suggestions and the home page's search form all build it here, and
 * the search island and its mount rule read it back here, so the page and the
 * parameter name live in one place.
 *
 * No imports: the island mount rules (`runtime/mountNow.ts`) ship on every page.
 */

/** The page the search opens on. */
export const SEARCH_PAGE = '/'

/** The query's parameter on {@link SEARCH_PAGE}. */
export const SEARCH_PARAM = 'q'

/** The home page with its search open on `query`. */
export function searchHref(query: string): string {
  return `${SEARCH_PAGE}?${new URLSearchParams({ [SEARCH_PARAM]: query })}`
}

/** The query an address's search string opens the search on, trimmed; empty is none. */
export function searchQuery(search: string): string | undefined {
  return new URLSearchParams(search).get(SEARCH_PARAM)?.trim() || undefined
}
