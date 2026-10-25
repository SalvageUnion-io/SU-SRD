import type { EntityKind } from 'game-domain/entityKinds'
import { hasMediator, runsTable } from 'game-domain/games/roles'
import type { LinkShape } from 'game-domain/links/linkRules'
import { slotKey } from 'game-domain/links/linkRules'
import type { CrewSlot } from 'game-domain/schemas/softLink'
import type { Op, OpState, Unit } from '../ops'
import { RoomRefusal } from '../refusal'
import type { RoomSql, SqlRow, SqlValue } from '../sql'

/**
 * The Game room's rows, read and written (`schema.ts`), and the role checks
 * every act makes first (ADR-030 §3). Authorization lives in these checks and
 * the acts that call them; a client hides what they refuse as a courtesy.
 */

export type Member = {
  userId: string
  mediator: boolean
  organizer: boolean
  joinedAt: number
  displayName: string | null
  avatarUrl: string | null
}

export type UnitRow = {
  id: string
  kind: EntityKind
  ownerId: string | null
  body: Record<string, unknown>
  headSeq: number
  fieldSeqs: Record<string, number>
  publicRead: boolean
  createdAt: number
  updatedAt: number
  leaseId: string | null
}

export type GameRow = {
  gameId: string
  name: string
  templateOrigin: string | null
  primaryCrawlerId: string | null
  createdAt: number
  disbandingAt: number | null
}

export type StoredOp = Op & { supersededBy: string | null }

type Row = SqlRow

/** The copy every act refuses with for someone outside the Game. */
const NOT_A_MEMBER = 'Not a member of this Game'

const ENDING = 'This Game is ending'

const TABLE_RUNNER_ONLY =
  'Only the Mediator can do that (or the Organiser, when the Game has no Mediator)'

export class GameStore {
  constructor(readonly sql: RoomSql) {}

  // ---------------------------------------------------------------- the Game

  game(): GameRow | null {
    const row = this.sql.exec('select * from game where id = 1')[0]
    if (row === undefined) return null
    return {
      gameId: String(row.game_id),
      name: String(row.name),
      templateOrigin: (row.template_origin as string | null) ?? null,
      primaryCrawlerId: (row.primary_crawler_id as string | null) ?? null,
      createdAt: Number(row.created_at),
      disbandingAt: row.disbanding_at === null ? null : Number(row.disbanding_at),
    }
  }

  requireGame(): GameRow {
    const game = this.game()
    if (game === null) throw new RoomRefusal('That Game no longer exists')
    return game
  }

  setPrimaryCrawlerId(crawlerId: string | null): void {
    this.sql.exec('update game set primary_crawler_id = ? where id = 1', crawlerId)
  }

  // ------------------------------------------------------------- the roster

  members(): Member[] {
    return this.sql.exec('select * from members order by joined_at, user_id').map(memberOf)
  }

  member(userId: string): Member | null {
    const row = this.sql.exec('select * from members where user_id = ?', userId)[0]
    return row === undefined ? null : memberOf(row)
  }

  putMember(member: Member): void {
    this.sql.exec(
      `insert into members (user_id, mediator, organizer, joined_at, display_name, avatar_url)
       values (?, ?, ?, ?, ?, ?)
       on conflict(user_id) do update set mediator = excluded.mediator,
         organizer = excluded.organizer, display_name = excluded.display_name,
         avatar_url = excluded.avatar_url`,
      member.userId,
      bit(member.mediator),
      bit(member.organizer),
      member.joinedAt,
      member.displayName,
      member.avatarUrl
    )
  }

  deleteMember(userId: string): void {
    this.sql.exec('delete from members where user_id = ?', userId)
  }

  /**
   * The member, or a refusal. Every act on the Game starts here, so a Game
   * its Organizer is ending refuses them all while it hands its units back.
   */
  requireMember(userId: string): Member {
    const member = this.member(userId)
    if (member === null) throw new RoomRefusal(NOT_A_MEMBER)
    if (this.game()?.disbandingAt != null) throw new RoomRefusal(ENDING)
    return member
  }

  requireMediator(userId: string): Member {
    const member = this.requireMember(userId)
    if (!member.mediator) throw new RoomRefusal('Only the Mediator can do that')
    return member
  }

  requireOrganizer(userId: string): Member {
    const member = this.requireMember(userId)
    if (!member.organizer) throw new RoomRefusal('Only the Organiser can do that')
    return member
  }

  /** The Mediator, or the Organizer while nobody mediates (`isTableRunner` on Convex). */
  isTableRunner(member: Member): boolean {
    return runsTable(member, hasMediator(this.members()))
  }

  requireTableRunner(userId: string): Member {
    const member = this.requireMember(userId)
    if (!this.isTableRunner(member)) throw new RoomRefusal(TABLE_RUNNER_ONLY)
    return member
  }

  // ------------------------------------------------------------------ units

  units(kind?: EntityKind): UnitRow[] {
    const rows =
      kind === undefined
        ? this.sql.exec('select * from units order by created_at, id')
        : this.sql.exec('select * from units where kind = ? order by created_at, id', kind)
    return rows.map(unitOf)
  }

  unit(id: string): UnitRow | null {
    const row = this.sql.exec('select * from units where id = ?', id)[0]
    return row === undefined ? null : unitOf(row)
  }

  requireUnit(id: string): UnitRow {
    const unit = this.unit(id)
    if (unit === null) throw new RoomRefusal('That is not in this Game')
    return unit
  }

  putUnit(unit: UnitRow): void {
    this.sql.exec(
      `insert into units (id, kind, owner_id, body, head_seq, field_seqs, public_read, created_at, updated_at, lease_id)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set owner_id = excluded.owner_id, body = excluded.body,
         head_seq = excluded.head_seq, field_seqs = excluded.field_seqs,
         public_read = excluded.public_read, updated_at = excluded.updated_at,
         lease_id = excluded.lease_id`,
      unit.id,
      unit.kind,
      unit.ownerId,
      JSON.stringify(unit.body),
      unit.headSeq,
      JSON.stringify(unit.fieldSeqs),
      bit(unit.publicRead),
      unit.createdAt,
      unit.updatedAt,
      unit.leaseId
    )
  }

  deleteUnit(id: string): void {
    this.sql.exec('delete from units where id = ?', id)
    this.sql.exec('delete from ops where unit_id = ?', id)
  }

  /** A unit as `applyOp` reads it. */
  asUnit(row: UnitRow): Unit {
    return { kind: row.kind, body: row.body, headSeq: row.headSeq, fieldSeqs: row.fieldSeqs }
  }

  // -------------------------------------------------------------------- ops

  op(id: string): StoredOp | null {
    const row = this.sql.exec('select * from ops where id = ?', id)[0]
    return row === undefined ? null : opOf(row)
  }

  opsOf(unitId: string): StoredOp[] {
    return this.sql
      .exec('select * from ops where unit_id = ? order by seq is null, seq, at, id', unitId)
      .map(opOf)
  }

  opsIn(state: OpState): StoredOp[] {
    return this.sql.exec('select * from ops where state = ? order by at desc, id', state).map(opOf)
  }

  putOp(op: StoredOp): void {
    this.sql.exec(
      `insert into ops (id, unit_id, seq, base_seq, author, at, kind, source, state, patch, unset, before, reason, superseded_by)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set seq = excluded.seq, state = excluded.state,
         before = excluded.before, superseded_by = excluded.superseded_by`,
      op.id,
      op.unitId,
      op.seq,
      op.baseSeq,
      op.author,
      op.at,
      op.kind,
      op.source,
      op.state,
      JSON.stringify(op.patch),
      op.unset === undefined ? null : JSON.stringify(op.unset),
      op.before === null ? null : JSON.stringify(op.before),
      op.reason ?? null,
      op.supersededBy
    )
  }

  // ------------------------------------------------------------------ links

  links(): LinkShape[] {
    return this.sql.exec('select * from links order by type, from_id, to_id').map(linkOf)
  }

  linksTouching(unitId: string): LinkShape[] {
    return this.sql
      .exec('select * from links where from_id = ? or to_id = ?', unitId, unitId)
      .map(linkOf)
  }

  putLink(link: LinkShape): void {
    this.sql.exec(
      'insert or ignore into links (type, from_id, to_id, slot_key, slot) values (?, ?, ?, ?, ?)',
      link.type,
      link.from.id,
      link.to.id,
      slotKey(link.slot),
      link.slot === undefined ? null : JSON.stringify(link.slot)
    )
  }

  deleteLink(link: LinkShape): void {
    this.sql.exec(
      'delete from links where type = ? and from_id = ? and to_id = ? and slot_key = ?',
      link.type,
      link.from.id,
      link.to.id,
      slotKey(link.slot)
    )
  }

  deleteLinksTouching(unitId: string): void {
    this.sql.exec('delete from links where from_id = ? or to_id = ?', unitId, unitId)
  }

  // ------------------------------------------------------------- one-liners

  /** Run `query` and return its rows; for the play and opposition modules. */
  rows(query: string, ...binds: SqlValue[]): Row[] {
    return this.sql.exec(query, ...binds)
  }
}

const KIND_OF_END: Record<string, EntityKind> = {
  pilot: 'pilot',
  mech: 'mech',
  crawler: 'crawler',
  npc: 'npc',
}

/** The end types of each link type, so a stored row rebuilds its `LinkShape`. */
const ENDS: Record<LinkShape['type'], [EntityKind, EntityKind]> = {
  'mech-to-pilot': ['mech', 'pilot'],
  'pilot-to-crawler': ['pilot', 'crawler'],
  'mech-to-crawler': ['mech', 'crawler'],
  'npc-to-crawler': ['npc', 'crawler'],
}

function linkOf(row: Row): LinkShape {
  const type = row.type as LinkShape['type']
  const [from, to] = ENDS[type]
  const slot = fromJsonOrNull<CrewSlot>(row.slot)
  return {
    type,
    from: { type: KIND_OF_END[from] ?? from, id: String(row.from_id) },
    to: { type: KIND_OF_END[to] ?? to, id: String(row.to_id) },
    ...(slot === null ? {} : { slot }),
  }
}

function memberOf(row: Row): Member {
  return {
    userId: String(row.user_id),
    mediator: row.mediator === 1,
    organizer: row.organizer === 1,
    joinedAt: Number(row.joined_at),
    displayName: (row.display_name as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
  }
}

function unitOf(row: Row): UnitRow {
  return {
    id: String(row.id),
    kind: row.kind as EntityKind,
    ownerId: (row.owner_id as string | null) ?? null,
    body: fromJson(row.body),
    headSeq: Number(row.head_seq),
    fieldSeqs: fromJson(row.field_seqs),
    publicRead: row.public_read === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    leaseId: (row.lease_id as string | null) ?? null,
  }
}

function opOf(row: Row): StoredOp {
  const unset = fromJsonOrNull<string[]>(row.unset)
  const reason = row.reason as string | null
  return {
    id: String(row.id),
    unitId: String(row.unit_id),
    seq: row.seq === null ? null : Number(row.seq),
    baseSeq: row.base_seq === null ? null : Number(row.base_seq),
    author: String(row.author),
    at: Number(row.at),
    kind: row.kind as Op['kind'],
    source: String(row.source),
    state: row.state as OpState,
    patch: fromJson(row.patch),
    ...(unset === null ? {} : { unset }),
    before: fromJsonOrNull(row.before),
    ...(reason === null ? {} : { reason }),
    supersededBy: (row.superseded_by as string | null) ?? null,
  }
}

export function bit(value: boolean): number {
  return value ? 1 : 0
}

/** A JSON column, parsed. Columns hold only what the room itself wrote. */
export function fromJson<T>(value: SqlValue | undefined): T {
  return JSON.parse(String(value)) as T
}

/** A JSON column, or null for SQL NULL. */
export function fromJsonOrNull<T>(value: SqlValue | undefined): T | null {
  return value === null || value === undefined ? null : fromJson<T>(value)
}
