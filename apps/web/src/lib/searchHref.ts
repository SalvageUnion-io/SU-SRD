/**
 * The search's address: the Reference page with the Union bar's search open on
 * a query, `/reference/?q=portable+cryopod`. Not the home page, which serves
 * no search field to open (RR-02). The Worker's retired-page redirects, the 404
 * page's suggestions and the home page's search form all build it here, and
 * the search island and its mount rule read it back here, so the page and the
 * parameter name live in one place. The page of every result for a query,
 * `/search/?q=`, is built here too (`resultsHref`, r5 E3).
 *
 * No imports: the island mount rules (`runtime/mountNow.ts`) ship on every page.
 */

/** The page the search opens on. */
export const SEARCH_PAGE = '/reference/'

/** The query's parameter on {@link SEARCH_PAGE}. */
export const SEARCH_PARAM = 'q'

/** The Reference page with its search open on `query`. */
export function searchHref(query: string): string {
  return `${SEARCH_PAGE}?${new URLSearchParams({ [SEARCH_PARAM]: query })}`
}

/** The query an address's search string opens the search on, trimmed; empty is none. */
export function searchQuery(search: string): string | undefined {
  return new URLSearchParams(search).get(SEARCH_PARAM)?.trim() || undefined
}

/** The page of every result for a query (`/search/?q=shield`), grouped by kind. */
export const RESULTS_PAGE = '/search/'

/** The results page for `query`. */
export function resultsHref(query: string): string {
  return `${RESULTS_PAGE}?${new URLSearchParams({ [SEARCH_PARAM]: query })}`
}

/** The page content's anchor: the skip link's target, every reference page's `main`. */
const CONTENT_ANCHOR = '#main-content'

/**
 * A result's page, opened at its content (RR7-09): the browser starts the
 * next Tab inside the page, past its bar, navs and crumbs, with no script on
 * the page. A page already opened on an anchor keeps it.
 */
export function atContent(href: string): string {
  return href.includes('#') ? href : `${href}${CONTENT_ANCHOR}`
}
