/**
 * What a mech is worth in Scrap: its chassis and every fitted System and
 * Module at their Salvage Values, each counted as Scrap of its own Tech Level
 * (a part is built from Scrap of its Tech Level or higher). The chassis alone
 * is not the build; the sheet and the Mechs list read this total.
 *
 * A ref the reference cannot resolve prices at nothing: it cannot be costed.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'

export type MechScrap = {
  /** Every part's Salvage Value, summed. */
  total: number
  /** The same Scrap by the Tech Level of the part it builds, lowest first (Bio and Nano, where a part is, after the numbers). */
  byTechLevel: readonly { techLevel: number | string; scrap: number }[]
}

export function mechScrap(mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'>): MechScrap {
  const parts = [
    mech.chassisRef ? resolveChassisRef(mech.chassisRef) : undefined,
    ...mech.systems.map((ref) => resolveSystemRef(ref)),
    ...mech.modules.map((ref) => resolveModuleRef(ref)),
  ]
  const byLevel = new Map<number | string, number>()
  for (const part of parts) {
    const scrap = part?.salvageValue ?? 0
    if (!part || scrap <= 0) continue
    byLevel.set(part.techLevel, (byLevel.get(part.techLevel) ?? 0) + scrap)
  }
  const byTechLevel = [...byLevel.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map(([techLevel, scrap]) => ({ techLevel, scrap }))
  return { total: byTechLevel.reduce((sum, level) => sum + level.scrap, 0), byTechLevel }
}

/**
 * A build's Scrap as it is paid (r4 E11): by the Tech Level of each part,
 * "T1 8 · T3 24", never one sum across levels, which nobody can pay
 * (Core Book p.94, p.97). Bio and Nano read by their letter.
 */
export function scrapSplit(scrap: MechScrap): string {
  return scrap.byTechLevel.map((level) => `T${level.techLevel} ${level.scrap}`).join(' · ')
}
