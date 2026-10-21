/**
 * A pilot and the mech assigned to it, as ONE linked Mini (owner, round 8):
 * its form follows where the pilot is.
 *
 *  - **Boarded**: the mech's Mini, its live readings (SP, EP, Heat) as its
 *    chips and a relation chip naming who is aboard (`PILOT | Bonesaw`).
 *  - **Not boarded** (or with no mech): the pilot's Mini, its readings (HP,
 *    AP) as its chips and a relation chip naming its mech (`MECH | Mule`).
 *
 * Pure, so every surface that links a pilot and a mech draws the pair alike.
 */

import { resolveGauge, resolvePool } from 'salvageunion-reference/rules'
import type { LinkedUnit } from '../../components/index'
import { relation } from '../../components/index'
import type { UnitReading } from './unitModel'

/** One side of the pair: its name, its sheet, its live readings. */
export type PairSide = {
  id: string
  name: string
  href?: string | undefined
  readings?: readonly UnitReading[]
}

export function crewPair(args: {
  pilot: PairSide
  mech: PairSide | null
  boarded: boolean
}): LinkedUnit {
  const { pilot, mech, boarded } = args
  if (boarded && mech !== null) {
    return {
      key: `mech:${mech.id}`,
      kind: 'mech',
      name: mech.name,
      href: mech.href,
      readings: mech.readings ?? [],
      relations: [relation(`pilot-${pilot.id}`, 'Pilot', pilot.name, { href: pilot.href })],
    }
  }
  return {
    key: `pilot:${pilot.id}`,
    kind: 'pilot',
    name: pilot.name,
    href: pilot.href,
    readings: pilot.readings ?? [],
    ...(mech === null
      ? {}
      : { relations: [relation(`mech-${mech.id}`, 'Mech', mech.name, { href: mech.href })] }),
  }
}

/** A pool's `current/max` reading (HP, AP, SP, EP): an absent current is full. */
export function pool(label: string, current: number | null, max: number | null): UnitReading[] {
  if (max === null) return []
  return [{ label, value: `${resolvePool(current ?? undefined, max)}/${max}` }]
}

/** A gauge's `current/max` reading (Heat): an absent current is empty. */
export function gauge(label: string, current: number | null, max: number | null): UnitReading[] {
  if (max === null) return []
  return [{ label, value: `${resolveGauge(current ?? undefined, max)}/${max}` }]
}
