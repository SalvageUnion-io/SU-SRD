/**
 * An entity's CITATION: the book, booklet and page it is printed on, and its
 * reprints. Ported from component-lib's `provenance.ts`.
 */

import { getBooklet, getPageReference, getSource } from '../../entityFields.js'
import type { SURefMetaEntity, SURefObjectPattern } from '../../schemas/index.js'
import type { EntityCite } from '../types.js'

/** A secondary printing: the book (and booklet) that reprinted it, and the page. */
export type AdditionalSource = { source: string; booklet?: string; page: number }

/**
 * `source (booklet) · p.N`, dropping absent parts; `undefined` when nothing is
 * known. A booklet means something only beside its source.
 */
export function formatProvenance(
  source: string | undefined,
  booklet: string | undefined,
  page: number | undefined
): string | undefined {
  const book = source && booklet ? `${source} (${booklet})` : source
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
  entity: SURefMetaEntity,
  pattern?: SURefObjectPattern
): Provenance {
  if (pattern?.source) {
    return {
      source: pattern.source,
      booklet: pattern.booklet,
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
export function entityCite(entity: SURefMetaEntity, pattern?: SURefObjectPattern): EntityCite {
  const provenance = resolveProvenance(entity, pattern)
  const book = formatProvenance(provenance.source, provenance.booklet, undefined)
  const reprints = provenance.additionalSources
    .map((entry) => formatProvenance(entry.source, entry.booklet, entry.page))
    .filter((line): line is string => !!line)
  const citation = [book, ...reprints.map((line, i) => (i === 0 ? `also in ${line}` : line))]
    .filter((part): part is string => !!part)
    .join(' · ')
  return {
    ...(provenance.source ? { source: provenance.source } : {}),
    ...(provenance.booklet ? { booklet: provenance.booklet } : {}),
    ...(provenance.page !== undefined ? { page: provenance.page } : {}),
    ...(citation ? { citation } : {}),
  }
}
