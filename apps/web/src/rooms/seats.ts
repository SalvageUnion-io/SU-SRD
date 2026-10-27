import type { RangeBand, SeatMount, SeatResolving } from 'game-domain/schemas/seat'
import { RANGE_BANDS, SeatSchema } from 'game-domain/schemas/seat'
import type { GameStore, UnitRow } from './game/store'
import { bit, fromJson, fromJsonOrNull } from './game/store'
import { RoomRefusal } from './refusal'

/**
 * Each pilot's seat (ADR-038 §2): a Game room's for its crew
 * (`game/play.ts`), an account room's for its player's
 * solo table (`account/soloPlay.ts`). Only who may write a unit, and what a
 * unit that is not here is called, differ (`writable`).
 */

export type SeatRead = {
  pilotId: string
  mount: SeatMount
  range: RangeBand
  activeEffects: string[]
  resolving: SeatResolving | null
  ejected: boolean
  /** Null for a pilot that has not sat down yet. */
  updatedAt: number | null
}

const FOOT: SeatMount = { kind: 'foot' }

/** A pilot with no seat yet: on foot, at Close range, nothing switched on. */
function defaultSeat(pilotId: string): SeatRead {
  return {
    pilotId,
    mount: FOOT,
    range: 'Close',
    activeEffects: [],
    resolving: null,
    ejected: false,
    updatedAt: null,
  }
}

export abstract class SeatTable {
  constructor(protected readonly store: GameStore) {}

  /** The pilot or mech `unitId`, refused unless it is here and `actor` may write it. */
  protected abstract writable(actor: string, unitId: string, kind: 'pilot' | 'mech'): UnitRow

  /** One seat per pilot the room holds; a pilot that never sat down has the default. */
  pilotSeats(): SeatRead[] {
    const rows = new Map(
      this.store.rows('select * from seats').map((row) => [String(row.pilot_id), seatOf(row)])
    )
    return this.store.units('pilot').map((p) => rows.get(p.id) ?? defaultSeat(p.id))
  }

  seat(pilotId: string): SeatRead | null {
    const row = this.store.rows('select * from seats where pilot_id = ?', pilotId)[0]
    return row === undefined ? null : seatOf(row)
  }

  /**
   * Board a mech: the caller writes both the pilot and the mech, the mech is
   * here and not destroyed, and no other pilot is aboard it. Boarding never
   * assigns: the mech-to-pilot link is untouched.
   */
  board(actor: string, pilotId: string, mechId: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => {
      const mech = this.writable(actor, mechId, 'mech')
      if (mech.body.destroyed === true) throw new RoomRefusal('That Mech is destroyed')
      for (const other of this.pilotSeats()) {
        if (other.pilotId === pilotId) continue
        if (other.mount.kind === 'boarded' && other.mount.mechId === mechId) {
          throw new RoomRefusal('Another Pilot is already aboard that Mech')
        }
      }
      return { ...remount(seat, { kind: 'boarded', mechId }), ejected: false }
    })
  }

  /** Climb out, back on foot. */
  dismount(actor: string, pilotId: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => ({ ...remount(seat, FOOT), ejected: false }))
  }

  /** The emergency exit: on foot, and marked ejected until the pilot next boards or dismounts. */
  eject(actor: string, pilotId: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => ({ ...remount(seat, FOOT), ejected: true }))
  }

  setRange(actor: string, pilotId: string, range: string, at: number): void {
    if (!(RANGE_BANDS as readonly string[]).includes(range))
      throw new Error(`Not one of RANGE_BANDS: ${range}`)
    this.write(actor, pilotId, at, () => ({ range: range as RangeBand }))
  }

  /** Switch an activated effect on or off, by the ref that declares it (ADR-029 §4). */
  toggleEffect(actor: string, pilotId: string, ref: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => ({
      activeEffects: seat.activeEffects.includes(ref)
        ? seat.activeEffects.filter((r) => r !== ref)
        : [...seat.activeEffects, ref],
    }))
  }

  /** The deck action being resolved, and how far it has got; each step replaces the last. */
  setResolving(actor: string, pilotId: string, resolving: unknown, at: number): void {
    const parsed = SeatSchema.shape.resolving.unwrap().parse(resolving)
    this.write(actor, pilotId, at, () => ({ resolving: parsed }))
  }

  clearResolving(actor: string, pilotId: string, at: number): void {
    this.write(actor, pilotId, at, () => ({ resolving: null }))
  }

  /** Write part of a pilot's seat, as whoever may write the pilot; the row is made on first use. */
  private write(
    actor: string,
    pilotId: string,
    at: number,
    change: (seat: SeatRead) => Partial<SeatRead>
  ): void {
    this.store.sql.transaction(() => {
      this.writable(actor, pilotId, 'pilot')
      const seat = this.seat(pilotId) ?? defaultSeat(pilotId)
      this.putSeat({ ...seat, ...change(seat), updatedAt: at })
    })
  }

  putSeat(seat: SeatRead & { updatedAt: number }): void {
    this.store.rows(
      `insert into seats (pilot_id, mount, range_band, active_effects, resolving, ejected, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(pilot_id) do update set mount = excluded.mount, range_band = excluded.range_band,
         active_effects = excluded.active_effects, resolving = excluded.resolving,
         ejected = excluded.ejected, updated_at = excluded.updated_at`,
      seat.pilotId,
      JSON.stringify(seat.mount),
      seat.range,
      JSON.stringify(seat.activeEffects),
      seat.resolving === null ? null : JSON.stringify(seat.resolving),
      bit(seat.ejected),
      seat.updatedAt
    )
  }
}

/** Move to `mount`, dropping the resolve in progress when the mount changed. */
function remount(seat: SeatRead, mount: SeatMount): Partial<SeatRead> {
  const same =
    seat.mount.kind === mount.kind &&
    (mount.kind === 'foot' || (seat.mount.kind === 'boarded' && seat.mount.mechId === mount.mechId))
  return same ? { mount } : { mount, resolving: null }
}

/** A `seats` row, read. */
export function seatOf(row: Record<string, unknown>): SeatRead {
  return {
    pilotId: String(row.pilot_id),
    mount: fromJson<SeatMount>(row.mount as string),
    range: row.range_band as RangeBand,
    activeEffects: fromJson<string[]>(row.active_effects as string),
    resolving: fromJsonOrNull<SeatResolving>(row.resolving as string | null),
    ejected: row.ejected === 1,
    updatedAt: Number(row.updated_at),
  }
}
