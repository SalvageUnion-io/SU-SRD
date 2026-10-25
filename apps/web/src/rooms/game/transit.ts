import type { LinkShape } from 'game-domain/links/linkRules'
import type { GameBundle } from 'game-domain/migration/bundle'
import { GameBundleSchema } from 'game-domain/migration/bundle'
import type { HomeAddress, LeaseOutcome, ParcelSeat, UnitParcel } from '../handoff'
import { RoomRefusal } from '../refusal'
import type { GamePlay } from './play'
import { downtimeStepOpId } from './play'
import type { GameStore, StoredOp, UnitRow } from './store'
import { fromJson } from './store'
import type { GameUnits } from './units'

/**
 * Units crossing this Game's walls: both halves of the two-room handoff
 * (`../handoff.ts`), and the cutover's one-off import of a Game from Convex
 * with the check that the copy matches what it was copied from.
 *
 * A move keeps the rules `convex/model/ownableWrites.ts` and
 * `crawlerWrites.ts` enforced: a pilot, mech or NPC is moved by its holder,
 * into a Game they are a member of; a crawler only by the table runner,
 * between the Game and their own Training Bay, never Game to Game. A link
 * whose other end is not where the unit lands is dropped (ADR-037).
 */

const MOVED_OFF = 'That move was called off'
const ALREADY_HERE = 'That is already in this Game'

export class GameTransit {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits,
    private readonly play: GamePlay
  ) {}

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
      this.putLease(args.leaseId, unit.id, 'out', 'offered', args.to, args.at)
      return this.parcelOf({ ...unit, leaseId: args.leaseId }, game.gameId)
    })
  }

  /**
   * The target has the unit: drop it here, with its links and seat; a mech
   * leaves whoever was aboard on foot, and a primary crawler hands over to
   * the oldest left. Releasing twice is a no-op.
   */
  release(leaseId: string): void {
    this.store.sql.transaction(() => {
      const lease = this.lease(leaseId)
      if (lease === null || lease.state !== 'offered') return
      const unit = this.store.unit(lease.unitId)
      if (unit !== null && unit.leaseId === leaseId) this.units.drop(unit)
      this.store.rows("update leases set state = 'released' where lease_id = ?", leaseId)
    })
  }

  /** The target refused it: the unit stays, writable again. */
  cancel(leaseId: string): void {
    this.store.sql.transaction(() => {
      const lease = this.lease(leaseId)
      if (lease === null || lease.state !== 'offered') return
      const unit = this.store.unit(lease.unitId)
      if (unit !== null && unit.leaseId === leaseId) this.store.putUnit({ ...unit, leaseId: null })
      this.store.rows("update leases set state = 'cancelled' where lease_id = ?", leaseId)
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

  private parcelOf(unit: UnitRow, gameId: string): UnitParcel {
    return {
      leaseId: unit.leaseId ?? '',
      from: { kind: 'game', gameId },
      unit: {
        id: unit.id,
        kind: unit.kind,
        ownerId: unit.ownerId,
        body: unit.body,
        headSeq: unit.headSeq,
        fieldSeqs: unit.fieldSeqs,
        publicRead: unit.publicRead,
      },
      ops: this.store.opsOf(unit.id),
      links: this.store.linksTouching(unit.id),
      // A pilot's seat at this table stays here: it describes play here.
      seat: null,
    }
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
      const lease = this.lease(parcel.leaseId)
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
      this.putLease(parcel.leaseId, unit.id, 'in', 'accepted', parcel.from, at)
    })
  }

  /** Refuse a lease from now on, unless it was already accepted (`settleLease`). */
  refuseLease(leaseId: string, at: number): LeaseOutcome {
    return this.store.sql.transaction(() => {
      const lease = this.lease(leaseId)
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

  private lease(leaseId: string): { unitId: string; state: string } | null {
    const row = this.store.rows('select unit_id, state from leases where lease_id = ?', leaseId)[0]
    return row === undefined ? null : { unitId: String(row.unit_id), state: String(row.state) }
  }

  private putLease(
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

  // ------------------------------------------------------------ the import

  /**
   * Copy a Game in from the cutover's bundle. Idempotent by the
   * bundle's Game id: a second import of the same Game takes nothing, so the
   * copy can be rerun until its sweep is clean. Refuses a room that already
   * holds some other Game. Its channel bindings and crew patterns are not
   * kept here: the bot's and shared reads' steps take them.
   */
  importGame(raw: unknown, at: number): { imported: boolean } {
    const bundle = GameBundleSchema.parse(raw)
    return this.store.sql.transaction(() => {
      const source = `game:${bundle.gameId}`
      if (this.store.rows('select 1 from imports where source = ?', source).length > 0) {
        return { imported: false }
      }
      if (this.store.game() !== null) {
        throw new Error(`This room already holds a Game; ${bundle.gameId} cannot be imported here`)
      }
      const createdAt = Math.min(at, ...bundle.members.map((m) => m.joinedAt))
      this.store.rows(
        'insert into game (id, game_id, name, primary_crawler_id, created_at) values (1, ?, ?, ?, ?)',
        bundle.gameId,
        bundle.name,
        bundle.primaryCrawler,
        createdAt
      )
      for (const m of bundle.members) {
        this.store.putMember({
          userId: m.discordId,
          mediator: m.mediator,
          organizer: m.organizer,
          joinedAt: m.joinedAt,
          displayName: null,
          avatarUrl: null,
        })
      }
      const organizer = bundle.members.find((m) => m.organizer)?.discordId ?? null
      if (bundle.inviteCode !== null && organizer !== null) {
        this.store.rows(
          'insert into invites (code, created_by, created_at) values (?, ?, ?)',
          bundle.inviteCode.trim().toUpperCase(),
          organizer,
          createdAt
        )
      }
      for (const unit of bundle.units) {
        this.store.putUnit({
          id: unit.appId,
          kind: unit.kind,
          ownerId: unit.kind === 'crawler' ? null : unit.owner,
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
      for (const link of bundle.links) this.store.putLink(link as LinkShape)
      for (const seat of bundle.seats) this.importSeat(seat, at)
      this.importDowntime(bundle, at)
      for (const npc of bundle.opposition) {
        this.store.rows(
          'insert into tray (id, body, added_at) values (?, ?, ?)',
          npc.appId,
          JSON.stringify({ ...npc.body, id: npc.appId }),
          at
        )
      }
      if (bundle.runningEncounter !== null) {
        this.store.rows(
          'insert into running_encounter (id, body) values (1, ?)',
          JSON.stringify(bundle.runningEncounter)
        )
      }
      this.store.rows('insert into imports (source, imported_at) values (?, ?)', source, at)
      return { imported: true }
    })
  }

  /**
   * How the room differs from the bundle it was copied from: one line per
   * difference, none when the copy is whole. The cutover's sweep runs it on
   * every Game before Convex goes read-only.
   */
  diffImport(bundle: GameBundle): string[] {
    const out: string[] = []
    const game = this.store.game()
    if (game === null) return [`${bundle.gameId}: not imported`]
    if (game.name !== bundle.name) out.push(`name: ${game.name} ≠ ${bundle.name}`)
    const members = new Map(this.store.members().map((m) => [m.userId, m]))
    for (const m of bundle.members) {
      const here = members.get(m.discordId)
      if (here === undefined) out.push(`member ${m.discordId}: missing`)
      else if (here.mediator !== m.mediator || here.organizer !== m.organizer) {
        out.push(`member ${m.discordId}: roles differ`)
      }
      members.delete(m.discordId)
    }
    for (const extra of members.keys()) out.push(`member ${extra}: not in the bundle`)
    const units = new Map(this.store.units().map((u) => [u.id, u]))
    for (const unit of bundle.units) {
      const here = units.get(unit.appId)
      units.delete(unit.appId)
      if (here === undefined) {
        out.push(`${unit.kind} ${unit.appId}: missing`)
        continue
      }
      if (here.kind !== unit.kind) out.push(`${unit.appId}: a ${here.kind}, not a ${unit.kind}`)
      if (here.headSeq !== unit.headSeq)
        out.push(`${unit.appId}: head ${here.headSeq} ≠ ${unit.headSeq}`)
      if (stable(here.body) !== stable(unit.body)) out.push(`${unit.appId}: body differs`)
      const owner = unit.kind === 'crawler' ? null : unit.owner
      if (here.ownerId !== owner) out.push(`${unit.appId}: holder differs`)
      const missing = unit.ops.filter((o) => this.store.op(o.id)?.unitId !== unit.appId)
      if (missing.length > 0) out.push(`${unit.appId}: ${missing.length} ops missing`)
    }
    for (const [id, extra] of units) out.push(`${extra.kind} ${id}: not in the bundle`)
    const links = this.store.links().length
    if (links !== bundle.links.length) out.push(`links: ${links} ≠ ${bundle.links.length}`)
    const tray = this.store.rows('select count(*) as n from tray')[0]?.n
    if (tray !== bundle.opposition.length) out.push(`tray: ${tray} ≠ ${bundle.opposition.length}`)
    return out
  }

  private importSeat(seat: Record<string, unknown>, at: number): void {
    const pilotId = seat.pilotId
    if (typeof pilotId !== 'string') return
    const mount = seat.mount as ParcelSeat['mount'] | undefined
    this.play.putSeat({
      pilotId,
      mount: mount ?? { kind: 'foot' },
      range: (typeof seat.range === 'string' ? seat.range : 'Close') as never,
      activeEffects: Array.isArray(seat.activeEffects) ? (seat.activeEffects as string[]) : [],
      resolving: (seat.resolving as never) ?? null,
      ejected: seat.ejected === true,
      updatedAt: typeof seat.updatedAt === 'number' ? seat.updatedAt : at,
    })
  }

  /**
   * A Downtime running at the cutover carries on. Each step a pilot claimed
   * on Convex is written as its step op, so applying it again here is the
   * no-op ADR-063 §6 promises.
   */
  private importDowntime(bundle: GameBundle, at: number): void {
    const downtime = bundle.downtime
    if (downtime === null || typeof downtime.stepIndex !== 'number') return
    const runId = `import:${bundle.gameId}`
    this.store.rows(
      `insert into downtime_run (id, run_id, step_index, started_at, completed_by, upkeep_spent)
       values (1, ?, ?, ?, ?, ?)`,
      runId,
      downtime.stepIndex,
      typeof downtime.startedAt === 'number' ? downtime.startedAt : at,
      JSON.stringify(Array.isArray(downtime.completedBy) ? downtime.completedBy : []),
      downtime.upkeepSpent === true ? 1 : 0
    )
    const claimed = Array.isArray(downtime.claimed) ? downtime.claimed : []
    for (const claim of claimed as { pilotId?: unknown; stepIndex?: unknown }[]) {
      if (typeof claim.pilotId !== 'string' || typeof claim.stepIndex !== 'number') continue
      this.store.putOp({
        id: downtimeStepOpId(runId, claim.pilotId, claim.stepIndex),
        unitId: claim.pilotId,
        baseSeq: null,
        at,
        kind: 'transaction',
        source: 'downtime',
        patch: {},
        author: claim.pilotId,
        state: 'applied',
        seq: null,
        before: null,
        supersededBy: null,
      })
    }
  }
}

/** A bundle op as the room keeps it: a superseded proposal is a declined one that names its successor. */
function importedOp(op: GameBundle['units'][number]['ops'][number]): StoredOp {
  const { state, author, ...rest } = op
  return {
    ...rest,
    author: author ?? '',
    state: state === 'superseded' ? 'declined' : state,
    supersededBy: state === 'superseded' ? 'superseded' : null,
  }
}

/** JSON with sorted keys, so two bodies compare by content. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  )
}
