/**
 * `/404` — the not-found page, as a search page: the shared `NotFound`
 * content, its search and "did you mean" as islands.
 *
 * Emitted as `dist/404.html`, NOT `dist/404/index.html`: the Worker answers every
 * miss with it (`src/worker/index.ts`, reading `/404` through the asset binding).
 * See the URL -> file table in `ssg/DESIGN.md`. The band's search is the page's
 * search, so the Union bar carries none here (`BaseLayout`).
 */

import type { PageModule, PageResult } from '../../../ssg/types'
import { HeroSearchStatic } from '../../components/HeroSearch'
import { NotFound } from '../../components/NotFound'
import '../../lib/gameData'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { Island } from '../../runtime/Island'

function page(): PageResult {
  return {
    meta: {
      title: pageTitle('404 - Page Not Found'),
      description: pagesCopy('thePageYouAreLooking'),
      noindex: true,
    },
    children: (
      <NotFound
        search={
          <Island name="SearchIsland" client="interaction" ssr props={{ variant: 'hero' }}>
            <HeroSearchStatic />
          </Island>
        }
        didYouMean={<Island name="DidYouMeanIsland" client="idle" />}
      />
    ),
  }
}

export const notFoundPage: PageModule = {
  pattern: '/404',
  page,
}
