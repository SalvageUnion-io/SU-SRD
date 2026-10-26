import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import { SalvageAreaSchema } from 'game-domain/schemas/salvageArea'
import { RoomRefusal } from '../refusal'
import type { AccountShelf } from './shelf'

/**
 * The area a player's solo table is salvaging (Core Book p.245), for a
 * null `gameId`: the player sets it
 * themselves, and spends its Supply one roll at a time, as a Game room does
 * (`../game/scene.ts`).
 */
export class AccountSoloArea {
  constructor(private readonly shelf: AccountShelf) {}

  private get store() {
    return this.shelf.store
  }

  /** The area, for the room's player; null when there is none, or for anyone else. */
  here(actor: string): SalvageArea | null {
    return this.shelf.owner() === actor ? this.area() : null
  }

  /** Set the area, or clear it with null. */
  set(actor: string, area: SalvageArea | null, at: number): void {
    this.store.sql.transaction(() => {
      this.shelf.requireOwner(actor)
      if (area === null) {
        this.store.rows('delete from salvage_area')
        return
      }
      const parsed = SalvageAreaSchema.safeParse({ ...area, name: area.name.trim() })
      if (!parsed.success) throw new RoomRefusal('An area has a Tech Level of 1 to 6 and a Supply')
      this.write(parsed.data, at)
    })
  }

  /** Spend 1 Supply for one Area Salvage roll by a Shelf pilot: the Tech Level it was spent on and the Supply left. */
  spend(actor: string, pilotId: string, at: number): { techLevel: number; supply: number } {
    return this.store.sql.transaction(() => {
      const pilot = this.shelf.writable(actor, pilotId)
      if (pilot.kind !== 'pilot') throw new RoomRefusal('That is not a Pilot')
      const area = this.area()
      if (area === null) throw new RoomRefusal('There is no area to salvage here')
      if (area.supply <= 0) throw new RoomRefusal('This area is picked clean')
      const supply = area.supply - 1
      this.store.rows('update salvage_area set supply = ?, updated_at = ? where id = 1', supply, at)
      return { techLevel: area.techLevel, supply }
    })
  }

  /** The cutover's copy, as Convex kept it. */
  import(area: SalvageArea & { updatedAt: number }): void {
    this.write(area, area.updatedAt)
  }

  /** When the area last changed; 0 for one never set. */
  updatedAt(): number {
    return Number(
      this.store.rows('select updated_at from salvage_area where id = 1')[0]?.updated_at ?? 0
    )
  }

  private write({ name, techLevel, supply }: SalvageArea, at: number): void {
    this.store.rows(
      `insert into salvage_area (id, name, tech_level, supply, updated_at) values (1, ?, ?, ?, ?)
       on conflict (id) do update set name = excluded.name, tech_level = excluded.tech_level,
         supply = excluded.supply, updated_at = excluded.updated_at`,
      name,
      techLevel,
      supply,
      at
    )
  }

  private area(): SalvageArea | null {
    const row = this.store.rows('select name, tech_level, supply from salvage_area where id = 1')[0]
    if (row === undefined) return null
    return { name: String(row.name), techLevel: Number(row.tech_level), supply: Number(row.supply) }
  }
}
