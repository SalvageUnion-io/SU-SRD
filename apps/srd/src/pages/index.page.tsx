/**
 * `/` — the landing page: the manual's Contents page (board 06).
 *
 * Search first, in the blue Contents band beside the title; then the book's
 * chapters as an index with their real entry counts; and beside them the "New
 * to the Union?" path into ITUN and the rules a table reaches for. The band's
 * search is the page's search, so the Union bar carries none here.
 */

import { ChapterBand } from 'component-lib'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { PageModule, PageResult } from '../../ssg/types'
import { HeroSearchStatic } from '../components/HeroSearch'
import type { AtTheTableLink, NewToTheUnionStep } from '../components/HomeContents'
import { AtTheTable, ContentsChapter, NewToTheUnion } from '../components/HomeContents'
import { buildChapters } from '../lib/chapters'
import { ITUN_URL, SITE_URL } from '../lib/constants'
import { itemHref } from '../lib/entityHref'
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

/** The three creation guides, in the order a new crew walks them. */
const STEPS: { guide: string; meta: string }[] = [
  { guide: 'Create a Pilot', meta: 'Pilot Bay · Classes · Keepsake' },
  { guide: 'Create a Mech', meta: 'Mech Workshop · Chassis · Systems' },
  { guide: 'Create a Crawler', meta: 'Union Crawler · Type · Bays' },
]

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

  const steps = STEPS.flatMap(({ guide, meta }): NewToTheUnionStep[] => {
    const href = hrefByName('guides', guide)
    return href ? [{ title: guide, meta, href }] : []
  })
  const atTheTable = AT_THE_TABLE.flatMap(({ schema, name, label }): AtTheTableLink[] => {
    const href = hrefByName(schema, name)
    return href ? [{ label, href }] : []
  })

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
          <div className="srd-home__chapters">
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
          </div>
          <aside className="srd-home__aside" aria-label="Getting started">
            <NewToTheUnion steps={steps} buildHref={ITUN_URL} />
            <AtTheTable links={atTheTable} />
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
