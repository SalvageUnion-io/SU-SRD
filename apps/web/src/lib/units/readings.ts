/**
 * A unit's vitals as `current/max` readings (`SP | 9/13`), built one way for
 * every surface: a sheet's Assigned units (`rowStats`), the Training Bay, the
 * Play hub and a Game's roster (`pool`, `gauge`). Labels are the reference
 * vocabulary's short names (`STAT_LABELS`); AP has none there.
 */

import { STAT_LABELS } from 'salvageunion-reference'
import { resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import type { UnitReading } from './unitModel'

/** The vitals' printed short names. */
export const VITAL = {
  hp: STAT_LABELS.hitPoints.short,
  ap: 'AP',
  sp: STAT_LABELS.structurePoints.short,
  ep: STAT_LABELS.energyPoints.short,
  heat: STAT_LABELS.heatCapacity.short,
} as const

/** A vital's reading: a `UnitReading` whose label and value are always text. */
export type VitalReading = UnitReading & { label: string; value: string }

/**
 * One `current/max` reading; `suffix` is a trailing word that belongs to the
 * reading ("Intact" in `Bays | 4/5 Intact`).
 */
export function vitalReading(
  label: string,
  current: number,
  max: number,
  suffix?: string
): VitalReading {
  return { label, value: `${current}/${max}${suffix ? ` ${suffix}` : ''}` }
}

/** A pool's `current/max` reading (HP, AP, SP, EP): an absent current is full. */
export function pool(label: string, current: number | null, max: number | null): VitalReading[] {
  if (max === null) return []
  return [vitalReading(label, resolvePool(current ?? undefined, max), max)]
}

/** A gauge's `current/max` reading (Heat): an absent current is empty. */
export function gauge(label: string, current: number | null, max: number | null): VitalReading[] {
  if (max === null) return []
  return [vitalReading(label, resolveGauge(current ?? undefined, max), max)]
}
