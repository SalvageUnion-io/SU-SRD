/**
 * Card PROVENANCE formatting — the one place a source/booklet/page triple turns
 * into the printed `Salvage Union Starter Set (PH) · p.38` line.
 *
 * Both provenance lines in the identity footer go through this, so an
 * ADDITIONAL printing can never drift into a different treatment than the
 * primary one it sits under.
 */

import type { SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import { getBooklet, getPageReference, getSource } from 'salvageunion-reference'

/**
 * A secondary printing of an entity — the book (and, for a multi-booklet product
 * like the Starter Set, the booklet code) that reprinted it, and the page.
 *
 * Mirrors `AdditionalSourceSchema` in `salvageunion-reference`. It is redeclared
 * here rather than imported because the package exports no inferred type for it;
 * `resolveAdditionalSources` is the runtime narrowing that earns the shape.
 */
export type AdditionalSource = {
  source: string
  booklet?: string
  page: number
}

/**
 * `source (booklet) · p.N`, dropping whichever parts are absent. Returns
 * `undefined` when nothing at all is known, so a caller can skip the line.
 * A booklet is meaningful only relative to a source, so it is never printed
 * on its own.
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

/**
 * Narrow an entity's (or pattern's) `additionalSources` field to the printings
 * that can actually be rendered. Takes `unknown` because the field lives on many
 * schemas in the `SURefEntity` union rather than on a single shared type — same
 * shape-probing convention as `getSource` / `getBooklet` in the reference
 * package. Anything unparseable is dropped rather than rendered half-formed.
 */
export function resolveAdditionalSources(value: unknown): AdditionalSource[] {
  if (!Array.isArray(value)) return []
  return value.filter(isAdditionalSource)
}

/** What the identity footer attributes: one record's provenance, never a mix. */
export type FooterProvenance = {
  source: string | undefined
  booklet: string | undefined
  page: number | undefined
  additionalSources: AdditionalSource[]
}

/**
 * FOOTER PROVENANCE — a pattern carries its OWN source/booklet/page, often a
 * different book than its chassis (e.g. an Acid Spitter sourced from another
 * book than the Mule's Workshop Manual). On a pattern card the `entity` IS the
 * chassis, so use the pattern's provenance. Booklet + page are meaningful only
 * relative to a source, so provenance falls back as ONE unit: only when the
 * pattern omits its own `source` do we borrow the chassis's source/booklet/page
 * — never mix a pattern's source with the chassis's page.
 *
 * REPRINTS ride with that same unit: `additionalSources` records which OTHER
 * books an entity was reprinted in (the Starter Set condensations, the
 * expansion re-listings). It is provenance, so it belongs to whichever record
 * the footer is attributing — the pattern's own when the pattern carries a
 * source, the chassis's otherwise — never a mix of the two.
 */
export function resolveFooterProvenance(
  entity: SURefMetaEntity,
  pattern: SURefObjectPattern | undefined
): FooterProvenance {
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
