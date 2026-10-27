import type { EntityKind } from 'game-domain/entityKinds'
import type { LinkShape } from 'game-domain/links/linkRules'
import { CROSS_CONTAINER_REFUSAL, endsMatchType, isSlotted } from 'game-domain/links/linkRules'
import type { StoredOp, UnitRow } from '../game/store'
import { fromJson, GameStore } from '../game/store'
import type { SubmitResult } from '../game/units'
import { crawlerHasSlot, GameUnits, parseUnitBody } from '../game/units'
import type { ApplyOp, OpInput } from '../ops'
import { RoomRefusal } from '../refusal'
import type { RoomSql } from '../sql'

/**
 * A player's Shelf: their units, op logs and wiring, written only by them
 * (ADR-030 §2). The rows are the Game room's (`../game/schema.ts`), so the
 * Game room's store reads them and its op apply writes them; what differs
 * is who may act, which here is one person.
 */

const NOT_YOURS = 'That is not your Training Bay'
const LEAVING = 'That is on its way somewhere else; try again in a moment'

/** The op-less tables an account room keeps. */
export const SHELF_RECORDS = ['patterns', 'encounters', 'npcTray'] as const
export type ShelfRecord = (typeof SHELF_RECORDS)[number]

/** The player's own overrides on their Discord name and avatar. */
export type Profile = { displayName: string | null; avatarUrl: string | null }

/** The Shelf's part of an account export: every body the player owns here. */
export type ShelfExport = Record<
  'pilots' | 'mechs' | 'npcs' | 'mechPatterns' | 'encounters',
  Record<string, unknown>[]
>

export class AccountShelf {
  readonly store: GameStore
  readonly units: GameUnits

  constructor(sql: RoomSql, deps: { applyOp: ApplyOp; newId: () => string }) {
    this.store = new GameStore(sql)
    this.units = new GameUnits(this.store, deps.applyOp, deps.newId)
  }

  // ---------------------------------------------------------------- whose

  /** The Discord id this room belongs to, once claimed or imported. */
  owner(): string | null {
    const row = this.store.rows('select discord_id from account where id = 1')[0]
    return row === undefined ? null : String(row.discord_id)
  }

  /**
   * Name the room's player, the first time the Worker opens it for them.
   * Claiming again as the same player is a no-op; as anyone else, a defect:
   * the Worker names a room by its player.
   */
  claim(discordId: string, at: number): void {
    const owner = this.owner()
    if (owner === discordId) return
    if (owner !== null) throw new Error(`This account room is ${owner}'s, not ${discordId}'s`)
    this.store.rows(
      'insert into account (id, discord_id, created_at) values (1, ?, ?)',
      discordId,
      at
    )
  }

  requireOwner(actor: string): void {
    if (this.owner() !== actor) throw new RoomRefusal(NOT_YOURS)
  }

  // -------------------------------------------------------------- profile

  /** The player's own name and avatar, each null where they set none (Discord's shows). */
  profile(actor: string): Profile | null {
    if (this.owner() !== actor) return null
    const row = this.store.rows('select display_name, avatar_url from account where id = 1')[0]
    return {
      displayName: row?.display_name == null ? null : String(row.display_name),
      avatarUrl: row?.avatar_url == null ? null : String(row.avatar_url),
    }
  }

  /**
   * Set or clear the name and avatar shown on every owner chip. Each is an
   * override on the Discord profile: a blank one clears it, so Discord's
   * shows again rather than nothing. A field left out is kept.
   */
  setProfile(actor: string, patch: { displayName?: string | null; avatarUrl?: string | null }) {
    this.requireOwner(actor)
    const now = this.profile(actor) as Profile
    const blankIsNull = (value: string | null | undefined, was: string | null) => {
      if (value === undefined) return was
      const trimmed = value?.trim() ?? ''
      return trimmed.length > 0 ? trimmed : null
    }
    this.store.rows(
      'update account set display_name = ?, avatar_url = ? where id = 1',
      blankIsNull(patch.displayName, now.displayName),
      blankIsNull(patch.avatarUrl, now.avatarUrl)
    )
  }

  /** How many of each the player keeps here: their row in the metrics' totals. */
  totals(): Record<'pilots' | 'mechs' | 'crawlers' | 'npcs' | 'patterns', number> {
    const count = (kind: EntityKind) => this.store.units().filter((u) => u.kind === kind).length
    const patterns = this.store.rows("select count(*) as n from records where tbl = 'patterns'")[0]
    return {
      pilots: count('pilot'),
      mechs: count('mech'),
      crawlers: count('crawler'),
      npcs: count('npc'),
      patterns: Number(patterns?.n ?? 0),
    }
  }

  /**
   * What the player owns here, for download (`account.exportMine`'s shape):
   * their pilots, mechs and NPCs, saved patterns and encounters. A crawler is
   * the table's, so it stays out.
   */
  exportFor(actor: string): ShelfExport | null {
    if (this.owner() !== actor) return null
    const bodiesOf = (kind: EntityKind) =>
      this.store
        .units()
        .filter((u) => u.kind === kind && u.ownerId === actor)
        .map((u) => u.body)
    const recordsOf = (table: ShelfRecord) => this.records(actor, table).map((r) => r.body)
    return {
      pilots: bodiesOf('pilot'),
      mechs: bodiesOf('mech'),
      npcs: bodiesOf('npc'),
      mechPatterns: recordsOf('patterns'),
      encounters: recordsOf('encounters'),
    }
  }

  /** A unit on this Shelf the actor may write, or a refusal. */
  writable(actor: string, unitId: string): UnitRow {
    this.requireOwner(actor)
    const unit = this.store.unit(unitId)
    if (unit === null) throw new RoomRefusal('That is not in your Training Bay')
    if (unit.leaseId !== null) throw new RoomRefusal(LEAVING)
    return unit
  }

  // ---------------------------------------------------------------- units

  /** Create a unit on the Shelf. Creating an id already here is a no-op. */
  create(actor: string, args: { id: string; kind: EntityKind; body: unknown; at: number }): void {
    this.store.sql.transaction(() => {
      this.requireOwner(actor)
      const existing = this.store.unit(args.id)
      if (existing !== null) {
        if (existing.kind !== args.kind) throw new Error(`${args.id} is already a ${existing.kind}`)
        return
      }
      this.store.putUnit({
        id: args.id,
        kind: args.kind,
        ownerId: actor,
        body: parseUnitBody(args.kind, args.id, args.body),
        headSeq: 0,
        fieldSeqs: {},
        publicRead: false,
        createdAt: args.at,
        updatedAt: args.at,
        leaseId: null,
      })
    })
  }

  /**
   * Apply a batch of ops, all or none (ADR-063 §3). An op id already
   * applied is skipped, so a replayed outbox lands nothing twice; the Shelf
   * is the player's own, so a replay after time offline is never refused for
   * being one.
   */
  submit(actor: string, ops: readonly OpInput[]): SubmitResult {
    return this.units.applyBatch(actor, ops, (input) => this.writable(actor, input.unitId))
  }

  /**
   * Delete a unit with its links and seat. Deleting a mech leaves its solo
   * pilot on foot; moving one out does not (`./transit.ts`).
   */
  remove(actor: string, unitId: string): void {
    this.store.sql.transaction(() => {
      if (this.store.unit(unitId) === null) return
      const unit = this.writable(actor, unitId)
      this.drop(unit)
      if (unit.kind === 'mech') this.units.standUp(unit.id)
    })
  }

  /** Take a unit off the Shelf with its links and, a pilot, its seat. */
  drop(unit: UnitRow): void {
    this.store.deleteUnit(unit.id)
    this.store.deleteLinksTouching(unit.id)
    if (unit.kind === 'pilot') this.store.rows('delete from seats where pilot_id = ?', unit.id)
  }

  // ---------------------------------------------------------------- links

  /**
   * Wire two units on the Shelf (ADR-037), replacing the links it conflicts
   * with. A crew link is the crawler's writer's (ADR-044), which on the Shelf
   * is its player, and names a slot the crawler has; an end that is not on
   * the Shelf is in another place.
   */
  drawLink(actor: string, link: LinkShape): void {
    if (!endsMatchType(link)) {
      throw new Error(`A ${link.type} link cannot join ${link.from.type} → ${link.to.type}`)
    }
    if (isSlotted(link.type) !== (link.slot !== undefined)) {
      throw new Error(`A ${link.type} link ${isSlotted(link.type) ? 'names' : 'has no'} crew slot`)
    }
    this.store.sql.transaction(() => {
      this.writable(actor, link.from.id)
      const to = this.store.unit(link.to.id)
      if (to === null) throw new RoomRefusal(CROSS_CONTAINER_REFUSAL)
      if (link.slot !== undefined && !crawlerHasSlot(to.body, link.slot)) {
        throw new RoomRefusal('That crawler has no such crew slot.')
      }
      this.units.writeLink(link)
    })
  }

  /** Unwire a link. Already gone is not an error. */
  removeLink(actor: string, link: LinkShape): void {
    this.store.sql.transaction(() => {
      this.requireOwner(actor)
      this.store.deleteLink(link)
    })
  }

  // ---------------------------------------------------------------- reads

  /** Every unit on the Shelf, for its player; anyone else reads nothing. */
  list(actor: string): UnitRow[] {
    return this.owner() === actor ? this.store.units() : []
  }

  links(actor: string): LinkShape[] {
    return this.owner() === actor ? this.store.links() : []
  }

  /** One unit's op log, newest first, for its Change Log. */
  history(actor: string, unitId: string): StoredOp[] {
    return this.owner() === actor ? this.store.opsOf(unitId).reverse() : []
  }

  /** One op-less table's bodies, each carrying its id. */
  records(actor: string, table: ShelfRecord): { appId: string; body: Record<string, unknown> }[] {
    if (this.owner() !== actor) return []
    return this.store
      .rows('select app_id, body from records where tbl = ? order by app_id', table)
      .map((row) => ({ appId: String(row.app_id), body: fromJson(row.body) }))
  }
}
