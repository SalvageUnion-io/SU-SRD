/**
 * What an entity's PAGE says around its body (boards 07, 08, 08b): the type
 * stamps on its chapter band, and the citation on its foot band.
 *
 * The card at `presentation="page"` hands its title to the page's
 * `ChapterBand` and its footer to the page's `ChapterFoot`. Those two are the
 * app's chrome, so the app renders them, but what they SAY is the card's: the
 * seam's type stamp, the header's tier numeral, TL and cost pennant, and the
 * identity footer's provenance. Resolving them here, from the same helpers the
 * card uses, keeps a page from ever describing an entity differently from its
 * own card.
 */

import type { SURefMetaEntity, SURefObjectPattern } from 'salvageunion-reference'
import {
  extractVisibleActions,
  getTechLevel,
  resolveActivationCurrency,
} from 'salvageunion-reference'
import { formatCost } from './cardCells'
import { isTitanicAction } from './cardHelpers'
import { resolveSeamLabel, resolveTierNumeral } from './entityCardTone'
import { formatProvenance, resolveFooterProvenance } from './provenance'
import type { ActionFields } from './referenceEntityCardTypes'
import { resolveFoldedAction } from './resolveFoldedAction'

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

function entitySchemaName(entity: SURefMetaEntity): string | undefined {
  return 'schemaName' in entity && typeof entity.schemaName === 'string'
    ? entity.schemaName
    : undefined
}

export function resolveEntityPageMeta(
  entity: SURefMetaEntity,
  pattern?: SURefObjectPattern
): EntityPageMeta {
  const schemaName = entitySchemaName(entity) as Parameters<typeof resolveSeamLabel>[0] | undefined
  const typeLabel = pattern ? 'Pattern' : schemaName ? resolveSeamLabel(schemaName, entity) : ''
  const techLevel = getTechLevel(entity)
  const name = 'name' in entity ? String(entity.name) : ''

  // The cost pennant: the entity's own cost, else its folded self-action's —
  // the same source the card's header reads.
  const ownCost = entity as ActionFields
  const foldable = (extractVisibleActions(entity) ?? []).filter((a) => !isTitanicAction(a))
  const folded = resolveFoldedAction(foldable, name) as ActionFields | undefined
  const costSource: ActionFields | undefined = ownCost.activationCost != null ? ownCost : folded
  const cost =
    costSource?.activationCost != null
      ? formatCost(costSource.activationCost, resolveActivationCurrency(costSource.actionSource))
      : undefined

  const provenance = resolveFooterProvenance(entity, pattern)
  const book = formatProvenance(provenance.source, provenance.booklet, undefined)
  const reprints = provenance.additionalSources
    .map((entry) => formatProvenance(entry.source, entry.booklet, entry.page))
    .filter((line): line is string => !!line)
  const citation = [book, ...reprints.map((line, i) => (i === 0 ? `also in ${line}` : line))]
    .filter((part): part is string => !!part)
    .join(' · ')

  return {
    typeLabel,
    techLevel: techLevel != null ? String(techLevel) : undefined,
    numeral: resolveTierNumeral(entity),
    cost,
    page: provenance.page,
    citation: citation || undefined,
  }
}
