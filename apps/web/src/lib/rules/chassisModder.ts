/**
 * Chassis Modder — the Fabricator Tree's level 3 ability (Core Book p.64).
 *
 * Once during Downtime the Fabricator modifies their Mech Chassis: it gains
 * any Chassis Ability of their choice from any Mech they could craft in their
 * Crafting Bay (a chassis of the crawler's Tech Level or lower, p.222). A Mech
 * holds one added Chassis Ability at most, replaceable during Downtime, and it
 * only works while the Fabricator pilots it.
 *
 * The pick is stored on the mech (`Mech.moddedChassisAbility`), so it stays
 * with the machine; whether it is in effect is read off the seated pilot.
 *
 * Pure functions — no React, no store.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { RefMetaAction } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { craftableAtTl } from './crafting'

/** The ability's slug in `Pilot.abilities`. */
export const CHASSIS_MODDER = 'chassis-modder'

/** True when the pilot holds Chassis Modder. */
export function hasChassisModder(pilotAbilities: readonly string[] | undefined): boolean {
  return pilotAbilities?.includes(CHASSIS_MODDER) ?? false
}

/** The chassis ability names a chassis lists. */
function chassisAbilityNames(chassisRef: string): string[] {
  return resolveChassisRef(chassisRef)?.chassisAbilities ?? []
}

/**
 * Slugs of the Chassis Abilities a Fabricator may add to this mech: every
 * ability of a chassis they could craft (numeric Tech Level at or below the
 * crawler's; any numeric Tech Level when the mech has no crawler to read),
 * less the ones its own chassis already has. Bio-Titan and Nhurgal chassis
 * are never craftable.
 */
export function moddableChassisAbilities(chassisRef: string, crawlerTl: number | null): string[] {
  const own = new Set(chassisAbilityNames(chassisRef))
  const out = new Set<string>()
  for (const chassis of SalvageUnionReference.Chassis.all()) {
    const tl = chassis.techLevel
    if (typeof tl !== 'number' || !craftableAtTl(tl, crawlerTl ?? 6)) continue
    for (const name of chassis.chassisAbilities ?? []) {
      if (!own.has(name)) out.add(nameToSlug(name))
    }
  }
  return [...out]
}

/** Resolve a stored Chassis Ability slug against the reference actions. */
function resolveChassisAbility(slug: string): RefMetaAction | null {
  const action = SalvageUnionReference.Actions.getBySlug(slug)
  return action && action.actionSource === 'chassis' ? action : null
}

/**
 * The Chassis Ability Chassis Modder adds to this mech while its pilot holds
 * the ability, or null: none picked, the pilot is not a Chassis Modder, the
 * slug no longer resolves, or the chassis already has it.
 */
export function moddedChassisAbility(
  mech: Pick<Mech, 'chassisRef' | 'moddedChassisAbility'>,
  pilotAbilities: readonly string[] | undefined
): RefMetaAction | null {
  if (!mech.moddedChassisAbility || !hasChassisModder(pilotAbilities)) return null
  const action = resolveChassisAbility(mech.moddedChassisAbility)
  if (!action || chassisAbilityNames(mech.chassisRef).includes(action.name)) return null
  return action
}
