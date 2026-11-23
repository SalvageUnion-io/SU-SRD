/**
 * A Pilot's hit, carried to the Mediator (r7 C5, LG7-09): the newest roll on
 * the Game's log that names a weapon and succeeded ("Hotdog · Improvised Melee
 * Weapon · 11 · Success"), with the weapon's damage as the reference prints
 * it. Mediate offers it as one press on each opposition unit it can land on;
 * ignored, it changes nothing.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { RollLine } from '../useGameFeed'
import type { TrayNpc } from './opposition.model'
import type { HitDamage } from './proposalLine.model'
import { hitDamageOf } from './proposalLine.model'

export type PilotHit = {
  /** The roll it came from: once applied, that roll offers nothing more. */
  rollId: string
  /** Who hit, in one word: the pilot's callsign. */
  who: string
  weapon: string
  damage: HitDamage
}

const SEPARATOR = ' · '

/** A band that lands: Success, Nailed It and Tough Choice (Core Book p.11), never a Failure or Cascade. */
const LANDS = /^(success|nailed it|tough choice)/i

type Damaging = { damage?: { damageType: string; amount: unknown } }

/**
 * A weapon's damage, from the reference by its name: the action a weapon is
 * used by, which bears the weapon's own name, or the item's actions after it.
 */
export function weaponDamage(name: string): HitDamage | null {
  try {
    const action = SalvageUnionReference.Actions.getByName(name) as Damaging | undefined
    if (action !== undefined) return hitDamageOf(action)
    for (const model of [SalvageUnionReference.Systems, SalvageUnionReference.Equipment]) {
      const item = model.getByName(name) as { actions?: unknown } | undefined
      const names = Array.isArray(item?.actions) ? item.actions : []
      for (const named of names) {
        if (typeof named !== 'string') continue
        const used = SalvageUnionReference.Actions.getByName(named) as Damaging | undefined
        const damage = used === undefined ? null : hitDamageOf(used)
        if (damage !== null) return damage
      }
    }
  } catch {
    // Not loaded on this screen: no offer, as for an unknown name.
  }
  return null
}

/**
 * The hit a roll line carries, or null: a player's roll (never the Mediator's
 * veiled or private own) that names a weapon with a plain damage and landed.
 * The line is who, what, the die, the band; who may itself hold a separator
 * (`CALLSIGN · Name`), so it is read from the end.
 */
export function pilotHitOf(
  roll: RollLine & { veiled?: true },
  damageOf: (weapon: string) => HitDamage | null = weaponDamage
): PilotHit | null {
  if (roll.veiled || roll.private) return null
  const parts = roll.description.split(SEPARATOR)
  if (parts.length < 4) return null
  const band = parts[parts.length - 1] ?? ''
  const die = parts[parts.length - 2] ?? ''
  const weapon = parts[parts.length - 3] ?? ''
  if (!LANDS.test(band) || !/^\d+$/.test(die)) return null
  const damage = damageOf(weapon)
  if (damage === null) return null
  return { rollId: roll._id, who: parts[0] ?? '', weapon, damage }
}

/** The newest roll's hit, unless it has been applied already. */
export function newestHit(
  rolls: readonly (RollLine & { veiled?: true })[] | null,
  spent: ReadonlySet<string>,
  damageOf?: (weapon: string) => HitDamage | null
): PilotHit | null {
  const newest = [...(rolls ?? [])].sort((a, b) => b.ts - a.ts)[0]
  if (newest === undefined || spent.has(newest._id)) return null
  return pilotHitOf(newest, damageOf)
}

/** Whether a hit can land on this unit: it stands, and the damage is in its own stat. */
export function hitLandsOn(hit: PilotHit, npc: TrayNpc): boolean {
  return (
    !npc.down && npc.maxHp > 0 && npc.statKind === (hit.damage.damageType === 'HP' ? 'hp' : 'sp')
  )
}
