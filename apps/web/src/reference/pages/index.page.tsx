/**
 * `/` — the landing page: the site's front door, then the manual's Contents.
 *
 * The band is the front doors' own (Build's `FrontDoor`, Play's
 * `PlayFrontDoor`): the site's name notched in under its kicker, the legacy
 * tagline (`Tagline`) beside it. Under it, `HomeFront`'s parts: the pitch with
 * the page's one rust action beside the art plate, the three ways in
 * (Reference, Build, Play), the Contents (the book's chapters, each opened by
 * its band, then the rules a table reaches for under an ink band), Buy the
 * game, and the Discord bot. Search is the Union bar's, as on every other
 * page. Server-rendered and static: every row is a plain link.
 */

import { DEFAULT_DESCRIPTION, WEBSITE } from '../../lib/constants'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { HomeHero } from '../HomeFront'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

/** The site's name and what this page is: there is no page name to put ahead of it. */
const TITLE = `${pageTitle()} · ${pagesCopy('homeTitle')}`

function page(): PageResult {
  return {
    meta: {
      title: TITLE,
      description: DEFAULT_DESCRIPTION,
      preloadScriptFont: true,
      structuredData: {
        '@context': 'https://schema.org',
        ...WEBSITE,
        alternateName: pagesCopy('salvageUnionSrd'),
        description: DEFAULT_DESCRIPTION,
      },
    },
    children: (
      // EXPERIMENT: the home is its slideshow alone, between the header and the footer.
      <div className="su-front su-front--show">
        <HomeHero />
      </div>
    ),
  }
}

export const indexPage: PageModule = {
  pattern: '/',
  page,
}
