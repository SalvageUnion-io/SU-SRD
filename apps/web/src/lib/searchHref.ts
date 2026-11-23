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

/** The session's mark that the next page was opened from search. */
const LANDING_KEY = 'su:from-search'

/** Mark the page about to open as opened from search (RR7-09). Storage may throw. */
export function markSearchLanding(): void {
  try {
    sessionStorage.setItem(LANDING_KEY, '1')
  } catch {
    // Not marked: the page opens as any other does.
  }
}

/**
 * On a page opened from search, its heading takes the focus (RR7-09): the
 * next Tab is in the page's own content, not its bar. A page opened on an
 * anchor keeps the anchor's place. Run once, by the page script.
 */
export function focusSearchLanding(doc: Document): void {
  try {
    if (!sessionStorage.getItem(LANDING_KEY)) return
    sessionStorage.removeItem(LANDING_KEY)
  } catch {
    return
  }
  const heading = doc.querySelector<HTMLElement>('main h1')
  if (!heading || doc.location.hash) return
  heading.tabIndex = -1
  heading.focus({ preventScroll: true })
}
