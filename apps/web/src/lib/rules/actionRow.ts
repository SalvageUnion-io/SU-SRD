/**
 * MOCK (Working Manual wave 2, the actions board): what one actions row
 * draws, shared by Play's board (`PlayActionRow`) and the Live Sheet's Actions
 * tab, so the two never disagree.
 *
 *  - Its head is the action with the owner's picks and the crawler's Tech
 *    Level applied (R60: a Custom Sniper Rifle with High Calibre Rounds at
 *    Tech 4 reads DMG 6 SP), less the chips a row has no use for.
 *  - Its text is the action's effect alone (`actionEffect`): no setup, no
 *    on-choose text, no flavour.
 *  - Its picks are named, and a pick that gives you something to do at the
 *    table says so in its own line.
 */

import type { EntityModel, RefObjectContentBlock } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { ActionPick } from './actionEffect'
import { actionEffect, actionPicks } from './actionEffect'
import type { PlayAction } from './actionPatches'

/** Trait chips that say where an action comes from, which its row's band already says. */
const SOURCE_TRAITS = new Set(['pilot equipment'])

export type ActionRow = {
  model: EntityModel
  /** The effect's blocks, then one labelled line per pick that has its own text. */
  effect: RefObjectContentBlock[]
  /** The effect's first paragraph, for a closed row's one short line. */
  summary: string | undefined
  picks: ActionPick[]
}

export function actionRow(pa: PlayAction, techLevel?: number): ActionRow {
  const selections = pa.choices?.selections
  const base = toEntityModel(
    pa.action,
    {
      ...(selections ? { selections } : {}),
      ...(techLevel !== undefined ? { techLevel } : {}),
    },
    pa.choices ? { choices: pa.choices.from } : undefined
  )
  const picks = pa.choices ? actionPicks(pa.choices.from, pa.choices.selections) : []
  // A chassis ability's text names its chassis by a token (`[(CHASSIS)]`): the
  // row reads the chassis's own name, in the short line and the whole effect.
  const named = (text: string) =>
    pa.kind === 'chassis' ? text.replaceAll('[(CHASSIS)]', pa.ownerName) : text
  const own = actionEffect(pa.action).map((block) =>
    typeof block.value === 'string' && block.value.includes('[(CHASSIS)]')
      ? { ...block, value: named(block.value) }
      : block
  )
  const effect: RefObjectContentBlock[] = [
    ...own,
    ...picks.flatMap((pick): RefObjectContentBlock[] =>
      pick.text ? [{ type: 'list-item', label: pick.label, value: pick.text }] : []
    ),
  ]
  const first = effect.find((block) => typeof block.value === 'string')
  const summary =
    first && typeof first.value === 'string'
      ? first.label
        ? `${first.label}: ${first.value}`
        : first.value
      : undefined
  return {
    model: {
      ...base,
      traits: base.traits.filter((trait) => !SOURCE_TRAITS.has(trait.name.toLowerCase())),
      prose: effect,
    },
    effect,
    summary,
    picks,
  }
}
