/**
 * A chapter's own page (`/pilots/`, `/mechs/`, `/union-crawler/`,
 * `/wasteland/`, `/rules/`): the chapter's band in its colour, with the
 * tagline every landing page says, then every listing the chapter gathers
 * (`lib/chapters.ts`) as a section of the Contents: the listing first, then
 * each of its entries. The area rail's chapters land here. Server-rendered
 * and static: every row is a plain link.
 */

import type { RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import type { ContentsRow } from '../../components/index'
import {
  BreadcrumbTrail,
  ChapterBand,
  ChapterBandTrail,
  ContentsChapter,
} from '../../components/index'
import { Tagline } from '../../components/Tagline'
import type { SrdChapter } from '../../lib/chapters'
import { buildChapters } from '../../lib/chapters'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { itemHref } from '../../lib/entityHref'
import { listingEntries } from '../../lib/listingEntries'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

/** A listing's rows: the listing itself, then its entries by name. */
function listingRows(schemaId: string, label: string, href: string): ContentsRow[] {
  const all = SalvageUnionReference.findAllIn(
    schemaId as RefEnumSchemaName,
    () => true
  ) as RefEntity[]
  const entries = listingEntries(schemaId, all)
    .map((entity) => ({ label: entity.name, href: itemHref(schemaId, getEntitySlug(entity)) }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const seen = new Set<string>()
  const unique = entries.filter((row) => !seen.has(row.href) && seen.add(row.href))
  return [{ label: pagesCopy('chapterAllOf', { listing: label }), href }, ...unique]
}

function chapterPage(chapterId: string): PageResult {
  const chapter = buildChapters().find((c) => c.id === chapterId) as SrdChapter
  const title = pageTitle(chapter.title)
  const description = pagesCopy('chapterDescription', {
    chapter: chapter.title,
    listings: chapter.rows.map((row) => row.label).join(', '),
  })
  const url = `${SITE_URL}${chapter.href}`
  const trail = [
    { name: SRD_CRUMB.name, url: '/reference/' },
    { name: chapter.title, url: chapter.href },
  ]

  return {
    meta: {
      title,
      description,
      canonical: url,
      preloadScriptFont: true,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url,
        isPartOf: WEBSITE,
      },
      breadcrumbs: [SRD_CRUMB, { name: chapter.title, url }],
    },
    children: (
      <div className="su-front">
        <ChapterBandTrail.Provider value={<BreadcrumbTrail breadcrumbs={trail} placement="band" />}>
          <ChapterBand
            tone={chapter.tone}
            measure={PAGE_MEASURE}
            asideAt="notch"
            aside={<Tagline />}
          >
            {chapter.title}
          </ChapterBand>
        </ChapterBandTrail.Provider>
        <div className="su-front__body su-page-body">
          <div className="su-home__index su-front__index">
            {chapter.rows.map((row) => (
              <ContentsChapter
                key={row.schemaId}
                id={row.schemaId}
                title={row.label}
                tone={chapter.tone}
                rows={listingRows(row.schemaId, row.label, row.href)}
              />
            ))}
          </div>
        </div>
      </div>
    ),
  }
}

/** One page module per chapter, each a fixed route its shell names. */
const chapterModule = (id: string, path: string): PageModule => ({
  pattern: `/${path}`,
  page: () => chapterPage(id),
})

export const pilotBayPage = chapterModule('pilot-bay', 'pilots')
export const mechWorkshopPage = chapterModule('mech-workshop', 'mechs')
export const unionCrawlerPage = chapterModule('union-crawler', 'union-crawler')
export const denizensPage = chapterModule('denizens', 'wasteland')
export const rulesReferencePage = chapterModule('rules-reference', 'rules')
