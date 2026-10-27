import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import { RoomRefusal } from '../refusal'
import { putSalvageArea, salvageAreaOf, setSalvageArea, spendSalvageSupply } from '../salvageArea'
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
    return this.shelf.owner() === actor ? salvageAreaOf(this.store) : null
  }

  /** Set the area, or clear it with null. */
  set(actor: string, area: SalvageArea | null, at: number): void {
    this.store.sql.transaction(() => {
      this.shelf.requireOwner(actor)
      setSalvageArea(this.store, area, at)
    })
  }

  /** Spend 1 Supply for one Area Salvage roll by a Shelf pilot: the Tech Level it was spent on and the Supply left. */
  spend(actor: string, pilotId: string, at: number): { techLevel: number; supply: number } {
    return this.store.sql.transaction(() => {
      const pilot = this.shelf.writable(actor, pilotId)
      if (pilot.kind !== 'pilot') throw new RoomRefusal('That is not a Pilot')
      return spendSalvageSupply(this.store, at)
    })
  }

  /** The cutover's copy, as Convex kept it. */
  import(area: SalvageArea & { updatedAt: number }): void {
    putSalvageArea(this.store, area, area.updatedAt)
  }

  /** When the area last changed; 0 for one never set. */
  updatedAt(): number {
    return Number(
      this.store.rows('select updated_at from salvage_area where id = 1')[0]?.updated_at ?? 0
    )
  }
}
