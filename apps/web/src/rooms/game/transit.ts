import type { HomeAddress, LeaseOutcome, ParcelSeat, UnitParcel } from '../handoff'
import { Leases, MOVED_OFF } from '../leases'
import { RoomRefusal } from '../refusal'
import type { GamePlay } from './play'
import type { GameStore, UnitRow } from './store'
import { fromJson } from './store'
import type { GameUnits } from './units'

/**
 * Units crossing this Game's walls: both halves of the two-room handoff
 * (`../handoff.ts`).
 *
 * A move's rules: a pilot, mech or NPC is moved by its holder,
 * into a Game they are a member of; a crawler only by the table runner,
 * between the Game and their own Training Bay, never Game to Game. A link
 * whose other end is not where the unit lands is dropped (ADR-037).
 */

const ALREADY_HERE = 'That is already in this Game'

export class GameTransit {
  private readonly leases: Leases

  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits,
    private readonly play: GamePlay
  ) {
    this.leases = new Leases(store)
  }

  // ------------------------------------------------------------- outbound

  /**
   * Offer a unit to another home, marking it leaving. Offering the same lease
   * again answers the same parcel.
   */
  offer(args: {
    leaseId: string
    unitId: string
    actor: string
    to: HomeAddress
    at: number
  }): UnitParcel {
    return this.store.sql.transaction(() => {
      const game = this.store.requireGame()
      const unit = this.store.requireUnit(args.unitId)
      if (unit.leaseId === args.leaseId) return this.parcelOf(unit, game.gameId)
      this.units.assertMayWrite(args.actor, unit)
      if (unit.kind === 'crawler') {
        if (args.to.kind !== 'account' || args.to.userId !== args.actor) {
          throw new RoomRefusal(
            'A crawler moves between a Game and its table runner’s Training Bay: move it out first'
          )
        }
      } else if (args.to.kind === 'account' && args.to.userId !== args.actor) {
        throw new RoomRefusal('You can only move your own build to your own Training Bay')
      }
      this.store.putUnit({ ...unit, leaseId: args.leaseId })
      this.leases.put(args.leaseId, unit.id, 'out', 'offered', args.to, args.at)
      return this.parcelOf({ ...unit, leaseId: args.leaseId }, game.gameId)
    })
  }

  /**
   * The target has the unit: drop it here, with its links and seat; a mech
   * leaves whoever was aboard on foot, and a primary crawler hands over to
   * the oldest left. Releasing twice is a no-op.
   */
  release(leaseId: string): void {
    this.leases.close(leaseId, (unit) => this.units.drop(unit))
  }

  /** The target refused it: the unit stays, writable again. */
  cancel(leaseId: string): void {
    this.leases.close(leaseId)
  }

  /** Offers older than `before`, for the alarm that settles them (`settleLease`). */
  staleOffers(before: number): { leaseId: string; to: HomeAddress }[] {
    return this.leases.staleOffers(before)
  }

  private parcelOf(unit: UnitRow, gameId: string): UnitParcel {
    // A pilot's seat at this table stays here: it describes play here.
    return this.leases.parcelOf(unit, { kind: 'game', gameId }, null)
  }

  // -------------------------------------------------------------- inbound

  /**
   * Take a unit in. A pilot, mech or NPC comes in its holder's hands, and
   * only a member brings one; a crawler comes from the table runner and
   * becomes the crew's. The unit keeps its op log, the links whose other end
   * is here, and (a pilot) its seat, still aboard a mech that is here, its
   * holder's, intact and free. Accepting the same lease twice is a no-op;
   * a lease refused before it arrived is refused.
   */
  accept(parcel: UnitParcel, actor: string, at: number): void {
    this.store.sql.transaction(() => {
      const lease = this.leases.get(parcel.leaseId)
      if (lease?.state === 'accepted') return
      if (lease?.state === 'refused') throw new RoomRefusal(MOVED_OFF)
      const { unit } = parcel
      if (unit.kind === 'crawler') this.store.requireTableRunner(actor)
      else {
        this.store.requireMember(actor)
        if (unit.ownerId !== actor) throw new RoomRefusal('You can only move your own build')
      }
      if (this.store.unit(unit.id) !== null) throw new RoomRefusal(ALREADY_HERE)

      const row: UnitRow = {
        ...unit,
        ownerId: unit.kind === 'crawler' ? null : actor,
        createdAt: at,
        updatedAt: at,
        leaseId: null,
      }
      this.store.putUnit(row)
      for (const op of parcel.ops) this.store.putOp({ supersededBy: null, ...op })
      for (const link of parcel.links) {
        const other = link.from.id === unit.id ? link.to.id : link.from.id
        if (this.store.unit(other) !== null) this.units.writeLink(link)
      }
      if (unit.kind === 'pilot' && parcel.seat !== null) this.seatPilot(unit.id, parcel.seat, at)
      this.units.arrived(row)
      this.leases.put(parcel.leaseId, unit.id, 'in', 'accepted', parcel.from, at)
    })
  }

  /** Refuse a lease from now on, unless it was already accepted (`settleLease`). */
  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.leases.refuse(leaseId, at)
  }

  /** The seat a pilot brings: range, effects and ejection carry, the mount only to a free mech of theirs here. */
  private seatPilot(pilotId: string, seat: ParcelSeat, at: number): void {
    let mount = seat.mount
    if (mount.kind === 'boarded') {
      const mechId = mount.mechId
      const mech = this.store.unit(mechId)
      const pilot = this.store.unit(pilotId)
      const aboard = this.store
        .rows('select mount from seats where pilot_id != ?', pilotId)
        .some((row) => {
          const other = fromJson<ParcelSeat['mount']>(row.mount)
          return other.kind === 'boarded' && other.mechId === mechId
        })
      const ok =
        mech?.kind === 'mech' &&
        mech.ownerId === pilot?.ownerId &&
        mech.body.destroyed !== true &&
        !aboard
      if (!ok) mount = { kind: 'foot' }
    }
    this.play.putSeat({
      pilotId,
      mount,
      range: seat.range as never,
      activeEffects: seat.activeEffects,
      resolving: null,
      ejected: mount.kind === 'foot' && seat.ejected,
      updatedAt: at,
    })
  }
}
