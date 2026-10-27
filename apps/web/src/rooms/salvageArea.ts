import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import { SalvageAreaSchema } from 'game-domain/schemas/salvageArea'
import type { GameStore } from './game/store'
import { RoomRefusal } from './refusal'

/**
 * The area a table is salvaging (Core Book p.245), one row in either room:
 * a Game's, which its Mediator sets (`./game/scene.ts`), or a player's solo
 * table's (`./account/soloArea.ts`). Who may set or spend it is the caller's
 * to check.
 */

/** The area, or null when there is none. */
export function salvageAreaOf(store: GameStore): SalvageArea | null {
  const row = store.rows('select name, tech_level, supply from salvage_area where id = 1')[0]
  if (row === undefined) return null
  return { name: String(row.name), techLevel: Number(row.tech_level), supply: Number(row.supply) }
}

/** Write the area as it is. */
export function putSalvageArea(store: GameStore, area: SalvageArea, at: number): void {
  store.rows(
    `insert into salvage_area (id, name, tech_level, supply, updated_at) values (1, ?, ?, ?, ?)
     on conflict (id) do update set name = excluded.name, tech_level = excluded.tech_level,
       supply = excluded.supply, updated_at = excluded.updated_at`,
    area.name,
    area.techLevel,
    area.supply,
    at
  )
}

/** Set the area, its name trimmed, or clear it with null; an area out of bounds is refused. */
export function setSalvageArea(store: GameStore, area: SalvageArea | null, at: number): void {
  if (area === null) {
    store.rows('delete from salvage_area')
    return
  }
  const parsed = SalvageAreaSchema.safeParse({ ...area, name: area.name.trim() })
  if (!parsed.success) throw new RoomRefusal('An area has a Tech Level of 1 to 6 and a Supply')
  putSalvageArea(store, parsed.data, at)
}

/** Spend 1 Supply for one Area Salvage roll: the Tech Level it was spent on and the Supply left. */
export function spendSalvageSupply(
  store: GameStore,
  at: number
): { techLevel: number; supply: number } {
  const area = salvageAreaOf(store)
  if (area === null) throw new RoomRefusal('There is no area to salvage here')
  if (area.supply <= 0) throw new RoomRefusal('This area is picked clean')
  const supply = area.supply - 1
  store.rows('update salvage_area set supply = ?, updated_at = ? where id = 1', supply, at)
  return { techLevel: area.techLevel, supply }
}
