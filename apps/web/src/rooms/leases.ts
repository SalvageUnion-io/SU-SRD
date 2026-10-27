import type { GameStore, UnitRow } from './game/store'
import { fromJson } from './game/store'
import type { HomeAddress, LeaseOutcome, ParcelSeat, UnitParcel } from './handoff'

/**
 * The `leases` table both rooms keep (`./handoff.ts`): one row per handoff
 * this room took part in, so each is accepted once and refused for good.
 */

export const MOVED_OFF = 'That move was called off'

/** What a parcel carries of the unit itself. */
export function parcelUnit(unit: UnitRow): UnitParcel['unit'] {
  return {
    id: unit.id,
    kind: unit.kind,
    ownerId: unit.ownerId,
    body: unit.body,
    headSeq: unit.headSeq,
    fieldSeqs: unit.fieldSeqs,
    publicRead: unit.publicRead,
  }
}

export class Leases {
  constructor(private readonly store: GameStore) {}

  /** A leaving unit's parcel: the unit, its op log and every link touching it. */
  parcelOf(unit: UnitRow, from: HomeAddress, seat: ParcelSeat | null): UnitParcel {
    return {
      leaseId: unit.leaseId ?? '',
      from,
      unit: parcelUnit(unit),
      ops: this.store.opsOf(unit.id),
      links: this.store.linksTouching(unit.id),
      seat,
    }
  }

  get(leaseId: string): { unitId: string; state: string } | null {
    const row = this.store.rows('select unit_id, state from leases where lease_id = ?', leaseId)[0]
    return row === undefined ? null : { unitId: String(row.unit_id), state: String(row.state) }
  }

  put(
    leaseId: string,
    unitId: string,
    direction: 'in' | 'out',
    state: string,
    peer: HomeAddress,
    at: number
  ): void {
    this.store.rows(
      `insert into leases (lease_id, unit_id, direction, state, peer, at) values (?, ?, ?, ?, ?, ?)
       on conflict(lease_id) do update set state = excluded.state, at = excluded.at`,
      leaseId,
      unitId,
      direction,
      state,
      JSON.stringify(peer),
      at
    )
  }

  /**
   * An offer answered: released, the unit is dropped here (`drop`); without
   * `drop`, cancelled, and the unit is writable again. A lease no longer
   * offered is left as it is.
   */
  close(leaseId: string, drop?: (unit: UnitRow) => void): void {
    this.store.sql.transaction(() => {
      const lease = this.get(leaseId)
      if (lease === null || lease.state !== 'offered') return
      const unit = this.store.unit(lease.unitId)
      if (unit !== null && unit.leaseId === leaseId) {
        if (drop === undefined) this.store.putUnit({ ...unit, leaseId: null })
        else drop(unit)
      }
      const state = drop === undefined ? 'cancelled' : 'released'
      this.store.rows('update leases set state = ? where lease_id = ?', state, leaseId)
    })
  }

  /** Offers older than `before`, for the alarm that settles them (`settleLease`). */
  staleOffers(before: number): { leaseId: string; to: HomeAddress }[] {
    return this.store
      .rows(
        "select lease_id, peer from leases where direction = 'out' and state = 'offered' and at < ?",
        before
      )
      .map((row) => ({ leaseId: String(row.lease_id), to: fromJson<HomeAddress>(row.peer) }))
  }

  /** Refuse a lease from now on, unless it was already accepted (`settleLease`). */
  refuse(leaseId: string, at: number): LeaseOutcome {
    return this.store.sql.transaction(() => {
      const lease = this.get(leaseId)
      if (lease?.state === 'accepted') return 'accepted'
      if (lease === null) {
        this.store.rows(
          "insert into leases (lease_id, unit_id, direction, state, peer, at) values (?, '', 'in', 'refused', 'null', ?)",
          leaseId,
          at
        )
      }
      return 'refused'
    })
  }
}
