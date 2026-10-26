import type { MechDerived, PilotDerived, SheetVitals } from 'game-domain/botWire'
import type { CrewSeat, CrewUnit } from 'game-domain/rules/crewVitals'
import { crewDeriver } from 'game-domain/rules/crewVitals'
import type { SeatMount } from 'game-domain/schemas/seat'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { GameStore, UnitRow } from './game/store'
import { unitName } from './game/units'

/** The reference data the crew's derivation reads; a room loads it before its first answer. */
export function loadCrewReference(): Promise<void> {
  return SalvageUnionReference.preload(['abilities', 'chassis', 'modules', 'systems'])
}

/** The derivation over the room's pilots, crawlers, links and seats (a Game's, or a Shelf's solo ones). */
function deriverOf(store: GameStore) {
  return crewDeriver({
    pilots: store.units('pilot').map(crewUnit),
    crawlers: store.units('crawler').map(crewUnit),
    links: store.links(),
    seats: store.rows('select pilot_id, mount, active_effects, ejected from seats').map(seatOf),
  })
}

/**
 * One unit's derived vitals, over the room it lives in. Null for a crawler or
 * an NPC, which are not crew, and for a unit the room does not hold.
 */
export async function unitVitals(store: GameStore, unitId: string): Promise<SheetVitals | null> {
  const unit = store.unit(unitId)
  if (unit === null || (unit.kind !== 'pilot' && unit.kind !== 'mech')) return null
  await loadCrewReference()
  const derive = deriverOf(store)
  return unit.kind === 'pilot'
    ? { kind: 'pilot', ...derive.derivePilot(crewUnit(unit)) }
    : { kind: 'mech', ...derive.deriveMech(crewUnit(unit)) }
}

/** Who a crewmate is and whose: the ids a sheet is reached by, and its holder's name. */
type CrewRow = {
  _id: string
  appId: string
  linkId: string
  ownerId: string | null
  ownerName: string | null
  name: string
}

/** Every crewmate's vitals, as `crew.vitals` answered them but the viewer (the reader's own id). */
export type CrewVitals = {
  pilots: (CrewRow &
    PilotDerived & {
      currentHP: number | null
      currentAP: number | null
      boarded: boolean
      mechId: string | null
    })[]
  mechs: (CrewRow &
    MechDerived & {
      currentSP: number | null
      currentEP: number | null
      currentHeat: number | null
    })[]
}

/**
 * The crew's vitals in a Game room, for every member alike (ADR-038 §4):
 * what a crewmate reads at a glance, derived with the rules the client
 * uses. The reference data must be loaded (`loadCrewReference`).
 */
export function crewVitals(store: GameStore): CrewVitals {
  const { seatOf: seats, mechOfPilot, derivePilot, deriveMech } = deriverOf(store)
  const row = (unit: UnitRow, fallback: string): CrewRow => ({
    _id: unit.id,
    appId: unit.id,
    linkId: unit.id,
    ownerId: unit.ownerId,
    ownerName: unit.ownerId === null ? null : (store.member(unit.ownerId)?.displayName ?? null),
    name: unitName(unit) ?? fallback,
  })
  return {
    pilots: store.units('pilot').map((p) => {
      const seat = seats.get(p.id)
      const boarded = seat?.mount.kind === 'boarded' ? seat.mount.mechId : null
      return {
        ...row(p, 'Pilot'),
        currentHP: num(p.body.currentHP),
        currentAP: num(p.body.currentAP),
        boarded: boarded !== null,
        mechId: boarded ?? mechOfPilot.get(p.id) ?? null,
        ...derivePilot(crewUnit(p)),
      }
    }),
    mechs: store.units('mech').map((m) => ({
      ...row(m, 'Mech'),
      currentSP: num(m.body.currentSP),
      currentEP: num(m.body.currentEP),
      currentHeat: num(m.body.currentHeat),
      ...deriveMech(crewUnit(m)),
    })),
  }
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null
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
