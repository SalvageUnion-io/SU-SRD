/**
 * A chapter's own page (`/pilots/`, `/mechs/`, `/union-crawler/`,
 * `/wasteland/`, `/rules/`): the chapter's band in its colour, with the
 * tagline every landing page says, then every listing the chapter gathers
 * (`lib/chapters.ts`) as a section of the Contents: the listing first, then
 * each of its entries. The area rail's chapters land here. Server-rendered
 * and static: every row is a plain link.
 */

import type { RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import {
  getEntitySlug,
  getTechLevel,
  getTechLevelNumber,
  getTree,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { ContentsGroup, ContentsRow } from '../../components/index'
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
import type { TechLevel } from '../../lib/listingGroups'
import { groupEntities, resolveGroupBy } from '../../lib/listingGroups'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import type { PageModule, PageResult } from '../types'
import '../../lib/gameData'

/** A big list breaks up under sub-heads (more than this many rows). */
const GROUP_FROM = 24

/**
 * A listing's entries by name, under sub-heads where the list is big: the
 * listing page's own groups (tech level in the book's order, tree, kind, bay;
 * `listingGroups.ts`), else by first letter. Its title links the listing.
 */
function listingGroups(schemaId: string): ContentsGroup[] {
  const all = SalvageUnionReference.findAllIn(
    schemaId as RefEnumSchemaName,
    () => true
  ) as RefEntity[]
  const seen = new Set<string>()
  const items = listingEntries(schemaId, all).filter((entity) => {
    const href = itemHref(schemaId, getEntitySlug(entity))
    return !seen.has(href) && seen.add(href)
  })
  const row = (entity: RefEntity): ContentsRow => ({
    label: entity.name,
    href: itemHref(schemaId, getEntitySlug(entity)),
  })
  const byName = (list: RefEntity[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name)).map(row)
  // A short list whose every entry has a tech level (the crawler's own) runs
  // in tech-level order, as the book sets it.
  const byLevel = (list: RefEntity[]) =>
    [...list]
      .sort(
        (a, b) =>
          (getTechLevelNumber(a) ?? 0) - (getTechLevelNumber(b) ?? 0) ||
          a.name.localeCompare(b.name)
      )
      .map(row)
  if (items.length <= GROUP_FROM) {
    const levelled = items.every((entity) => getTechLevelNumber(entity) != null)
    return [{ label: '', rows: levelled ? byLevel(items) : byName(items) }]
  }
  const trees = [...new Set(items.map(getTree).filter((t): t is string => typeof t === 'string'))]
  const levels = [...new Set(items.map(getTechLevel).filter((tl) => tl != null))] as TechLevel[]
  const groupBy = resolveGroupBy(items, trees, levels, schemaId)
  if (groupBy !== 'none') {
    return groupEntities(items, groupBy).map((group) => ({
      label: group.label ?? '',
      rows: byName(group.items),
    }))
  }
  const letters = new Map<string, RefEntity[]>()
  for (const entity of items) {
    const letter = entity.name.charAt(0).toUpperCase()
    letters.set(letter, [...(letters.get(letter) ?? []), entity])
  }
  return [...letters.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, list]) => ({ label, rows: byName(list) }))
}

/** A listing's rows for its Contents section: plain, or under sub-heads. */
function chapterRows(schemaId: string): { rows: ContentsRow[]; groups?: ContentsGroup[] } {
  const groups = listingGroups(schemaId)
  const [only] = groups
  return groups.length === 1 && only && only.label === ''
    ? { rows: only.rows }
    : { rows: [], groups }
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

  const listed = chapter.rows.map((row) => ({ ...row, list: chapterRows(row.schemaId) }))
  const small = listed.filter((row) => !row.list.groups)
  const big = listed.filter((row) => row.list.groups)

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
          {/* One newspaper flow down the page's columns: the short lists
              first, the big ones under them, breaking on to the next column
              between their runs, so the columns stand level with no gutter
              left empty. */}
          <div className="su-chapter-flow">
            {[...small, ...big].map((row) => (
              <ContentsChapter
                key={row.schemaId}
                id={row.schemaId}
                title={row.label}
                tone={chapter.tone}
                href={row.href}
                {...row.list}
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
