/**
 * The SRD as the Workshop Manual's chapters (board 06, "the manual's contents
 * page"): Pilot Bay, Mech Workshop, Union Crawler, Denizens of the Wasteland,
 * and Rules & Reference. Each chapter is one or more of the dataset's catalog
 * categories (`catalog-categories.json`) under the book's own chapter name and
 * colour (ruleset, "The book's colour map").
 *
 * One source for three surfaces: the home page's index, the nav drawer
 * (frozen into `src/generated/navCatalog.ts` by `ssg/genNavCatalog.ts`) and
 * the chapter band a listing or entity page wears. The breadcrumb trail skips
 * the chapter: it runs SRD // listing // entry ("SRD // Chassis // Gopher"),
 * since the chapters are the home page's own groupings.
 *
 * Reads the ORM: call it only after `SalvageUnionReference.preload('all')`
 * (srd's build-time `gameData` import does that). Never import it from an
 * island — the drawer reads the frozen copy instead.
 */

import type { RefEntity } from 'salvageunion-reference'
import {
  entityTone,
  getModel,
  getSchemaCatalog,
  isSchemaName,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { ChapterTone } from '../components/index'
import { schemaHref } from './entityHref'
import { listingEntries } from './listingEntries'

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
    // The adversary brown its entities' cards wear (owner's call, 2026-10-20).
    tone: 'adversary',
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
type ChapterRow = {
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
      // The listing's count: the roll tables count only the ones they list.
      const model = getModel(schemaId)
      const count = model ? listingEntries(schemaId, model.all()).length : schema.itemCount
      return [
        {
          schemaId,
          label: schema.displayNamePlural,
          href: schemaHref(schemaId),
          count,
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

/** The five chapters by name, colour and anchor: no entry counts, so no ORM read. */
export const CHAPTER_REFS: readonly ChapterRef[] = CHAPTER_DEFINITIONS.map(
  ({ id, title, tone }) => ({
    id,
    title,
    tone,
    href: `/#${id}`,
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
  if (!definition) return CONTENTS
  const { id, title, tone } = definition
  return { id, title, tone, href: `/#${id}` }
}

/**
 * A show page's band colour when it wears its own rather than its chapter's:
 * the head band (`ChapterBand`'s `fill`), which the page's one footer wears
 * too (`footerMatchCss`: the same ground, owner's call 2026-10-19).
 */
export type BandFill = {
  band: string
}

/**
 * An ability's tier tone (`entityTone`) as its page's band: the colour its Compact
 * wears on the abilities index, so the two cannot disagree. Legendary pink is
 * the deeper crawler band, as the Compact paints it (it carries paper); Core is
 * the chapter's own orange (`undefined`).
 */
function abilityBandFill(entity: RefEntity): BandFill | undefined {
  const tone = entityTone('abilities', entity)
  if (tone === 'pilot') return undefined
  const band = tone === 'crawler' ? 'var(--color-crawler-band)' : `var(--color-${tone})`
  return { band }
}

/**
 * The schemas whose show page wears its tech level's blue: systems and
 * modules, the one place the book sets TL blue as a ground (ruleset §3.8, book
 * pp. 162, 188), whose listings wear TL1's.
 */
const TECH_LEVEL_BAND_SCHEMAS: ReadonlySet<string> = new Set(['systems', 'modules'])

/**
 * The listings that wear TL1's blue: systems and modules, whose pages wear
 * their tech level's, and drones, whose cards' heads are tech-level blue
 * (owner, 2026-10-20: "Drone header should be blue to match drones").
 */
const TECH_LEVEL_LISTING_SCHEMAS: ReadonlySet<string> = new Set([
  ...TECH_LEVEL_BAND_SCHEMAS,
  'drones',
])

/**
 * A listing's band when not its chapter's: TL1's blue on the tech-level
 * listings (owner's calls 2026-10-20). Every other listing wears its
 * chapter's band (`undefined`).
 */
export function listingBandFillFor(schemaId: string): BandFill | undefined {
  return TECH_LEVEL_LISTING_SCHEMAS.has(schemaId) ? { band: 'var(--color-tl-1)' } : undefined
}

/**
 * The bands a show page wears when not its chapter's: the entity's own tone
 * (`entityTone`), the colour its card's header and Compact wear, head and foot
 * (owner, round 4: "fix the band colors to always match the entity"). Gear
 * (systems, modules, drones, equipment, vehicles) wears its tech level's
 * colour; a Hybrid Class its brown; an ability its tier's colour (E12);
 * a creation guide its entity's colour, Heat its red (`guideTone`).
 * Every other page wears its chapter's band from the colour map
 * (`undefined`); a listing's is `listingBandFillFor`.
 */
export function bandFillFor(schemaId: string, entity: RefEntity): BandFill | undefined {
  if (schemaId === 'abilities') return abilityBandFill(entity)
  if (!isSchemaName(schemaId)) return undefined
  const tone = entityTone(schemaId, entity)
  const own = tone.startsWith('tl-') || tone === 'tier-hybrid' || tone === 'class-hybrid'
  // A guide that is not rules blue: a creation guide's entity, Heat's red.
  const guide = schemaId === 'guides' && tone !== 'wk-line'
  if (own || guide) return { band: `var(--color-${tone})` }
  return undefined
}
