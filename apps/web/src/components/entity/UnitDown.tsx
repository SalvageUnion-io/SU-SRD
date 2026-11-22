/**
 * UnitDown — the Down chip of a unit at 0 SP or 0 HP (r6 C6), off its own
 * readings (`downReading`): `DOWN | needs repair` for a mech or crawler,
 * `DOWN` for a pilot or NPC, in the bad state's frame. Every list of units
 * wears it (the Game page's Crew, a Games card's crew, the Training Bay's
 * Mechs, a unit row), so a wrecked Mech is told wherever it is listed, not
 * only in Play. Nothing for a unit still standing.
 */

import { downReading } from '../../lib/units/readings'
import type { UnitReading } from '../../lib/units/unitModel'
import { Stat } from '../atoms/Stat'

export function UnitDown({ readings }: { readings: readonly UnitReading[] | undefined }) {
  const [down] = downReading(readings ?? [])
  if (down === undefined) return null
  return (
    <Stat
      label={down.label}
      {...(down.value === '' ? {} : { value: down.value })}
      state="critical"
      size="mini"
    />
  )
}
