import type { LinkShape } from 'game-domain/links/linkRules'
import type { AccountBundle } from 'game-domain/migration/bundle'
import { AccountBundleSchema } from 'game-domain/migration/bundle'
import type { UnitRow } from '../game/store'
import { bit } from '../game/store'
import { importedOp, stable } from '../game/transit'
import type { HomeAddress, LeaseOutcome, ParcelSeat, UnitParcel } from '../handoff'
import { Leases, MOVED_OFF } from '../leases'
import { RoomRefusal } from '../refusal'
import { seatOf } from '../seats'
import type { AccountShelf } from './shelf'
import { SHELF_RECORDS } from './shelf'
import type { AccountSoloArea } from './soloArea'

/**
 * Units crossing a Shelf's walls: both halves of the two-room handoff
 * (`../handoff.ts`) and the cutover's one-off import of an account from
 * Convex. A unit goes from a Shelf only into a Game, carried by its
 * player; a pilot takes its solo seat along, and a mech that goes ahead of
 * its pilot leaves the solo seat boarded, so the pilot that follows sits
 * down in it.
 */

export class AccountTransit {
  private readonly leases: Leases

  constructor(
    private readonly shelf: AccountShelf,
    private readonly soloArea: AccountSoloArea
  ) {
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
      if (unit.kind === 'pilot' && parcel.seat !== null) this.putSeat(unit.id, parcel.seat, {}, at)
      this.leases.put(parcel.leaseId, unit.id, 'in', 'accepted', parcel.from, at)
    })
  }

  /** Refuse a lease from now on, unless it was already accepted (`settleLease`). */
  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.leases.refuse(leaseId, at)
  }

  /** A solo seat; what a parcel carries, plus the resolve and Downtime only an import brings. */
  private putSeat(
    pilotId: string,
    seat: ParcelSeat,
    solo: { resolving?: unknown; downtime?: unknown },
    at: number
  ): void {
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
      solo.resolving == null ? null : JSON.stringify(solo.resolving),
      bit(seat.ejected),
      solo.downtime == null ? null : JSON.stringify(solo.downtime),
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

  // ------------------------------------------------------------ the import

  /**
   * Copy an account in from the cutover's bundle, validated here at the
   * room's edge. Idempotent by Discord id: a second import takes nothing, so
   * the copy can be rerun until its sweep is clean; units, records and ops
   * are keyed by their ids besides. Refuses a room that is someone else's.
   * Channel bindings are the bot's step's to take.
   */
  importAccount(raw: unknown, at: number): { imported: boolean } {
    const bundle = AccountBundleSchema.parse(raw)
    return this.store.sql.transaction(() => {
      const source = `account:${bundle.discordId}`
      if (this.store.rows('select 1 from imports where source = ?', source).length > 0) {
        return { imported: false }
      }
      this.shelf.claim(bundle.discordId, at)
      this.store.rows(
        'update account set display_name = ?, avatar_url = ? where id = 1',
        bundle.name,
        bundle.avatarUrl
      )
      for (const unit of bundle.units) {
        this.store.putUnit({
          id: unit.appId,
          kind: unit.kind,
          ownerId: bundle.discordId,
          body: unit.body,
          headSeq: unit.headSeq,
          fieldSeqs: unit.fieldSeqs,
          publicRead: unit.publicRead,
          createdAt: unit.updatedAt,
          updatedAt: unit.updatedAt,
          leaseId: null,
        })
        for (const op of unit.ops) this.store.putOp(importedOp(op))
      }
      for (const link of bundle.links) this.store.putLink(link as LinkShape, at)
      for (const seat of bundle.seats) this.importSeat(seat, at)
      for (const table of SHELF_RECORDS) {
        for (const record of bundle[table]) {
          this.store.rows(
            `insert into records (tbl, app_id, body, extra, updated_at) values (?, ?, ?, ?, ?)
             on conflict(tbl, app_id) do update set body = excluded.body, extra = excluded.extra,
               updated_at = excluded.updated_at`,
            table,
            record.appId,
            JSON.stringify({ ...record.body, id: record.appId }),
            JSON.stringify(record.extra),
            at
          )
        }
      }
      if (bundle.salvageArea !== null) this.soloArea.import(bundle.salvageArea)
      this.store.rows('insert into imports (source, imported_at) values (?, ?)', source, at)
      return { imported: true }
    })
  }

  /** How the room differs from the bundle it was copied from: one line per difference, none when whole. */
  diffImport(bundle: AccountBundle): string[] {
    if (this.shelf.owner() !== bundle.discordId) return [`${bundle.discordId}: not imported`]
    const out: string[] = []
    const units = new Map(this.store.units().map((u) => [u.id, u]))
    for (const unit of bundle.units) {
      const here = units.get(unit.appId)
      units.delete(unit.appId)
      if (here === undefined) {
        out.push(`${unit.kind} ${unit.appId}: missing`)
        continue
      }
      if (here.headSeq !== unit.headSeq)
        out.push(`${unit.appId}: head ${here.headSeq} ≠ ${unit.headSeq}`)
      if (stable(here.body) !== stable(unit.body)) out.push(`${unit.appId}: body differs`)
      const missing = unit.ops.filter((o) => this.store.op(o.id)?.unitId !== unit.appId)
      if (missing.length > 0) out.push(`${unit.appId}: ${missing.length} ops missing`)
    }
    for (const [id, extra] of units) out.push(`${extra.kind} ${id}: not in the bundle`)
    const links = this.store.links().length
    if (links !== bundle.links.length) out.push(`links: ${links} ≠ ${bundle.links.length}`)
    for (const table of SHELF_RECORDS) {
      const n = this.store.rows('select count(*) as n from records where tbl = ?', table)[0]?.n
      if (n !== bundle[table].length) out.push(`${table}: ${n} ≠ ${bundle[table].length}`)
    }
    const area = bundle.salvageArea
    const want =
      area === null ? null : { name: area.name, techLevel: area.techLevel, supply: area.supply }
    if (stable(this.soloArea.here(bundle.discordId)) !== stable(want))
      out.push('salvageArea: differs')
    return out
  }

  private importSeat(seat: Record<string, unknown>, at: number): void {
    const pilotId = seat.pilotId
    if (typeof pilotId !== 'string') return
    this.putSeat(
      pilotId,
      {
        mount: (seat.mount as ParcelSeat['mount'] | undefined) ?? { kind: 'foot' },
        range: typeof seat.range === 'string' ? seat.range : 'Close',
        activeEffects: Array.isArray(seat.activeEffects) ? (seat.activeEffects as string[]) : [],
        ejected: seat.ejected === true,
      },
      { resolving: seat.resolving, downtime: seat.downtime },
      typeof seat.updatedAt === 'number' ? seat.updatedAt : at
    )
  }
}
