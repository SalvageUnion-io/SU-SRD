/**
 * Damage utility functions for the Take Damage flow.
 *
 * These are pure functions with no side effects.
 * They wrap combatUtils from salvageunion-reference and add
 * ITUN-specific logic (cascade preview, target filtering).
 */

import { applySpDamage } from 'salvageunion-reference'
import type { EntityRefRow } from '../types/common'

export type DamageCascade = {
  /** New SP value after damage (clamped to 0) */
  newSp: number
  /** HP damage that flows to the pilot (only when boarded; 0 otherwise) */
  hpDamage: number
  /** Whether the new SP reaching 0 triggers Critical Damage Table */
  triggersCritical: boolean
}

/**
 * Compute the full damage cascade for a given SP damage amount.
 *
 * @param currentSp  Current mech SP before damage
 * @param damage     Incoming SP damage amount
 * @param isBoarded  Whether the pilot is currently boarded in the mech
 */
export function computeDamageCascade(
  currentSp: number,
  damage: number,
  isBoarded: boolean
): DamageCascade {
  const { newSp, hpDamage: rawHpDamage } = applySpDamage(currentSp, damage)
  const triggersCritical = newSp === 0 && (currentSp > 0 || damage > 0)
  const hpDamage = isBoarded ? rawHpDamage : 0
  return { newSp, hpDamage, triggersCritical }
}

/**
 * Filter mech entity refs down to those that can be targeted
 * by the Critical Damage Table: systems or modules that are not
 * already destroyed.
 */
export function filterDamageableRefs(refs: EntityRefRow[]): EntityRefRow[] {
  return refs.filter(
    (r) =>
      (r.schema_name === 'systems' || r.schema_name === 'modules') && r.condition !== 'destroyed'
  )
}

/**
 * Select a random target from a list of entity refs.
 * Returns null if the list is empty.
 */
export function selectRandomTarget(refs: EntityRefRow[]): EntityRefRow | null {
  if (refs.length === 0) return null
  const index = Math.floor(Math.random() * refs.length)
  return refs[index] ?? null
}
