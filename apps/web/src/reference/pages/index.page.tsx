/**
 * `/` — the landing page: the manual's Contents page.
 *
 * The title, then the legacy tagline (`Tagline`): beside the title on the
 * Contents band on a desktop, under the notch on a phone. Search is the Union
 * bar's, as on every other page. Then the "Getting started" aside — the
 * shared "Start here" path and the Discord bot's button under it — and the
 * index. The index is the
 * book's chapters, each opened by its band, with their real entry counts, then
 * the rules a table reaches for
 * under an ink band. The DOM order is a phone's: "Start here", the Discord
 * button, then the index; a desktop pins the aside to a right-hand sidebar.
 */

import type { RefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { ContentsRow } from '../../components/index'
import { ChapterBand, ContentsChapter } from '../../components/index'
import { Tagline } from '../../components/Tagline'
import { buildChapters } from '../../lib/chapters'
import { DEFAULT_DESCRIPTION, DISCORD_INSTALL_URL, WEBSITE } from '../../lib/constants'
import { itemHref } from '../../lib/entityHref'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { DiscordButton, HomeStartHere } from '../HomeContents'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

/** The site's name and what this page is: there is no page name to put ahead of it. */
const TITLE = `${pageTitle()} · Salvage Union SRD and Character Manager`

/** An entity's page by name, or nothing when the dataset no longer has it. */
function hrefByName(schemaName: RefEnumSchemaName, name: string): string | undefined {
  const entity = SalvageUnionReference.findIn(schemaName, (e) => e.name === name)
  return entity ? itemHref(schemaName, getEntitySlug(entity)) : undefined
}

/** The creation guide each "Start here" step opens. */
const STEP_GUIDES = {
  pilot: 'Create a Pilot',
  mech: 'Create a Mech',
  crawler: 'Create a Crawler',
} as const

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

  const guideHrefs = {
    pilot: hrefByName('guides', STEP_GUIDES.pilot),
    mech: hrefByName('guides', STEP_GUIDES.mech),
    crawler: hrefByName('guides', STEP_GUIDES.crawler),
  }
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
        alternateName: 'Salvage Union SRD',
        description: DEFAULT_DESCRIPTION,
      },
    },
    children: (
      <div className="su-home">
        <div className="su-home__band">
          <ChapterBand
            measure={PAGE_MEASURE}
            aside={
              <div className="su-home__lede">
                <Tagline />
              </div>
            }
          >
            {pagesCopy('theSalvageUnionSrd')}
          </ChapterBand>
        </div>
        <div className="su-home__body su-page-body">
          <div className="su-home__index">
            {chapters.map((chapter) => (
              <ContentsChapter
                key={chapter.id}
                id={chapter.id}
                title={chapter.title}
                tone={chapter.tone}
                rows={chapter.rows}
                total={chapter.total}
              />
            ))}
            {/* Players' own patterns, not the book's (ADR-061): a count would go
                stale between builds, so the row has none. */}
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
          <aside className="su-home__aside" aria-label={pagesCopy('gettingStarted')}>
            <HomeStartHere guideHrefs={guideHrefs} />
            <DiscordButton installHref={DISCORD_INSTALL_URL} />
          </aside>
        </div>
      </div>
    ),
  }
}

export const indexPage: PageModule = {
  pattern: '/',
  page,
}
