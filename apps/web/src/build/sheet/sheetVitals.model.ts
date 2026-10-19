/**
 * The one map a Live Sheet's vitals take their words from (hard rule R11):
 * each gauge's stamp is the short label (`SP`) and its caption the full words
 * (`Structure Points`), the book's `STAT_LABELS` (the names `bookStats` prints
 * on a Page) for the stats the book names, and the two pools it does not stat:
 * a pilot's Ability Points and a crawler's Upgrade Pool. No sheet spells a
 * vital's name itself, so the pilot, mech, crawler and NPC read alike.
 */

import { STAT_LABELS } from 'salvageunion-reference'

export const SHEET_VITALS = {
  hp: STAT_LABELS.hitPoints,
  ap: { label: 'Ability Points', short: 'AP' },
  sp: STAT_LABELS.structurePoints,
  ep: STAT_LABELS.energyPoints,
  heat: STAT_LABELS.heatCapacity,
  upgrade: { label: 'Upgrade Pool', short: 'Upgrade' },
} as const satisfies Record<string, { label: string; short: string }>

export type SheetVital = keyof typeof SHEET_VITALS

/** A vital's gauge words: the stamp (`SP`) and its caption (`Structure Points`). */
export function vitalWords(vital: SheetVital): { label: string; subLabel: string } {
  const { label, short } = SHEET_VITALS[vital]
  return { label: short, subLabel: label }
}
