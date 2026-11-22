/**
 * `/search` — the search's results page (r5 E3): every result for the
 * address's `?q=`, grouped by kind. Enter in the Union bar's search with no
 * row highlighted, and the hero's Search, open it. The page is static and
 * noindexed (a query's page, not content); its list is `SearchResultsIsland`,
 * which reads the query in the browser, its script on this page alone.
 */

import { SearchResultsIsland } from '../../components/islands/SearchResultsIsland'
import { space } from '../../design/tokens'
import { SITE_URL, SRD_CRUMB } from '../../lib/constants'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { Island } from '../../runtime/Island'
import { DocPage } from '../DocPage'
import type { PageModule, PageResult } from '../types'

function page(): PageResult {
  const url = `${SITE_URL}/search/`
  return {
    meta: {
      title: pageTitle(pagesCopy('searchResults')),
      description: pagesCopy('searchResultsDescription'),
      canonical: url,
      noindex: true,
      breadcrumbs: [SRD_CRUMB, { name: pagesCopy('searchResults'), url }],
    },
    children: (
      <DocPage title={pagesCopy('searchResults')} measure="64rem" gap={space[24]}>
        <Island name="SearchResultsIsland" client="load" props={{}}>
          <SearchResultsIsland />
        </Island>
      </DocPage>
    ),
  }
}

export const searchResultsPage: PageModule = {
  pattern: '/search',
  page,
}
