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

/** Minimal entity shape needed to read armor trait data. */
type EntityWithTraits = {
  traits?: Array<{ type: string; amount?: number | string }>
  [key: string]: unknown
}

/**
 * Extract the armor reduction value from an entity's armor trait.
 * Returns 0 if no armor trait exists or the trait has no numeric amount.
 *
 * Per rules p.79, only armor items with an explicit amount on the armor trait
 * reduce HP damage (e.g. Reactive Armour: 1, Polycarbonate Carapace Armour: 2).
 * Armor items without an amount (e.g. Camo Suit) provide no HP reduction.
 */
export function getArmorReduction(entity: EntityWithTraits): number {
  const armorTrait = entity.traits?.find((t) => t.type === 'armor')
  if (!armorTrait) return 0
  if (typeof armorTrait.amount === 'number') return armorTrait.amount
  return 0
}

/**
 * Compute the full damage cascade for a given SP damage amount.
 *
 * @param currentSp    Current mech SP before damage
 * @param damage       Incoming SP damage amount
 * @param isBoarded    Whether the pilot is currently boarded in the mech
 * @param armorValue   Pilot armor reduction (defaults to 0). Reduces HP damage
 *                     to a minimum of 1 (per rules p.234).
 */
export function computeDamageCascade(
  currentSp: number,
  damage: number,
  isBoarded: boolean,
  armorValue: number = 0
): DamageCascade {
  const { newSp, hpDamage: rawHpDamage } = applySpDamage(currentSp, damage)
  const triggersCritical = newSp === 0 && (currentSp > 0 || damage > 0)
  let hpDamage = 0
  if (isBoarded && rawHpDamage > 0) {
    hpDamage = Math.max(1, rawHpDamage - armorValue)
  }
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
