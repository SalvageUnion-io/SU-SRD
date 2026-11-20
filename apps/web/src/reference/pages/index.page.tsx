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

import type { RefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { ContentsRow } from '../../components/index'
import { ChapterBand, ContentsChapter, SlabSection } from '../../components/index'
import { Tagline } from '../../components/Tagline'
import { buildChapters } from '../../lib/chapters'
import { DEFAULT_DESCRIPTION, WEBSITE } from '../../lib/constants'
import { itemHref } from '../../lib/entityHref'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { BuyTheGame, HomeDoors, HomeHero, InYourServer } from '../HomeFront'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

/** The site's name and what this page is: there is no page name to put ahead of it. */
const TITLE = `${pageTitle()} · ${pagesCopy('homeTitle')}`

/** An entity's page by name, or nothing when the dataset no longer has it. */
function hrefByName(schemaName: RefEnumSchemaName, name: string): string | undefined {
  const entity = SalvageUnionReference.findIn(schemaName, (e) => e.name === name)
  return entity ? itemHref(schemaName, getEntitySlug(entity)) : undefined
}

/** The rules a table reaches for mid-session ("At the table"). */
const AT_THE_TABLE: { schema: RefEnumSchemaName; name: string; label: string }[] = [
  { schema: 'roll-tables', name: 'Core Mechanic', label: pagesCopy('theCoreMechanic') },
  { schema: 'guides', name: 'Heat', label: pagesCopy('heat') },
  { schema: 'guides', name: 'Mech Damage', label: pagesCopy('mechDamage') },
  { schema: 'guides', name: 'Tough Choices', label: pagesCopy('toughChoices') },
  { schema: 'guides', name: 'Salvaging', label: pagesCopy('salvaging') },
]

function page(): PageResult {
  const chapters = buildChapters()
  const atTheTable = AT_THE_TABLE.flatMap(({ schema, name, label }): ContentsRow[] => {
    const href = hrefByName(schema, name)
    return href ? [{ label, href }] : []
  })

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
          <SlabSection title={pagesCopy('contents')} id="contents" as="h2" page>
            <div className="su-home__index su-front__index">
              {chapters.map((chapter) => (
                <ContentsChapter
                  key={chapter.id}
                  id={chapter.id}
                  title={chapter.title}
                  tone={chapter.tone}
                  rows={chapter.rows}
                />
              ))}
              {/* Players' own patterns, not the book's (ADR-061). */}
              <ContentsChapter
                id="homebrew"
                title={pagesCopy('homebrew')}
                tone="mech"
                rows={[{ label: pagesCopy('homebrewPatternsRow'), href: '/homebrew/' }]}
              />
              <ContentsChapter
                id="at-the-table"
                title={pagesCopy('atTheTable')}
                tone="ink"
                rows={atTheTable}
              />
            </div>
          </SlabSection>
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
