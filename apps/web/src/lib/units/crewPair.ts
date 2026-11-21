/**
 * A pilot and the mech assigned to it, as ONE linked Mini:
 * its form follows where the pilot is.
 *
 *  - **Boarded**: the mech's Mini (its tone, its live readings SP, EP, Heat
 *    as its chips) that keeps the pilot's name as its own, the mech a relation
 *    chip (`MECH | Mule`): a pilot never changes name by boarding.
 *  - **Not boarded** (or with no mech): the pilot's Mini, its readings (HP,
 *    AP) as its chips and a relation chip naming its mech (`MECH | Mule`).
 *
 * Pure, so every surface that links a pilot and a mech draws the pair alike:
 * the Play hub and a Game's roster as one Mini (`crewPair`), the Training
 * Bay as the other side's Mini on each item (`pairSide`).
 */

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

/**
 * One side of the pair as a Mini of its own kind, with no relation: where the
 * item it hangs on already is the other side (a Training Bay pilot's mech).
 */
export function pairSide(kind: 'pilot' | 'mech', side: PairSide): LinkedUnit {
  return {
    key: `${kind}:${side.id}`,
    kind,
    name: side.name,
    href: side.href,
    readings: side.readings ?? [],
  }
}

export function crewPair(args: {
  pilot: PairSide
  mech: PairSide | null
  boarded: boolean
}): LinkedUnit {
  const { pilot, mech, boarded } = args
  if (boarded && mech !== null) {
    return {
      ...pairSide('mech', mech),
      // The line stays the pilot's by name and opens their sheet; the mech
      // they are aboard is the chip, as it is on foot.
      name: pilot.name,
      href: pilot.href,
      relations: [relation(`mech-${mech.id}`, 'Mech', mech.name, { href: mech.href })],
    }
  }
  return {
    ...pairSide('pilot', pilot),
    ...(mech === null
      ? {}
      : { relations: [relation(`mech-${mech.id}`, 'Mech', mech.name, { href: mech.href })] }),
  }
}

// A vital's reading is built in one place (`readings.ts`); a pair's sides read
// theirs from it under these names.
export { gauge, pool } from './readings'
