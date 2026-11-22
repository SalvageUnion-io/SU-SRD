import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { SCENE_CONDITION_IDS } from 'game-domain/schemas/scene'
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
}

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
    return { ...(this.current() ?? CLEAR), ...(upNow === null ? {} : { upNow }) }
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
    return table === 'scene' ? Math.max(at, this.upNow()?.at ?? 0) : at
  }

  private upNow(): { pilotId: string | null; at: number } | null {
    const row = this.store.rows("select after, ts from change_log where field = 'upNow'")[0]
    if (row === undefined) return null
    const { pilotId } = fromJson<{ pilotId: string | null }>(row.after)
    return { pilotId, at: Number(row.ts) }
  }

  private current(): SceneRead | null {
    const row = this.store.rows('select conditions, hours from scene where id = 1')[0]
    if (row === undefined) return null
    return { conditions: fromJson<SceneConditionId[]>(row.conditions), hours: Number(row.hours) }
  }
}
