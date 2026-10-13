/**
 * What an entity's PAGE says around its body (boards 07, 08, 08b): the
 * stamps on its chapter band, and the citation on its foot band.
 *
 * The card at `presentation="page"` hands its title to the page's
 * `ChapterBand` and its footer to the page's `ChapterFoot`. Those two are the
 * app's chrome, so the app renders them, but what they SAY is the card's: the
 * kind (for screen readers: never a stamp, E9), the header's tier numeral and
 * TL, and the identity footer's provenance. The cost is a chip in the page's
 * chip group, beside the other chips (E17). Reading them off the entity model
 * (`toEntityModel`), which the card's helpers read too, keeps a page from
 * describing an entity differently from its own card.
 */

import type { SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { BookStat } from '../referenceEntityStatsConfig'

export type EntityPageMeta = {
  /**
   * The kind, "Chassis", "Ability · Hacking Tree", for the title's screen
   * reader text (`KindLabel`); never a stamp (E9). A pattern's is "Pattern".
   */
  typeLabel?: string
  /** The Tech Level, as the header's TL cell reads it. */
  techLevel?: string
  /**
   * The book's stat cells the band carries, Tech Level among them in the
   * book's order (Slots Required, Tech Level, Salvage Value). Empty for a
   * chassis: its stat column stays in the page body beside the art, and the
   * band carries only its `techLevel` (owner's call, 2026-10-13).
   */
  stats: BookStat[]
  /** An ability's tier numeral (its level in the tree). */
  numeral?: string
  /** The page number the citation leads with (`p.112`). */
  page?: number
  /**
   * The rest of the citation: the book, then any reprints — "Salvage Union
   * Workshop Manual · also in Salvage Union Starter Set (PC) · p.26".
   */
  citation?: string
}

/** What an entity's page says around its body, read off its entity model. */
export function resolveEntityPageMeta(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): EntityPageMeta {
  const model = toEntityModel(entity, undefined, { pattern })
  const isChassis = 'schemaName' in entity && entity.schemaName === 'chassis'
  return {
    typeLabel: model.kind.stamp,
    techLevel: model.techLevel != null ? String(model.techLevel) : undefined,
    stats: isChassis
      ? []
      : model.bookStats.map((fact) => ({
          key: fact.key,
          label: fact.label,
          value: fact.value,
          ...(fact.hint ? { hoverText: fact.hint } : {}),
        })),
    numeral: model.tier,
    page: model.cite.page,
    citation: model.cite.citation,
  }
}
