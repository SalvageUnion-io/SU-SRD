/**
 * What an entity's PAGE says around its body (boards 07, 08, 08b): the
 * stamps on its chapter band, and its kind and printings on its foot band.
 *
 * The card at `presentation="page"` hands its title to the page's
 * `ChapterBand` and its footer to the page's `ChapterFoot`. Those two are the
 * app's chrome, so the app renders them, but what they SAY is the card's: the
 * kind (for screen readers: never a stamp, E9), the header's tier numeral and
 * TL, and the identity footer's provenance. Every chip the entity carries
 * (E17: its action type, its facts, its traits and its cost) rides the band
 * too, so the page body holds none (owner's call, 2026-10-14). Reading them
 * off the entity model
 * (`toEntityModel`), which the card's helpers read too, keeps a page from
 * describing an entity differently from its own card.
 */

import type { EntityModel, SURefMetaEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { actionTypeStamps } from '../../../entity/parts/actionStamps'
import { costCell } from '../../../entity/parts/chipSet'
import { factCells } from '../../../entity/parts/factCells'
import type { TagItem } from '../../../entity/parts/tagItems'
import { traitTags } from '../../../entity/parts/tagItems'
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
   * book's order (Slots Required, Tech Level, Salvage Value). Empty for a
   * chassis and its patterns: their stats lead the page body, inline
   * (`pageBodyStats`; owner's call, 2026-10-14).
   */
  stats: BookStat[]
  /** An ability's tier numeral (its level in the tree). */
  numeral?: string
  /** The action type stamps ("Turn Action") the band carries. */
  actionTypes: string[]
  /**
   * The facts beyond the book's stats, label first: an action's range and
   * damage, a datavalue (`RNG | Close`).
   */
  facts: StatItem[]
  /** The traits (`[Hot | 2]`), linking to their entries. */
  tags: TagItem[]
  /** The read cost the band carries ("1 AP" as value and currency), last. */
  cost?: { value: string; currency: string }
  /**
   * Where it is printed, for the foot band's citation chips: the book and
   * page, then each reprint ("Salvage Union Starter Set (PC)", p.26).
   */
  printings: { book: string; page?: number }[]
}

/** The model's facts the band does not already state as a book stat. */
function isOwnStat(key: string): boolean {
  // `tech-level` and the `ref-stat-*` stats (`lib/view/parts/facts.ts`) are
  // `bookStats` in the book's words; what is left are the facets.
  return key === 'tech-level' || key.startsWith('ref-stat-')
}

/** A chassis (its patterns' pages too) keeps its stats in the page body. */
function statsInBody(entity: SURefMetaEntity): boolean {
  return 'schemaName' in entity && entity.schemaName === 'chassis'
}

function bookStatsOf(model: EntityModel): BookStat[] {
  return model.bookStats.map((fact) => ({
    key: fact.key,
    label: fact.label,
    value: fact.value,
    ...(fact.hint ? { hoverText: fact.hint } : {}),
  }))
}

/** The stats that lead a page's body, inline: a chassis's; nothing else's. */
export function pageBodyStats(entity: SURefMetaEntity): BookStat[] {
  return statsInBody(entity) ? bookStatsOf(toEntityModel(entity)) : []
}

/** What an entity's page says around its body, read off its entity model. */
export function resolveEntityPageMeta(
  entity: SURefMetaEntity,
  pattern?: SURefObjectAnyPattern
): EntityPageMeta {
  const model = toEntityModel(entity, undefined, { pattern })
  const cost = model.cost ? costCell(model.cost) : undefined
  return {
    typeLabel: model.kind.stamp,
    techLevel: model.techLevel != null ? String(model.techLevel) : undefined,
    stats: statsInBody(entity) ? [] : bookStatsOf(model),
    numeral: model.tier,
    actionTypes: actionTypeStamps(model.actionType, model.mechActionType),
    facts: factCells(model.facts.filter((fact) => !isOwnStat(fact.key))),
    tags: traitTags(model.traits),
    ...(cost
      ? { cost: { value: cost.value ?? cost.label, currency: cost.value ? cost.label : '' } }
      : {}),
    printings: model.cite.printings,
  }
}
