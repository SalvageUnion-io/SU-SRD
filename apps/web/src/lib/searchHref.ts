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

/** The page a search opened, in this tab's session: its content takes the focus there. */
const AT_CONTENT = 'su-at-content'

/**
 * A result's page is opened at its top with a clean address, the next Tab
 * starting in its content (RR7-09): the search marks it here, and the page's
 * script focuses its content on arrival (`focusMarkedContent`), where an
 * anchor in the address scrolled the bar away and was shared (r8 G3). A page
 * opened on its own anchor goes there instead.
 */
export function markAtContent(href: string): void {
  try {
    if (!href.includes('#')) sessionStorage.setItem(AT_CONTENT, href.split('?')[0] as string)
  } catch {
    // No storage: the page opens at its top all the same.
  }
}

/** The page's script, on arrival: the page a search marked focuses its content, once, unscrolled. */
export function focusMarkedContent(): void {
  try {
    if (sessionStorage.getItem(AT_CONTENT) !== location.pathname) return
    sessionStorage.removeItem(AT_CONTENT)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  } catch {
    // No storage: nothing was marked.
  }
}
