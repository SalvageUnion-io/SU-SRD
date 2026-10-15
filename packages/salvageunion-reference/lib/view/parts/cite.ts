/**
 * An entity's CITATION: the book, booklet and page it is printed on, and its
 * reprints. A cite written in an app (a wizard step's rule, a blocked
 * control's brief) comes here too, as `{ source, page }`, through `formatCite`.
 */

import { getBooklet, getPageReference, getSource } from '../../entityFields'
import type { RefMetaEntity, RefObjectAnyPattern } from '../../schemas/index'
import type { EntityCite, EntityPrinting } from '../types'

/**
 * The core book: the `source` the data records, the name a cite prints (its
 * title page, p.1, reads "Workshop Manual"), and the other names players call
 * it by. An alias resolves to the book; it is never printed.
 */
const CORE_BOOK = {
  source: 'Salvage Union Workshop Manual',
  name: 'Workshop Manual',
  aliases: ['Core Book'],
} as const

/** The name a cite prints for a book: the core book's one name, else the source as given. */
export function bookName(source: string): string {
  const key = source.trim().toLowerCase()
  const core = [CORE_BOOK.source, CORE_BOOK.name, ...CORE_BOOK.aliases]
  return core.some((name) => name.toLowerCase() === key) ? CORE_BOOK.name : source
}

/** One page, or a span of pages `[first, last]`. */
type CitePage = number | readonly [number, number]

/**
 * A cite written by hand: the book and page a rule is printed on, then the
 * pages it points the reader to (a list, a table) as `see`.
 */
export type BookCite = {
  source: string
  page: CitePage
  see?: readonly { label: string; page: CitePage }[]
}

function pageLabel(page: CitePage): string {
  return typeof page === 'number' ? `p.${page}` : `pp.${page[0]}–${page[1]}`
}

/** `Workshop Manual · p.18 · Pilot Stats p.20`: the book, its page, then each `see`. */
export function formatCite({ source, page, see = [] }: BookCite): string {
  return [
    bookName(source),
    pageLabel(page),
    ...see.map((entry) => `${entry.label} ${pageLabel(entry.page)}`),
  ].join(' · ')
}

/** A secondary printing: the book (and booklet) that reprinted it, and the page. */
export type AdditionalSource = { source: string; booklet?: string; page: number }

/**
 * `book (booklet) · p.N`, dropping absent parts; `undefined` when nothing is
 * known. The book prints by its one name (`bookName`), so an entity's cite and
 * a hand-written one name the core book alike. A booklet means something only
 * beside its source.
 */
export function formatProvenance(
  source: string | undefined,
  booklet: string | undefined,
  page: number | undefined
): string | undefined {
  const name = source ? bookName(source) : undefined
  const book = name && booklet ? `${name} (${booklet})` : name
  const parts = [book, page !== undefined ? `p.${page}` : undefined].filter(
    (part): part is string => !!part
  )
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function isAdditionalSource(value: unknown): value is AdditionalSource {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.source !== 'string' || record.source.length === 0) return false
  if (typeof record.page !== 'number') return false
  return record.booklet === undefined || typeof record.booklet === 'string'
}

/** The renderable printings in an `additionalSources` field; the rest dropped. */
export function resolveAdditionalSources(value: unknown): AdditionalSource[] {
  if (!Array.isArray(value)) return []
  return value.filter(isAdditionalSource)
}

export type Provenance = {
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
  additionalSources: AdditionalSource[]
}

/**
 * One record's provenance, never a mix: a pattern's own when it carries a
 * source (often another book than its chassis's), else its chassis's — and the
 * reprints ride with whichever record that is.
 */
export function resolveProvenance(
  entity: RefMetaEntity,
  pattern?: RefObjectAnyPattern
): Provenance {
  if (pattern?.source) {
    return {
      source: pattern.source,
      booklet: 'booklet' in pattern ? pattern.booklet : undefined,
      page: pattern.page,
      additionalSources: resolveAdditionalSources(pattern.additionalSources),
    }
  }
  return {
    source: getSource(entity),
    booklet: getBooklet(entity),
    page: getPageReference(entity),
    additionalSources: resolveAdditionalSources(
      'additionalSources' in entity ? entity.additionalSources : undefined
    ),
  }
}

/** The page's foot citation: the page, then the book and any reprints. */
export function entityCite(entity: RefMetaEntity, pattern?: RefObjectAnyPattern): EntityCite {
  const provenance = resolveProvenance(entity, pattern)
  const book = formatProvenance(provenance.source, provenance.booklet, undefined)
  const reprints = provenance.additionalSources
    .map((entry) => formatProvenance(entry.source, entry.booklet, entry.page))
    .filter((line): line is string => !!line)
  const printings: EntityPrinting[] = [
    ...(book
      ? [{ book, ...(provenance.page !== undefined ? { page: provenance.page } : {}) }]
      : []),
    ...provenance.additionalSources.map((entry) => ({
      book: formatProvenance(entry.source, entry.booklet, undefined) ?? entry.source,
      page: entry.page,
    })),
  ]
  const citation = [book, ...reprints.map((line, i) => (i === 0 ? `also in ${line}` : line))]
    .filter((part): part is string => !!part)
    .join(' · ')
  return {
    ...(provenance.source ? { source: provenance.source } : {}),
    ...(provenance.booklet ? { booklet: provenance.booklet } : {}),
    ...(provenance.page !== undefined ? { page: provenance.page } : {}),
    ...(citation ? { citation } : {}),
    printings,
  }
}
