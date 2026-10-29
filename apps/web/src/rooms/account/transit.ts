import type { UnitRow } from '../game/store'
import { bit } from '../game/store'
import type { HomeAddress, LeaseOutcome, ParcelSeat, UnitParcel } from '../handoff'
import { Leases, MOVED_OFF } from '../leases'
import { RoomRefusal } from '../refusal'
import { seatOf } from '../seats'
import type { AccountShelf } from './shelf'

/**
 * Units crossing a Shelf's walls: both halves of the two-room handoff
 * (`../handoff.ts`). A unit goes from a Shelf only into a Game, carried by its
 * player; a pilot takes its solo seat along, and a mech that goes ahead of
 * its pilot leaves the solo seat boarded, so the pilot that follows sits
 * down in it.
 */

export class AccountTransit {
  private readonly leases: Leases

  constructor(private readonly shelf: AccountShelf) {
    this.leases = new Leases(shelf.store)
  }

  private get store() {
    return this.shelf.store
  }

  // ------------------------------------------------------------- outbound

  /** Offer a unit to a Game, marking it leaving. Offering the same lease again answers the same parcel. */
  offer(args: {
    leaseId: string
    unitId: string
    actor: string
    to: HomeAddress
    at: number
  }): UnitParcel {
    return this.store.sql.transaction(() => {
      const unit = this.store.unit(args.unitId)
      if (unit !== null && unit.leaseId === args.leaseId) return this.parcelOf(unit)
      const writable = this.shelf.writable(args.actor, args.unitId)
      if (args.to.kind !== 'game')
        throw new RoomRefusal('A build moves from your Training Bay into a Game')
      const leaving = { ...writable, leaseId: args.leaseId }
      this.store.putUnit(leaving)
      this.leases.put(args.leaseId, writable.id, 'out', 'offered', args.to, args.at)
      return this.parcelOf(leaving)
    })
  }

  /** The Game has it: drop it here. Releasing twice is a no-op. */
  release(leaseId: string): void {
    this.leases.close(leaseId, (unit) => this.shelf.drop(unit))
  }

  /** The Game refused it: the unit stays, writable again. */
  cancel(leaseId: string): void {
    this.leases.close(leaseId)
  }

  /** Offers older than `before`, for the alarm that settles them (`settleLease`). */
  staleOffers(before: number): { leaseId: string; to: HomeAddress }[] {
    return this.leases.staleOffers(before)
  }

  private parcelOf(unit: UnitRow): UnitParcel {
    return this.leases.parcelOf(
      unit,
      { kind: 'account', userId: unit.ownerId ?? '' },
      unit.kind === 'pilot' ? this.seatOf(unit.id) : null
    )
  }

  private seatOf(pilotId: string): ParcelSeat | null {
    const row = this.store.rows('select * from seats where pilot_id = ?', pilotId)[0]
    if (row === undefined) return null
    const { mount, range, activeEffects, ejected } = seatOf(row)
    return { mount, range, activeEffects, ejected }
  }

  // -------------------------------------------------------------- inbound

  /**
   * Take a unit back from a Game: only its player brings it, and it keeps
   * its op log and the links whose other end is here. Accepting the same
   * lease twice is a no-op; a lease refused before it arrived is refused.
   */
  accept(parcel: UnitParcel, actor: string, at: number): void {
    this.store.sql.transaction(() => {
      const lease = this.leases.get(parcel.leaseId)
      if (lease?.state === 'accepted') return
      if (lease?.state === 'refused') throw new RoomRefusal(MOVED_OFF)
      this.shelf.requireOwner(actor)
      const { unit } = parcel
      if (unit.kind !== 'crawler' && unit.ownerId !== actor) {
        throw new RoomRefusal('You can only move your own build')
      }
      if (this.store.unit(unit.id) !== null)
        throw new RoomRefusal('That is already in your Training Bay')
      this.store.putUnit({ ...unit, ownerId: actor, createdAt: at, updatedAt: at, leaseId: null })
      for (const op of parcel.ops) this.store.putOp({ supersededBy: null, ...op })
      for (const link of parcel.links) {
        const other = link.from.id === unit.id ? link.to.id : link.from.id
        if (this.store.unit(other) !== null && link.slot === undefined)
          this.shelf.units.writeLink(link)
      }
      if (unit.kind === 'pilot' && parcel.seat !== null) this.putSeat(unit.id, parcel.seat, at)
      this.leases.put(parcel.leaseId, unit.id, 'in', 'accepted', parcel.from, at)
    })
  }

  /** Refuse a lease from now on, unless it was already accepted (`settleLease`). */
  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.leases.refuse(leaseId, at)
  }

  /** A solo seat, as a parcel carries it: nothing resolving, no Downtime running. */
  private putSeat(pilotId: string, seat: ParcelSeat, at: number): void {
    this.store.rows(
      `insert into seats (pilot_id, mount, range_band, active_effects, resolving, ejected, downtime_state, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(pilot_id) do update set mount = excluded.mount, range_band = excluded.range_band,
         active_effects = excluded.active_effects, resolving = excluded.resolving,
         ejected = excluded.ejected, downtime_state = excluded.downtime_state, updated_at = excluded.updated_at`,
      pilotId,
      JSON.stringify(seat.mount),
      seat.range,
      JSON.stringify(seat.activeEffects),
      null,
      bit(seat.ejected),
      null,
      at
    )
  }

  /**
   * File a disbanded Game's Opposition in this player's NPC tray. Idempotent
   * by lease: a retried disband files nothing twice. An NPC without an id is
   * a defect of the sender's.
   */
  fileTray(leaseId: string, npcs: Record<string, unknown>[], at: number): void {
    this.store.sql.transaction(() => {
      if (this.leases.get(leaseId) !== null) return
      for (const npc of npcs) {
        if (typeof npc.id !== 'string') throw new Error('A tray NPC carries its id')
        this.store.rows(
          `insert into records (tbl, app_id, body, extra, updated_at) values ('npcTray', ?, ?, '{}', ?)
           on conflict(tbl, app_id) do nothing`,
          npc.id,
          JSON.stringify(npc),
          at
        )
      }
      this.leases.put(
        leaseId,
        '',
        'in',
        'accepted',
        { kind: 'account', userId: this.shelf.owner() ?? '' },
        at
      )
    })
  }
}
