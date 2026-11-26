import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { SCENE_CONDITION_IDS } from 'game-domain/schemas/scene'
import { PILOTS_SIDE } from '../../lib/rules/initiative'
import { RoomRefusal } from '../refusal'
import { salvageAreaOf, setSalvageArea, spendSalvageSupply } from '../salvageArea'
import type { GameStore } from './store'
import { fromJson } from './store'
import type { GameUnits } from './units'

/**
 * What the table plays under: the Scene's conditions (play.md §10), which
 * the Mediator switches and every seat reads, and the area being salvaged
 * (Core Book p.245).
 *
 * Passing an hour only counts it: what an hour costs each unit reaches a
 * player's sheet as the Mediator's proposals (ADR-030 §4, ADR-007). Supply is
 * spent here one roll at a time, so two players rolling at once never both
 * spend the last of it; the answer carries the Tech Level it was spent on.
 */

export type SceneRead = {
  conditions: SceneConditionId[]
  hours: number
  /** The pilot the Mediator marked as up now (ADR-051 §9a); absent with none. */
  upNow?: string
  /**
   * The Group Initiative round and the side acting, as every seat reads them
   * (r8 A3): the tracker itself stays the Mediator's. Absent with none kept.
   */
  round?: { n: number; acting: 'pilots' | 'opposition' | null }
  /** What the Mediator put on the table (ADR-068 §4); absent with nothing. */
  onTable?: OnTable
  /** The Mediator is holding the table (ADR-068 §4); absent when not. */
  hold?: true
  /**
   * The rolls the Mediator asked a seat for (ADR-068 §4): all of them to the
   * Mediator, and to a player only those asked of their own pilots.
   */
  asks?: RollAsk[]
}

/** A roll the Mediator asked of one seat: the pilot, and the table by its name. */
export type RollAsk = { pilotId: string; table: string }

/**
 * What the Mediator put on the table, as every seat is served it (ADR-068
 * §4): an NPC by its name and kind alone, never its numbers or actions,
 * or a roll table by its name. The room keeps only this, so nothing more of
 * the Opposition can reach a player.
 */
export type OnTable =
  | { kind: 'npc'; name: string; refSchema: string; refSlug?: string }
  | { kind: 'table'; name: string }

/** What the Mediator asks to put on the table: a tray NPC by id, or a roll table by name. */
export type PutOnTable = { kind: 'npc'; npcId: string } | { kind: 'table'; name: string }

/** The Mediator's markers on the table (ADR-068 §4), each one `change_log` row. */
type MarkerField = 'onTable' | 'hold' | 'asks'

/** The longest roll table name the table keeps: a name, never prose. */
const TABLE_NAME = 80

/** The longest pilot id a marker keeps: an id, never prose. */
const UP_NOW_ID = 128

const CLEAR: SceneRead = { conditions: [], hours: 0 }

export class GameScene {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits
  ) {}

  /** The conditions in catalogue order and the hours passed; a clear Scene for a non-member too. */
  scene(actor: string): SceneRead {
    if (this.store.member(actor) === null) return CLEAR
    const upNow = this.upNow()?.pilotId ?? null
    const round = this.round()
    const onTable = this.kept<{ spot: OnTable | null }>('onTable')?.value.spot ?? null
    const hold = this.kept<{ hold: boolean }>('hold')?.value.hold === true
    const asks = this.asksFor(actor)
    return {
      ...(this.current() ?? CLEAR),
      ...(upNow === null ? {} : { upNow }),
      ...(round === null ? {} : { round }),
      ...(onTable === null ? {} : { onTable }),
      ...(hold ? { hold: true as const } : {}),
      ...(asks.length === 0 ? {} : { asks }),
    }
  }

  /**
   * Ask a seat to roll a table, or take the ask back with null: the
   * Mediator's. A seat holds one ask at a time; a new one replaces it.
   */
  askRoll(actor: string, pilotId: string, table: string | null, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      if (this.store.unit(pilotId)?.kind !== 'pilot') {
        throw new RoomRefusal('That is not a Pilot at this table')
      }
      const name = table === null ? null : this.tableName(table)
      const asks = { ...this.asks() }
      if (name === null) delete asks[pilotId]
      else asks[pilotId] = name
      this.keep('asks', { asks }, actor, at)
    })
  }

  /** The seat answered its ask (it rolled), or the Mediator let it go: the ask is done. */
  answerAsk(actor: string, pilotId: string, at: number): void {
    this.store.sql.transaction(() => {
      const member = this.store.requireMember(actor)
      if (!member.mediator) {
        const pilot = this.store.unit(pilotId)
        if (pilot === null || pilot.kind !== 'pilot') {
          throw new RoomRefusal('That is not a Pilot at this table')
        }
        this.units.assertMayWrite(actor, pilot)
      }
      const asks = { ...this.asks() }
      if (!(pilotId in asks)) return
      delete asks[pilotId]
      this.keep('asks', { asks }, actor, at)
    })
  }

  private asks(): Record<string, string> {
    return this.kept<{ asks: Record<string, string> }>('asks')?.value.asks ?? {}
  }

  /** Every ask to the Mediator; to a player, those asked of the pilots they hold. */
  private asksFor(actor: string): RollAsk[] {
    const member = this.store.member(actor)
    if (member === null) return []
    return Object.entries(this.asks())
      .filter(([pilotId]) => member.mediator || this.store.unit(pilotId)?.ownerId === actor)
      .map(([pilotId, table]) => ({ pilotId, table }))
  }

  private tableName(table: string): string {
    const name = table.trim()
    if (name.length === 0 || name.length > TABLE_NAME) {
      throw new RoomRefusal('That is not a roll table')
    }
    return name
  }

  /**
   * Put a tray NPC or a roll table on the table, or clear it with null: the
   * Mediator's. An NPC is kept as its name and kind alone, read from the
   * tray here, so the room never serves a player more of it.
   */
  putOnTable(actor: string, put: PutOnTable | null, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.keep('onTable', { spot: put === null ? null : this.shareable(put) }, actor, at)
    })
  }

  /** Hold the table, or let it go: the Mediator's, a word to every seat. */
  setHold(actor: string, hold: boolean, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.keep('hold', { hold }, actor, at)
    })
  }

  private shareable(put: PutOnTable): OnTable {
    if (put.kind === 'table') return { kind: 'table', name: this.tableName(put.name) }
    const row = this.store.rows('select body from tray where id = ?', put.npcId)[0]
    if (row === undefined) throw new RoomRefusal('That NPC is no longer on the tray')
    const body = fromJson<{ name?: unknown; refSchema?: unknown; refSlug?: unknown }>(row.body)
    const name = typeof body.name === 'string' ? body.name : ''
    const refSchema = typeof body.refSchema === 'string' ? body.refSchema : 'npcs'
    const refSlug = typeof body.refSlug === 'string' && body.refSlug !== '' ? body.refSlug : null
    return { kind: 'npc', name, refSchema, ...(refSlug === null ? {} : { refSlug }) }
  }

  /** One `change_log` row per marker (`field`), replaced each time. */
  private keep(field: MarkerField, value: object, actor: string, at: number): void {
    this.store.rows('delete from change_log where field = ?', field)
    this.store.rows(
      'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
      field,
      field,
      JSON.stringify(value),
      'mediator-table',
      actor,
      at
    )
  }

  private kept<T>(field: MarkerField): { value: T; at: number } | null {
    const row = this.store.rows('select after, ts from change_log where field = ?', field)[0]
    if (row === undefined) return null
    return { value: fromJson<T>(row.after), at: Number(row.ts) }
  }

  /**
   * Mark whose turn it is, or nobody's with null: the Mediator's, and a marker
   * only. It is one `change_log` row (field `upNow`), replaced each time and
   * kept when cleared, so the Scene's record always reads newer.
   */
  setUpNow(actor: string, pilotId: string | null, at: number): void {
    if (pilotId !== null && (pilotId.length === 0 || pilotId.length > UP_NOW_ID)) {
      throw new RoomRefusal('That is not a Pilot at this table')
    }
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.store.rows("delete from change_log where field = 'upNow'")
      this.store.rows(
        'insert into change_log (id, field, after, source, actor_id, ts) values (?, ?, ?, ?, ?, ?)',
        'up-now',
        'upNow',
        JSON.stringify({ pilotId }),
        'mediator-up-now',
        actor,
        at
      )
    })
  }

  /**
   * The player whose pilot is up ends their own turn (r4 B1): the marker
   * clears, as the Mediator unmarking it would. Answers the pilot whose turn
   * it was. Nobody else's turn is theirs to end, and no turn follows it:
   * there is no order.
   */
  endTurn(actor: string, at: number): string {
    return this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      const pilotId = this.upNow()?.pilotId ?? null
      if (pilotId === null || this.store.unit(pilotId)?.ownerId !== actor) {
        throw new RoomRefusal('It is not your turn to end')
      }
      this.clearUpNow(at)
      return pilotId
    })
  }

  /**
   * Nobody is up any more (r2 E1): the room clears the marker itself when the
   * group session ends and when Downtime begins, whoever asked for either.
   */
  clearUpNow(at: number): void {
    if ((this.upNow()?.pilotId ?? null) === null) return
    this.store.rows(
      "update change_log set after = ?, ts = ? where field = 'upNow'",
      JSON.stringify({ pilotId: null }),
      at
    )
  }

  /** Put the Scene under exactly these conditions, each once; clearing the last clears the hours. */
  setConditions(actor: string, wanted: readonly string[], at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const conditions = SCENE_CONDITION_IDS.filter((id) => wanted.includes(id))
      const hours = conditions.length === 0 ? 0 : (this.current()?.hours ?? 0)
      this.store.rows(
        `insert into scene (id, conditions, hours, updated_at) values (1, ?, ?, ?)
         on conflict (id) do update set conditions = excluded.conditions,
           hours = excluded.hours, updated_at = excluded.updated_at`,
        JSON.stringify(conditions),
        hours,
        at
      )
    })
  }

  /** Count an hour passed under the Scene's conditions; the hour it now is, or 0 with none to pass under. */
  passHour(actor: string, at: number): number {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const scene = this.current()
      if (scene === null || scene.conditions.length === 0) return 0
      const hours = scene.hours + 1
      this.store.rows('update scene set hours = ?, updated_at = ? where id = 1', hours, at)
      return hours
    })
  }

  /** The area being salvaged, for a member; null when there is none. */
  salvageArea(actor: string): SalvageArea | null {
    if (this.store.member(actor) === null) return null
    return salvageAreaOf(this.store)
  }

  /** Set the area being salvaged, or clear it with null: the Mediator's, who says what can be salvaged. */
  setSalvageArea(actor: string, area: SalvageArea | null, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      setSalvageArea(this.store, area, at)
    })
  }

  /**
   * Spend 1 Supply for one Area Salvage roll by `pilotId`, a pilot the caller
   * plays, answering the Tech Level it was spent on and the Supply left.
   */
  spendSupply(actor: string, pilotId: string, at: number): { techLevel: number; supply: number } {
    return this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      const pilot = this.store.unit(pilotId)
      if (pilot === null || pilot.kind !== 'pilot') {
        throw new RoomRefusal('That Pilot is not in this Game')
      }
      this.units.assertMayWrite(actor, pilot)
      return spendSalvageSupply(this.store, at)
    })
  }

  /** When the Scene, or the area, last changed; 0 for one never set. */
  updatedAt(table: 'scene' | 'salvage_area'): number {
    const at = Number(
      this.store.rows(`select updated_at from ${table} where id = 1`)[0]?.updated_at ?? 0
    )
    if (table !== 'scene') return at
    const marks = [
      this.upNow()?.at,
      ...(['onTable', 'hold', 'asks'] as const).map((f) => this.kept(f)?.at),
    ]
    return Math.max(at, this.roundAt(), ...marks.map((m) => m ?? 0))
  }

  private upNow(): { pilotId: string | null; at: number } | null {
    const row = this.store.rows("select after, ts from change_log where field = 'upNow'")[0]
    if (row === undefined) return null
    const { pilotId } = fromJson<{ pilotId: string | null }>(row.after)
    return { pilotId, at: Number(row.ts) }
  }

  /** When the initiative tracker last moved: the Scene's record reads newer with it. */
  private roundAt(): number {
    const row = this.store.rows("select ts from change_log where field = 'initiative'")[0]
    return Number(row?.ts ?? 0)
  }

  /** The tracker's round and acting side, for every seat (r8 A3); null with none kept. */
  private round(): SceneRead['round'] | null {
    const row = this.store.rows("select after from change_log where field = 'initiative'")[0]
    const kept =
      row === undefined ? null : fromJson<{ round?: unknown; side?: unknown } | null>(row.after)
    if (kept === null || typeof kept.round !== 'number') return null
    const acting =
      kept.side === undefined ? null : kept.side === PILOTS_SIDE ? 'pilots' : 'opposition'
    return { n: kept.round, acting }
  }

  private current(): SceneRead | null {
    const row = this.store.rows('select conditions, hours from scene where id = 1')[0]
    if (row === undefined) return null
    return { conditions: fromJson<SceneConditionId[]>(row.conditions), hours: Number(row.hours) }
  }
}
