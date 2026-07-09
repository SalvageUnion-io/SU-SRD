/**
 * Weapon-system detection for crawler capacity (pure-ish — reads the ORM).
 *
 * A Union Crawler's Armament-Bay cap applies to WEAPONS SYSTEMS only — the
 * damage-dealing systems (Core Book 2.0a p. 213 "Choose your Weapons System";
 * Battle Crawler raises it to two, p. 216). Non-weapon systems (Armour Plating,
 * Cargo Pod, Locomotion System, …) are not capped by that rule.
 *
 * A System record does not carry damage itself — damage lives on the actions
 * the system references. So a system is a weapon iff any of its resolved
 * actions deals damage (the action has a `damage` payload).
 */
import { SalvageUnionReference } from '../index.js'
import type { SURefMetaEntity, SURefSystem } from '../types/index.js'

/**
 * True when `system` is a Weapons System — i.e. at least one of its resolved
 * actions deals damage. Requires the `systems` and `actions` reference data to
 * be preloaded (the ORM resolves action-name refs against the action map).
 */
export function isWeaponSystem(system: SURefSystem): boolean {
  const actions = SalvageUnionReference.resolveActions(system as unknown as SURefMetaEntity) ?? []
  return actions.some((action) => action.damage != null)
}
