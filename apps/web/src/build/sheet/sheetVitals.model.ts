/**
 * The one map a Live Sheet's vitals take their words from (hard rule R11):
 * each gauge's stamp is the short label (`SP`) and its caption the full words
 * (`Structure Points`), the book's `STAT_LABELS` (the names `bookStats` prints
 * on a Page) for the stats the book names, and the pool it does not stat: a
 * pilot's Ability Points. No sheet spells a
 * vital's name itself, so the pilot, mech, crawler and NPC read alike.
 */

import { STAT_LABELS } from 'salvageunion-reference'
import { buildSheetCopy } from '../../messages/build-sheet'

export const SHEET_VITALS = {
  hp: STAT_LABELS.hitPoints,
  ap: { label: buildSheetCopy('abilityPoints'), short: 'AP' },
  sp: STAT_LABELS.structurePoints,
  ep: STAT_LABELS.energyPoints,
  heat: STAT_LABELS.heatCapacity,
} as const satisfies Record<string, { label: string; short: string }>

export type SheetVital = keyof typeof SHEET_VITALS

/**
 * What a vital's controls are named ("Increase Heat", r8 E10): its full words,
 * but Heat's is Heat, for its − / + move the Heat and never the Capacity, the
 * limit the gauge reads beside it.
 */
export const vitalName = (vital: SheetVital): string =>
  vital === 'heat' ? SHEET_VITALS.heat.short : SHEET_VITALS[vital].label

/** A vital's gauge words: the stamp (`SP`) and its caption (`Structure Points`). */
export function vitalWords(vital: SheetVital): { label: string; subLabel: string } {
  const { label, short } = SHEET_VITALS[vital]
  return { label: short, subLabel: label }
}
