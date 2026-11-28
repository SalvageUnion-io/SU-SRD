/**
 * What a new group session finds still open from the last one (r7 C10,
 * LG7-25): any Pilot left Down (at 0 HP) and an open salvage area, said in
 * the session's first line so the Mediator does not find them mid-scene.
 */

import { salvageAreaOf } from '../salvageArea'
import type { GameStore } from './store'

/** "Still open: Pumpkin is Down; the salvage area Mutant Nest is open", or null when nothing carries over. */
export function carriedOver(store: GameStore, labelOf: (unitId: string) => string): string | null {
  const down = store
    .units('pilot')
    .filter((pilot) => (pilot.body as { currentHP?: unknown }).currentHP === 0)
    .map((pilot) => `${labelOf(pilot.id)} is Down`)
  const area = salvageAreaOf(store)
  const open =
    area === null
      ? []
      : [area.name === '' ? 'a salvage area is open' : `the salvage area ${area.name} is open`]
  const still = [...down, ...open]
  if (still.length === 0) return null
  return `Still open: ${still.join('; ')}`
}
