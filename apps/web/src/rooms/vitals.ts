import type { SheetVitals } from 'game-domain/botWire'
import type { CrewSeat, CrewUnit } from 'game-domain/rules/crewVitals'
import { crewDeriver } from 'game-domain/rules/crewVitals'
import type { SeatMount } from 'game-domain/schemas/seat'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { GameStore, UnitRow } from './game/store'

/**
 * One unit's derived vitals, over the room it lives in: its pilots, crawlers,
 * links and seats (a Game's, or a Shelf's solo ones). Null for a crawler or
 * an NPC, which are not crew, and for a unit the room does not hold.
 */
export async function unitVitals(store: GameStore, unitId: string): Promise<SheetVitals | null> {
  const unit = store.unit(unitId)
  if (unit === null || (unit.kind !== 'pilot' && unit.kind !== 'mech')) return null
  await SalvageUnionReference.preload(['abilities', 'chassis', 'modules', 'systems'])
  const derive = crewDeriver({
    pilots: store.units('pilot').map(crewUnit),
    crawlers: store.units('crawler').map(crewUnit),
    links: store.links(),
    seats: store.rows('select pilot_id, mount, active_effects, ejected from seats').map(seatOf),
  })
  return unit.kind === 'pilot'
    ? { kind: 'pilot', ...derive.derivePilot(crewUnit(unit)) }
    : { kind: 'mech', ...derive.deriveMech(crewUnit(unit)) }
}

function crewUnit(unit: UnitRow): CrewUnit {
  return { id: unit.id, body: unit.body }
}

function seatOf(row: Record<string, unknown>): CrewSeat {
  return {
    pilotId: String(row.pilot_id),
    mount: JSON.parse(String(row.mount)) as SeatMount,
    activeEffects: JSON.parse(String(row.active_effects)) as string[],
    ejected: row.ejected === 1,
  }
}
