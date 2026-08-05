/**
 * `/search` — full search results. Port of `search.astro`.
 *
 * `SearchResultsIsland` was `client:only="react"`, which is `client="only"` +
 * `ssr={false}` here. Per the `<Island>` contract, an `ssr={false}` island is
 * passed NO children — that keeps the component out of the Bun SSR module graph
 * entirely, which also sidesteps its `window` access at build time.
 */

import type { PageModule, PageResult } from '../../ssg/types'
import { SITE_URL } from '../lib/constants'
import { Island } from '../runtime/Island'

const CANONICAL_URL = `${SITE_URL}/search/`

function page(): PageResult {
  return {
    meta: {
      title: 'Search - Salvage Union System Reference Document',
      description:
        'Search the full Salvage Union SRD — chassis, systems, modules, abilities, equipment, and more.',
      canonical: CANONICAL_URL,
      noindex: true,
      breadcrumbs: [
        { name: 'SRD', url: `${SITE_URL}/` },
        { name: 'Search', url: CANONICAL_URL },
      ],
    },
    children: (
      <div className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8">
        <h1 className="mb-6 font-cond text-3xl font-bold text-ink">Search the SRD</h1>
        {/* Client-only: results are inherently dynamic (query-driven), there is
            no SEO content to server-render, and the page is noindex. */}
        <Island name="SearchResultsIsland" client="only" />
      </div>
    ),
  }
}

export const searchPage: PageModule = {
  pattern: '/search',
  page,
}
