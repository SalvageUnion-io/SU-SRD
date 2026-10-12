/**
 * The SRD as the Workshop Manual's chapters (board 06, "the manual's contents
 * page"): Pilot Bay, Mech Workshop, Union Crawler, Denizens of the Wasteland,
 * and Rules & Reference. Each chapter is one or more of the dataset's catalog
 * categories (`catalog-categories.json`) under the book's own chapter name and
 * colour (ruleset, "The book's colour map").
 *
 * One source for four surfaces: the home page's index, the nav drawer
 * (frozen into `src/generated/navCatalog.ts` by `ssg/genNavCatalog.ts`), the
 * chapter band a listing or entity page wears, and the breadcrumb trail
 * ("Contents / Mech Workshop / Chassis / Gopher").
 *
 * Reads the ORM: call it only after `SalvageUnionReference.preload('all')`
 * (srd's build-time `gameData` import does that). Never import it from an
 * island — the drawer reads the frozen copy instead.
 */

import type { ChapterTone } from 'component-lib'
import type { SURefEntity } from 'salvageunion-reference'
import { getSchemaCatalog, getTechLevel, SalvageUnionReference } from 'salvageunion-reference'
import { schemaHref } from './entityHref'

type ChapterDefinition = {
  /** The home page's anchor for the chapter (`/#mech-workshop`). */
  id: string
  /** The book's chapter name. */
  title: string
  /** The chapter band's colour (ruleset, "The book's colour map"). */
  tone: ChapterTone
  /** The dataset's catalog categories this chapter gathers, in order. */
  categories: string[]
  /**
   * Schemas to lead with, ahead of the categories' own order. Rules &
   * Reference leads with what a table reaches for mid-game (board 06).
   */
  lead?: string[]
}

const CHAPTER_DEFINITIONS: readonly ChapterDefinition[] = [
  { id: 'pilot-bay', title: 'Pilot Bay', tone: 'pilot', categories: ['pilot'] },
  { id: 'mech-workshop', title: 'Mech Workshop', tone: 'mech', categories: ['mech'] },
  { id: 'union-crawler', title: 'Union Crawler', tone: 'crawler', categories: ['crawler'] },
  {
    id: 'denizens',
    title: 'Denizens of the Wasteland',
    tone: 'denizen',
    categories: ['denizens'],
  },
  {
    id: 'rules-reference',
    title: 'Rules & Reference',
    tone: 'rules',
    categories: ['guides', 'reference'],
    lead: ['guides', 'roll-tables', 'keywords', 'traits'],
  },
]

/** One row of a chapter: a schema's listing and how many entries it holds. */
export type ChapterRow = {
  schemaId: string
  label: string
  href: string
  count: number
}

export type SrdChapter = {
  id: string
  title: string
  tone: ChapterTone
  /** The chapter's anchor on the home page. */
  href: string
  rows: ChapterRow[]
  /** Every entry in the chapter. */
  total: number
}

/** The chapters, each with its schemas' real entry counts. */
export function buildChapters(): SrdChapter[] {
  const categories = SalvageUnionReference.CatalogCategories.all()
  const schemas = new Map(getSchemaCatalog().schemas.map((schema) => [schema.id, schema]))

  return CHAPTER_DEFINITIONS.map((definition) => {
    const ids = definition.categories.flatMap(
      (categoryId) => categories.find((category) => category.id === categoryId)?.schemas ?? []
    )
    const lead = definition.lead ?? []
    const rank = (id: string) => {
      const index = lead.indexOf(id)
      return index === -1 ? lead.length : index
    }
    const ordered = ids
      .map((id, index) => ({ id, index }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.index - b.index)
      .map(({ id }) => id)

    const rows = ordered.flatMap((schemaId): ChapterRow[] => {
      const schema = schemas.get(schemaId)
      if (!schema) return []
      return [
        {
          schemaId,
          label: schema.displayNamePlural,
          href: schemaHref(schemaId),
          count: schema.itemCount,
        },
      ]
    })

    return {
      id: definition.id,
      title: definition.title,
      tone: definition.tone,
      href: `/#${definition.id}`,
      rows,
      total: rows.reduce((sum, row) => sum + row.count, 0),
    }
  })
}

/** What a page needs to know about the chapter it sits in. */
export type ChapterRef = Pick<SrdChapter, 'id' | 'title' | 'tone' | 'href'>

/** The Contents chapter: the home page, and anything no chapter claims. */
export const CONTENTS: ChapterRef = {
  id: 'contents',
  title: 'Contents',
  tone: 'rules',
  href: '/',
}

/**
 * The chapter a schema belongs to — for the band a listing or entity page
 * wears and its breadcrumb. A schema no chapter gathers (a meta schema) falls
 * back to Rules & Reference's blue, as the book's Contents would.
 */
export function chapterForSchema(schemaId: string): ChapterRef {
  const categories = SalvageUnionReference.CatalogCategories.all()
  const definition = CHAPTER_DEFINITIONS.find((chapter) =>
    chapter.categories.some((categoryId) =>
      categories
        .find((category) => category.id === categoryId)
        ?.schemas.some((id) => id === schemaId)
    )
  )
  if (!definition) return CONTENTS
  const { id, title, tone } = definition
  return { id, title, tone, href: `/#${id}` }
}

/** A show page's band colours when it wears its own rather than its chapter's. */
export type BandFill = {
  /** The head band (`ChapterBand`'s `fill`). */
  band: string
  /** The foot band (`ChapterFoot`'s `fill`): the band, or its text-bearing shade. */
  foot: string
}

/** The schemas whose show pages wear the entity's tech-level blue. */
const TECH_LEVEL_PAGES: ReadonlySet<string> = new Set(['systems', 'modules'])

/**
 * Tech level 3's blue carries neither ink (4.0:1) nor paper (3.8:1) at 4.5:1,
 * so the foot band, which carries the citation, takes tech level 4's beneath it
 * (as a Union Crawler foot takes the deeper `crawlerBand`).
 */
const FOOT_SHADE: Partial<Record<string, string>> = {
  'var(--color-tl-3)': 'var(--color-tl-4)',
}

/**
 * The bands a system's or module's show page wears: its tech level's blue,
 * head and foot, as its card's header does. Every other page, the listings
 * included, wears its chapter's band (`undefined`).
 */
export function bandFillFor(schemaId: string, entity: SURefEntity): BandFill | undefined {
  if (!TECH_LEVEL_PAGES.has(schemaId)) return undefined
  const techLevel = getTechLevel(entity)
  if (techLevel == null) return undefined
  const band = `var(--color-tl-${String(techLevel).toLowerCase()})`
  return { band, foot: FOOT_SHADE[band] ?? band }
}
