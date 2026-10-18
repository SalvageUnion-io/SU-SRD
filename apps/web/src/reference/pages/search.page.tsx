/**
 * `/search` — full search results, on the listing anatomy: the rules band with
 * "Search" notched in, then the listing (`SearchResultsIsland`): the rail, the
 * type facet as the listings' segmented control, and the hits as listing Rows.
 * It ends on the same band (`foot`), as a schema listing does.
 *
 * `SearchResultsIsland` is `client="only"` + `ssr={false}`. Per the `<Island>`
 * contract, an `ssr={false}` island is passed NO children — that keeps the
 * component out of the Bun SSR module graph entirely, which also sidesteps its
 * `window` access at build time.
 */

import type { PageModule, PageResult } from '../../../ssg/types'
import { ChapterBand } from '../../components/index'
import { SITE_URL, SRD_CRUMB } from '../../lib/constants'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { Island } from '../../runtime/Island'

const CANONICAL_URL = `${SITE_URL}/search/`

function page(): PageResult {
  return {
    meta: {
      title: pageTitle('Search'),
      description:
        'Search the full Salvage Union SRD — chassis, systems, modules, abilities, equipment, and more.',
      canonical: CANONICAL_URL,
      noindex: true,
      breadcrumbs: [SRD_CRUMB, { name: 'Search', url: CANONICAL_URL }],
    },
    foot: { tone: 'rules' },
    children: (
      <div className="su-listing-shell">
        <ChapterBand tone="rules" measure={PAGE_MEASURE}>
          Search
        </ChapterBand>
        <div className="su-listing-page su-page-body">
          {/* Client-only: results are inherently dynamic (query-driven), there
              is no SEO content to server-render, and the page is noindex. */}
          <Island name="SearchResultsIsland" client="only" />
        </div>
      </div>
    ),
  }
}

export const searchPage: PageModule = {
  pattern: '/search',
  page,
}
