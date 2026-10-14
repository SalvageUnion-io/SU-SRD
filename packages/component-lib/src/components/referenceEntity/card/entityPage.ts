/**
 * What an entity's PAGE says around its body (boards 07, 08, 08b): the
 * stamps on its chapter band, and its kind and printings on its foot band.
 *
 * The card at `presentation="page"` hands its title to the page's
 * `ChapterBand` and its footer to the page's `ChapterFoot`. Those two are the
 * app's chrome, so the app renders them, but what they SAY is the card's: the
 * kind (for screen readers: never a stamp, E9), the header's tier numeral and
 * TL, and the identity footer's provenance. The cost is a chip in the page's
 * chip group, beside the other chips (E17), except on an ability's page,
 * whose band carries its action type and cost beside its level (owner's
 * call, 2026-10-13: `bandCarriesAction`). Reading them off the entity model
 * (`toEntityModel`), which the card's helpers read too, keeps a page from
 * describing an entity differently from its own card.
 */

import type { SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { isAbility, toEntityModel } from 'salvageunion-reference'
import { actionTypeStamps } from '../../../entity/parts/actionStamps'
import type { ChipSet } from '../../../entity/parts/chipSet'
import { costCell } from '../../../entity/parts/chipSet'
import type { StatItem } from '../../containers/statsBarTypes'
import type { BookStat } from '../referenceEntityStatsConfig'

export type EntityPageMeta = {
  /**
   * The kind, "Chassis", "Ability · Hacking Tree": the title's screen
   * reader text (`KindLabel`) and the foot band's kind chip, never a stamp on
   * the head (E9). A pattern's is "Pattern".
   */
  typeLabel?: string
  /** The Tech Level, as the header's TL cell reads it. */
  techLevel?: string
  /**
   * The book's stat cells the band carries, Tech Level among them in the
   * book's order (Slots Required, Tech Level, Salvage Value). Every entity's,
   * a chassis's too: the page body keeps no stat column (owner's call,
   * 2026-10-13).
   */
  stats: BookStat[]
  /** An ability's tier numeral (its level in the tree). */
  numeral?: string
  /**
   * The action type stamps ("Turn Action") the band carries: an ability's,
   * whose page heads with them (`bandCarriesAction`). Empty on any other page:
   * its chip group has them.
   */
  actionTypes: string[]
  /** The read cost the band carries ("1 AP" as value and currency), likewise. */
  cost?: { value: string; currency: string }
  /**
   * Where it is printed, for the foot band's citation chips: the book and
   * page, then each reprint ("Salvage Union Starter Set (PC)", p.26).
   */
  printings: { book: string; page?: number }[]
}

/**
 * An ability's page carries its action type and cost on the band, beside its
 * level, LVL-sized; the card's page chip group leaves them out.
 */
function bandCarriesAction(entity: SURefMetaEntity): boolean {
  return isAbility(entity)
}

/**
 * A page's chip group: the card's chips less what the band carries, the
 * entity's own stats (`facts` is the rest) and an ability's action type and cost.
 */
export function pageChipSet(entity: SURefMetaEntity, chips: ChipSet, facts: StatItem[]): ChipSet {
  if (!bandCarriesAction(entity)) return { ...chips, facts }
  const { cost: _onBand, ...rest } = chips
  return { ...rest, durations: [], facts }
}

/** What an entity's page says around its body, read off its entity model. */
export function resolveEntityPageMeta(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): EntityPageMeta {
  const model = toEntityModel(entity, undefined, { pattern })
  const onBand = bandCarriesAction(entity)
  const cost = onBand && model.cost ? costCell(model.cost) : undefined
  return {
    typeLabel: model.kind.stamp,
    techLevel: model.techLevel != null ? String(model.techLevel) : undefined,
    stats: model.bookStats.map((fact) => ({
      key: fact.key,
      label: fact.label,
      value: fact.value,
      ...(fact.hint ? { hoverText: fact.hint } : {}),
    })),
    numeral: model.tier,
    actionTypes: onBand ? actionTypeStamps(model.actionType, model.mechActionType) : [],
    ...(cost
      ? { cost: { value: cost.value ?? cost.label, currency: cost.value ? cost.label : '' } }
      : {}),
    printings: model.cite.printings,
  }
}
