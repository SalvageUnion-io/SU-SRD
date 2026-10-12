/**
 * What an entity's PAGE says around its body (boards 07, 08, 08b): the type
 * stamps on its chapter band, and the citation on its foot band.
 *
 * The card at `presentation="page"` hands its title to the page's
 * `ChapterBand` and its footer to the page's `ChapterFoot`. Those two are the
 * app's chrome, so the app renders them, but what they SAY is the card's: the
 * seam's type stamp, the header's tier numeral, TL and cost pennant, and the
 * identity footer's provenance. Reading them off the entity model
 * (`toEntityModel`), which the card's helpers read too, keeps a page from
 * describing an entity differently from its own card (one known exception:
 * `bandCost`).
 */

import type { SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import {
  extractVisibleActions,
  foldedActionOf,
  formatCost,
  isTitanicAction,
  resolveActivationCurrency,
  toEntityModel,
} from 'salvageunion-reference'
import type { ActionFields } from './referenceEntityCardTypes'

export type EntityPageMeta = {
  /** The seam's type stamp: "Chassis", "Ability · Hacking Tree", "Pattern". */
  typeLabel: string
  /** The Tech Level, as the header's TL cell reads it. */
  techLevel?: string
  /** An ability's tier numeral (its level in the tree). */
  numeral?: string
  /** The cost pennant: "2 AP", "1 EP". */
  cost?: string
  /** The page number the citation leads with (`p.112`). */
  page?: number
  /**
   * The rest of the citation: the book, then any reprints — "Salvage Union
   * Workshop Manual · also in Salvage Union Starter Set (PC) · p.26".
   */
  citation?: string
}

/**
 * The band's cost pennant: the entity's own cost, else its self-named action's.
 *
 * KNOWN BUG, kept so the page does not change before the Page form (phase 5):
 * unlike the card (and the entity model), this does not skip a GRANTING
 * ability, whose self-named action belongs to the item it grants — so the
 * band of Camo Suit, Knife Missile, Wingsuit… prints the granted item's cost.
 */
function bandCost(entity: SURefMetaEntity): string | undefined {
  const name = 'name' in entity ? String(entity.name) : ''
  const own = entity as ActionFields
  const foldable = (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
  const folded = foldedActionOf(foldable, name) as ActionFields | undefined
  const source: ActionFields | undefined = own.activationCost != null ? own : folded
  return source?.activationCost != null
    ? formatCost(source.activationCost, resolveActivationCurrency(source.actionSource))
    : undefined
}

/** What an entity's page says around its body, read off its entity model. */
export function resolveEntityPageMeta(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): EntityPageMeta {
  const model = toEntityModel(entity, undefined, { pattern })
  return {
    typeLabel: model.kind.stamp,
    techLevel: model.techLevel != null ? String(model.techLevel) : undefined,
    numeral: model.tier,
    cost: bandCost(entity),
    page: model.cite.page,
    citation: model.cite.citation,
  }
}
