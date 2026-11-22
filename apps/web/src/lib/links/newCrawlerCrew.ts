/**
 * A crawler made from a pilot's or a mech's "+ Create" is that pair's (r4
 * E19): the pilot and the mech they fly are both assigned to it as it lands,
 * as a mech made for a pilot is assigned to them. The mech is the pilot's own
 * pairing, read from the links this browser holds; one in another container
 * stays where it is (a link never crosses containers).
 */

import { containerOf, sameContainer } from 'game-domain/container'
import type { EntityRef } from 'game-domain/schemas/entity'
import { useUnits } from '../../replica/units'
import { assignLink } from './assignLink'

type Units = Pick<ReturnType<typeof useUnits.getState>, 'pilots' | 'mechs' | 'softLinks'>

/** The pilot and mech a crawler started from `origin` takes: the unit, and the other half of its pair. */
export function crewFor(origin: EntityRef, units: Units): EntityRef[] {
  const pair = units.softLinks.find(
    (link) =>
      link.type === 'mech-to-pilot' &&
      (origin.type === 'pilot' ? link.to : link.from).id === origin.id
  )
  const other = pair === undefined ? undefined : origin.type === 'pilot' ? pair.from : pair.to
  const held = (ref: EntityRef) =>
    (ref.type === 'pilot' ? units.pilots : units.mechs).find((unit) => unit.id === ref.id)
  const first = held(origin)
  const second = other === undefined ? undefined : held(other)
  const together =
    other !== undefined &&
    first !== undefined &&
    second !== undefined &&
    sameContainer(containerOf(first), containerOf(second))
  return together ? [origin, { type: other.type, id: other.id }] : [origin]
}

/** Assign the unit the crawler was made from, and its pair, to the new crawler. */
export async function crewNewCrawler(crawlerId: string, origin: EntityRef): Promise<void> {
  for (const unit of crewFor(origin, useUnits.getState())) {
    await assignLink(unit, { type: 'crawler', id: crawlerId })
  }
}
