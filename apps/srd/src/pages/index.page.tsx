/**
 * `/` — the landing page: the manual's Contents page (board 06).
 *
 * The title, then search: beside the title on the blue Contents band on a
 * desktop, under the notch on a phone. Then the "Getting started" aside — the
 * shared "Start here" path, into ITUN — the index, and the Discord bot. The
 * index is the book's chapters, each opened by its band and a piece of its
 * artwork, with their real entry counts, then the rules a table reaches for
 * under an ink band. The DOM order is a phone's: "Start here", the
 * index, then the Discord bot; a desktop pins the aside and the bot to a
 * right-hand sidebar.
 * The band's search is the page's search, so the Union bar carries none here.
 */

import { assetSrcSetFor, ChapterBand } from 'component-lib'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { getAssetUrl, getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { PageModule, PageResult } from '../../ssg/types'
import { HeroSearchStatic } from '../components/HeroSearch'
import type { ContentsArt, ContentsRow } from '../components/HomeContents'
import { ContentsChapter, DiscordBot, HomeStartHere } from '../components/HomeContents'
import { STARTER_SET_HREF } from '../lib/buildLink'
import { buildChapters } from '../lib/chapters'
import { DISCORD_INSTALL_URL, ITUN_URL, SITE_URL } from '../lib/constants'
import { itemHref } from '../lib/entityHref'
import { SCREEN_HREF } from '../lib/screenPage'
import '../lib/gameData'
import { Island } from '../runtime/Island'

const TITLE = 'Salvage Union System Reference Document'
const DESCRIPTION =
  'System Reference Document (SRD) for the Salvage Union TTRPG. Complete reference guide with chassis, systems, modules, abilities, and more.'

/** The page's measure (board 06): the band, the index and the panels share it. */
const MEASURE = '85rem'

/** An entity's page by name, or nothing when the dataset no longer has it. */
function hrefByName(schemaName: SURefEnumSchemaName, name: string): string | undefined {
  const entity = SalvageUnionReference.findIn(schemaName, (e) => e.name === name)
  return entity ? itemHref(schemaName, getEntitySlug(entity)) : undefined
}

/**
 * Each chapter's opener artwork, from su-assets, by the entity it illustrates.
 * Union Crawler has none: no crawler carries artwork yet (`hasArtwork`), so
 * its chapter opens on its band alone, as Rules & Reference does.
 */
const CHAPTER_ART: Partial<Record<string, { schema: SURefEnumSchemaName; name: string }>> = {
  'pilot-bay': { schema: 'classes', name: 'Hacker' },
  'mech-workshop': { schema: 'chassis', name: 'Mule' },
  denizens: { schema: 'bio-titans', name: 'Tyrant' },
}

/** A chapter's opener artwork, or nothing when the entity or its artwork is gone. */
function chapterArt(chapterId: string): ContentsArt | undefined {
  const piece = CHAPTER_ART[chapterId]
  if (!piece) return undefined
  const entity = SalvageUnionReference.findIn(piece.schema, (e) => e.name === piece.name)
  const src = entity ? getAssetUrl(entity) : undefined
  return src ? { src, srcSet: assetSrcSetFor(src) } : undefined
}

/** The creation guide each "Start here" step opens. */
const STEP_GUIDES = {
  pilot: 'Create a Pilot',
  mech: 'Create a Mech',
  crawler: 'Create a Crawler',
} as const

/** The rules a table reaches for mid-session (board 06, "At the table"). */
const AT_THE_TABLE: { schema: SURefEnumSchemaName; name: string; label: string }[] = [
  { schema: 'roll-tables', name: 'Core Mechanic', label: 'The Core Mechanic' },
  { schema: 'guides', name: 'Heat', label: 'Heat' },
  { schema: 'guides', name: 'Mech Damage', label: 'Mech Damage' },
  { schema: 'guides', name: 'Tough Choices', label: 'Tough Choices' },
  { schema: 'guides', name: 'Salvaging', label: 'Salvaging' },
]

function page(): PageResult {
  const chapters = buildChapters()

  const guideHrefs = {
    pilot: hrefByName('guides', STEP_GUIDES.pilot),
    mech: hrefByName('guides', STEP_GUIDES.mech),
    crawler: hrefByName('guides', STEP_GUIDES.crawler),
  }
  // The Mediator Screen first: every one of these on one page, rolled in place.
  const atTheTable: ContentsRow[] = [
    { label: 'Mediator Screen', href: SCREEN_HREF },
    ...AT_THE_TABLE.flatMap(({ schema, name, label }): ContentsRow[] => {
      const href = hrefByName(schema, name)
      return href ? [{ label, href }] : []
    }),
  ]

  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: TITLE,
        url: SITE_URL,
      },
    },
    children: (
      <div className="srd-home">
        <div className="srd-home__band">
          <ChapterBand
            measure={MEASURE}
            aside={
              <div className="srd-home__lede">
                <p>
                  The Salvage Union System Reference Document. Every chassis, ability, crawler and
                  denizen from the Workshop Manual, searchable and linkable.
                </p>
                <Island name="SearchIsland" client="idle" ssr props={{ variant: 'hero' }}>
                  <HeroSearchStatic />
                </Island>
              </div>
            }
          >
            The Salvage Union SRD
          </ChapterBand>
        </div>
        <div className="srd-home__body" style={{ maxWidth: MEASURE }}>
          <aside className="srd-home__aside" aria-label="Getting started">
            <HomeStartHere
              guideHrefs={guideHrefs}
              buildHref={ITUN_URL}
              starterSetHref={STARTER_SET_HREF}
            />
          </aside>
          <div className="srd-home__index">
            {chapters.map((chapter) => (
              <ContentsChapter
                key={chapter.id}
                id={chapter.id}
                title={chapter.title}
                tone={chapter.tone}
                rows={chapter.rows}
                total={chapter.total}
                art={chapterArt(chapter.id)}
              />
            ))}
            <ContentsChapter id="at-the-table" title="At the table" tone="ink" rows={atTheTable} />
          </div>
          <div className="srd-home__discord">
            <DiscordBot installHref={DISCORD_INSTALL_URL} aboutHref="/discord/" />
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
