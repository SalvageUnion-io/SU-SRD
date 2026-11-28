/**
 * The SRD as the Workshop Manual's chapters ("the manual's contents page"):
 * Pilot Bay, Mech Workshop, Union Crawler, Denizens of the Wasteland,
 * and Rules & Reference. Each chapter is one or more of the dataset's catalog
 * categories (`catalog-categories.json`) under the book's own chapter name and
 * colour (ruleset, "The book's colour map").
 *
 * One source for three surfaces: the home page's index, the nav drawer
 * (frozen into `src/generated/navCatalog.ts` by `astro/build/genNavCatalog.ts`) and
 * the chapter band a listing or entity page wears. The breadcrumb trail skips
 * the chapter: it runs SRD // listing // entry ("SRD // Chassis // Gopher"),
 * since the chapters are the home page's own groupings.
 *
 * Reads the ORM: call it only after `SalvageUnionReference.preload('all')`
 * (the reference site's build-time `gameData` import does that). Never import it from an
 * island — the drawer reads the frozen copy instead.
 */

import type { RefEntity } from 'salvageunion-reference'
import {
  entityTone,
  getSchemaCatalog,
  isSchemaName,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { ChapterTone } from '../components/index'
import { libCopy } from '../messages/lib'
import { schemaHref } from './entityHref'

type ChapterDefinition = {
  /** The chapter's anchor on the Reference's Contents (`/reference/#mech-workshop`). */
  id: string
  /** The chapter's own page (`/mechs/`): its band, then its every listing. */
  path: string
  /** The book's chapter name. */
  title: string
  /** The chapter band's colour (ruleset, "The book's colour map"). */
  tone: ChapterTone
  /** The dataset's catalog categories this chapter gathers, in order. */
  categories: string[]
  /**
   * Schemas to lead with, ahead of the categories' own order. Rules &
   * Reference leads with what a table reaches for mid-game.
   */
  lead?: string[]
}

const CHAPTER_DEFINITIONS: readonly ChapterDefinition[] = [
  {
    id: 'pilot-bay',
    path: 'pilots',
    title: libCopy('pilotBay'),
    tone: 'pilot',
    categories: ['pilot'],
  },
  {
    id: 'mech-workshop',
    path: 'mechs',
    title: libCopy('mechWorkshop'),
    tone: 'mech',
    categories: ['mech'],
  },
  {
    id: 'union-crawler',
    path: 'union-crawler',
    title: libCopy('unionCrawler'),
    tone: 'crawler',
    categories: ['crawler'],
  },
  {
    id: 'denizens',
    path: 'wasteland',
    title: libCopy('denizensOfTheWasteland'),
    // The adversary brown its entities' cards wear.
    tone: 'adversary',
    categories: ['denizens'],
  },
  {
    id: 'rules-reference',
    path: 'rules',
    title: 'Rules & Reference',
    tone: 'rules',
    categories: ['guides', 'reference'],
    lead: ['guides', 'roll-tables', 'keywords', 'traits'],
  },
]

/** One row of a chapter: a schema's listing. */
type ChapterRow = {
  schemaId: string
  label: string
  href: string
}

export type SrdChapter = {
  id: string
  title: string
  tone: ChapterTone
  /** The chapter's own page (`/mechs/`). */
  href: string
  rows: ChapterRow[]
}

/** The chapters, each with its schemas' listings. */
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
      return [{ schemaId, label: schema.displayNamePlural, href: schemaHref(schemaId) }]
    })

    return {
      id: definition.id,
      title: definition.title,
      tone: definition.tone,
      href: chapterHref(definition.path),
      rows,
    }
  })
}

/** A chapter's own page. */
const chapterHref = (path: string): string => `/${path}/`

/** What a page needs to know about the chapter it sits in. */
export type ChapterRef = Pick<SrdChapter, 'id' | 'title' | 'tone' | 'href'>

/** The five chapters by name, colour and anchor: no catalog, so no ORM read. */
export const CHAPTER_REFS: readonly ChapterRef[] = CHAPTER_DEFINITIONS.map(
  ({ id, path, title, tone }) => ({
    id,
    title,
    tone,
    href: chapterHref(path),
  })
)

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
  return CHAPTER_REFS.find((ref) => ref.id === definition?.id) ?? CONTENTS
}

/**
 * The sub-navigation entry (`sections`, its hrefs) a Reference page sits
 * under: the entry its address starts in (a guide under Guides), else its
 * kind's chapter (a chassis under Mech Workshop). None for a page in no
 * section (the home, the changelog).
 */
export function sectionHrefFor(pathname: string, sections: readonly string[]): string | undefined {
  const first = pathname.split('/').filter(Boolean)[0]
  if (!first) return undefined
  const own = `/${first}/`
  if (sections.includes(own)) return own
  const chapter = chapterForSchema(first)
  return chapter === CONTENTS || !sections.includes(chapter.href) ? undefined : chapter.href
}

/**
 * An ability's tier tone (`entityTone`) as its page's band: the colour its Compact
 * wears on the abilities index, so the two cannot disagree. Legendary pink is
 * the deeper crawler band, as the Compact paints it (it carries paper); Core is
 * the chapter's own orange (`undefined`).
 */
function abilityBandFill(entity: RefEntity): string | undefined {
  const tone = entityTone('abilities', entity)
  if (tone === 'pilot') return undefined
  return tone === 'crawler' ? 'var(--color-crawler-band)' : `var(--color-${tone})`
}

/**
 * The listings that wear TL1's blue: systems and modules, the one place the
 * book sets TL blue as a ground (ruleset §3.8, book pp. 162, 188), and drones,
 * whose cards' heads are tech-level blue (R44). Pilot equipment wears its
 * chapter's orange, as its cards do.
 */
const TECH_LEVEL_LISTING_SCHEMAS: ReadonlySet<string> = new Set(['systems', 'modules', 'drones'])

/**
 * A listing's band when not its chapter's: TL1's blue on the tech-level
 * listings. Every other listing wears its
 * chapter's band (`undefined`).
 */
export function listingBandFillFor(schemaId: string): string | undefined {
  return TECH_LEVEL_LISTING_SCHEMAS.has(schemaId) ? 'var(--color-tl-1)' : undefined
}

/**
 * The bands a show page wears when not its chapter's: the entity's own tone
 * (`entityTone`), the colour its card's header and Compact wear, head and foot
 * (R44: a Page's band wears its entity). Gear
 * (systems, modules, drones, vehicles) wears its tech level's
 * colour; a Hybrid Class the tier rust; an ability its tier's colour (E12);
 * a creation guide its entity's colour, Heat its red (`guideTone`).
 * Every other page wears its chapter's band from the colour map
 * (`undefined`); a listing's is `listingBandFillFor`.
 */
export function bandFillFor(schemaId: string, entity: RefEntity): string | undefined {
  if (schemaId === 'abilities') return abilityBandFill(entity)
  if (!isSchemaName(schemaId)) return undefined
  const tone = entityTone(schemaId, entity)
  const own = tone.startsWith('tl-') || tone === 'tier-hybrid'
  // A guide that is not rules blue: a creation guide's entity, Heat's red.
  const guide = schemaId === 'guides' && tone !== 'wk-line'
  if (own || guide) return `var(--color-${tone})`
  return undefined
}
