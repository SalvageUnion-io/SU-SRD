/**
 * `/reference/` — the Reference's home: the book's Contents, each chapter
 * opened by its band, then Homebrew and the rules a table reaches for under
 * an ink band. The site's home (`/`) is its front door; this is where the
 * header's Reference link and the area rail's chapters land.
 * Server-rendered and static: every row is a plain link.
 */

import type { RefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { ContentsRow } from '../../components/index'
import { ChapterBand, ContentsChapter } from '../../components/index'
import { buildChapters } from '../../lib/chapters'
import { SITE_URL, WEBSITE } from '../../lib/constants'
import { itemHref } from '../../lib/entityHref'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

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
  const title = pageTitle(pagesCopy('referenceHome'))
  const description = pagesCopy('referenceHomeDescription')
  const url = `${SITE_URL}/reference/`

  return {
    meta: {
      title,
      description,
      canonical: url,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url,
        isPartOf: WEBSITE,
      },
    },
    children: (
      <div className="su-front">
        <ChapterBand measure={PAGE_MEASURE}>{pagesCopy('referenceHome')}</ChapterBand>
        <div className="su-front__body su-page-body">
          <section id="contents" aria-label={pagesCopy('contents')}>
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
          </section>
        </div>
      </div>
    ),
  }
}

export const referenceHomePage: PageModule = {
  pattern: '/reference',
  page,
}
