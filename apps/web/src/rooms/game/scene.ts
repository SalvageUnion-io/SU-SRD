import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import { SalvageAreaSchema } from 'game-domain/schemas/salvageArea'
import type { SceneConditionId } from 'game-domain/schemas/scene'
import { SCENE_CONDITION_IDS } from 'game-domain/schemas/scene'
import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'
import { fromJson } from './store'
import type { GameUnits } from './units'

/**
 * What the table plays under, with `convex/scenes.ts` and `salvageAreas.ts`'s
 * rules: the Scene's conditions (play.md §10), which the Mediator switches and
 * every seat reads, and the area being salvaged (Core Book p.245).
 *
 * Passing an hour only counts it: what an hour costs each unit reaches a
 * player's sheet as the Mediator's proposals (ADR-030 §4, ADR-007). Supply is
 * spent here one roll at a time, so two players rolling at once never both
 * spend the last of it; the answer carries the Tech Level it was spent on.
 */

export type SceneRead = { conditions: SceneConditionId[]; hours: number }

const CLEAR: SceneRead = { conditions: [], hours: 0 }

export class GameScene {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits
  ) {}

  /** The conditions in catalogue order and the hours passed; a clear Scene for a non-member too. */
  scene(actor: string): SceneRead {
    if (this.store.member(actor) === null) return CLEAR
    return this.current() ?? CLEAR
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
    return this.area()
  }

  /** Set the area being salvaged, or clear it with null: the Mediator's, who says what can be salvaged. */
  setSalvageArea(actor: string, area: SalvageArea | null, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      if (area === null) {
        this.store.rows('delete from salvage_area')
        return
      }
      const parsed = SalvageAreaSchema.safeParse({ ...area, name: area.name.trim() })
      if (!parsed.success) throw new RoomRefusal('An area has a Tech Level of 1 to 6 and a Supply')
      const { name, techLevel, supply } = parsed.data
      this.store.rows(
        `insert into salvage_area (id, name, tech_level, supply, updated_at) values (1, ?, ?, ?, ?)
         on conflict (id) do update set name = excluded.name, tech_level = excluded.tech_level,
           supply = excluded.supply, updated_at = excluded.updated_at`,
        name,
        techLevel,
        supply,
        at
      )
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
      const area = this.area()
      if (area === null) throw new RoomRefusal('There is no area to salvage here')
      if (area.supply <= 0) throw new RoomRefusal('This area is picked clean')
      const supply = area.supply - 1
      this.store.rows('update salvage_area set supply = ?, updated_at = ? where id = 1', supply, at)
      return { techLevel: area.techLevel, supply }
    })
  }

  /** When the Scene, or the area, last changed; 0 for one never set. */
  updatedAt(table: 'scene' | 'salvage_area'): number {
    return Number(
      this.store.rows(`select updated_at from ${table} where id = 1`)[0]?.updated_at ?? 0
    )
  }

  private current(): SceneRead | null {
    const row = this.store.rows('select conditions, hours from scene where id = 1')[0]
    if (row === undefined) return null
    return { conditions: fromJson<SceneConditionId[]>(row.conditions), hours: Number(row.hours) }
  }

  private area(): SalvageArea | null {
    const row = this.store.rows('select name, tech_level, supply from salvage_area where id = 1')[0]
    if (row === undefined) return null
    return { name: String(row.name), techLevel: Number(row.tech_level), supply: Number(row.supply) }
  }
}
