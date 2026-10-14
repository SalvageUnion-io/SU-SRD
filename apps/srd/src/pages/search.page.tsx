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

import { ChapterBand } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { CONTENTS_CRUMB, SITE_URL, TITLE_SUFFIX } from '../lib/constants'
import { PAGE_MEASURE } from '../lib/pageMeasure'
import { Island } from '../runtime/Island'

const CANONICAL_URL = `${SITE_URL}/search/`

function page(): PageResult {
  return {
    meta: {
      title: `Search${TITLE_SUFFIX}`,
      description:
        'Search the full Salvage Union SRD — chassis, systems, modules, abilities, equipment, and more.',
      canonical: CANONICAL_URL,
      noindex: true,
      breadcrumbs: [CONTENTS_CRUMB, { name: 'Search', url: CANONICAL_URL }],
    },
    foot: { tone: 'rules', measure: PAGE_MEASURE },
    children: (
      <div className="srd-listing-shell">
        <ChapterBand tone="rules" measure={PAGE_MEASURE}>
          Search
        </ChapterBand>
        <div className="srd-listing-page srd-page-body">
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
