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
import {
  ChapterBand,
  ContentsChapter,
  capsLabel,
  SlabSection,
  TitledBox,
} from '../../components/index'
import { Tagline } from '../../components/Tagline'
import { buildChapters } from '../../lib/chapters'
import { DEFAULT_DESCRIPTION, DISCORD_INSTALL_URL, WEBSITE } from '../../lib/constants'
import { itemHref } from '../../lib/entityHref'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { DiscordButton } from '../HomeContents'
// MOCK (front): the home page as a product page.
import { BuyTheGame, HomeDoors, HomeHero } from '../HomeFront'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

/** The site's name and what this page is: there is no page name to put ahead of it. */
const TITLE = `${pageTitle()} · Salvage Union SRD and Character Manager`

/** MOCK (front): the kicker, brand caps, as the app's front doors set theirs. */
const KICKER_CAPS = capsLabel({ size: 'caption', tracking: 'eyebrow' })

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

  const entries = chapters.reduce((sum, chapter) => sum + chapter.total, 0)
  const books = SalvageUnionReference.Sources.all().map((source) => source.name)
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
    // MOCK (front): the home page sells the site, then is its Contents page.
    // The band is the hero (the site's name notched in, what it is as the
    // kicker); under it the pitch, what's inside and the art plate; then the
    // three doors, the book's Contents, and Buy the game.
    children: (
      <div className="su-home su-front">
        <div className="su-home__band">
          <ChapterBand
            measure={PAGE_MEASURE}
            eyebrow={<span className={KICKER_CAPS}>{'Reference // Build // Play'}</span>}
            aside={
              <div className="su-home__lede">
                <Tagline />
              </div>
            }
          >
            SalvageUnion.io
          </ChapterBand>
        </div>
        <div className="su-front__body su-page-body">
          <HomeHero />
          <HomeDoors />
          <SlabSection title="Contents" id="contents" as="h2" page count={`${entries} entries`}>
            <div className="su-home__index su-front__index">
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
          <div className="su-front__close">
            <BuyTheGame books={books} />
            <TitledBox
              title="In your server"
              titleAs="h2"
              tone="discord"
              as="section"
              bodyClassName="su-front__bot"
            >
              <p>
                The SalvageUnion.io bot looks up any rule and rolls on any table, right in your
                Discord channel. A Game can post its rolls there too.
              </p>
              <DiscordButton installHref={DISCORD_INSTALL_URL} />
            </TitledBox>
          </div>
        </div>
      </div>
    ),
  }
}

export const indexPage: PageModule = {
  pattern: '/',
  page,
}
