/**
 * `/` — the landing page: the site's front door, then the manual's Contents.
 *
 * The band is the front doors' own (Build's `FrontDoor`, Play's
 * `PlayFrontDoor`): the site's name notched in under its kicker, the legacy
 * tagline (`Tagline`) beside it. Under it, `HomeFront`'s parts: the pitch with
 * the page's one rust action beside the art plate, the three ways in
 * (Reference, Build, Play), the Contents (the book's chapters, each opened by
 * its band, then the rules a table reaches for under an ink band), Buy the
 * game, and the Discord bot. Search is the page's own: a field under the
 * slideshow, always in view on a phone and a desktop (r2 H6), in place of the
 * Union bar's. Server-rendered and static: every row is a plain link.
 */

import { HeroSearchStatic } from '../../components/HeroSearch'
import { DEFAULT_DESCRIPTION, WEBSITE } from '../../lib/constants'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { Island } from '../../runtime/Island'
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
      // The home is its slideshow, between the header and the footer, over the
      // one thing a reader can always do there: look something up.
      <div className="su-front su-front--show">
        <HomeHero />
        <div className="su-front__search su-grain--paper" data-ground="ink">
          <Island name="SearchIsland" client="interaction" ssr props={{ variant: 'home' }}>
            <HeroSearchStatic shortcut="/" />
          </Island>
        </div>
      </div>
    ),
  }
}

export const indexPage: PageModule = {
  pattern: '/',
  page,
}
