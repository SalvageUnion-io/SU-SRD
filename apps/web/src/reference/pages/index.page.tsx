/**
 * `/` — the landing page: the site's front door (the Contents are the
 * Reference's home, `/reference/`).
 *
 * The band is the front doors' own (Build's `FrontDoor`, Play's
 * `PlayFrontDoor`): the site's name notched in under its kicker, the legacy
 * tagline (`Tagline`) beside it. Under it, `HomeFront`'s parts: the pitch with
 * the page's one rust action beside the art plate, the three ways in
 * (Reference, Build, Play), Buy the game, and the Discord bot. Search is the Union bar's, as on every other
 * page. Server-rendered and static: every row is a plain link.
 */

import { ChapterBand } from '../../components/index'
import { Tagline } from '../../components/Tagline'
import { DEFAULT_DESCRIPTION, WEBSITE } from '../../lib/constants'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { BuyTheGame, HomeDoors, HomeHero, InYourServer } from '../HomeFront'
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
      <div className="su-front">
        <ChapterBand measure={PAGE_MEASURE} asideAt="notch" aside={<Tagline />}>
          {pagesCopy('siteName')}
        </ChapterBand>
        <div className="su-front__body su-page-body">
          <HomeHero />
          <HomeDoors />
          <BuyTheGame />
          <InYourServer />
        </div>
      </div>
    ),
  }
}

export const indexPage: PageModule = {
  pattern: '/',
  page,
}
