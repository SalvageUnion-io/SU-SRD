import type { DowntimePlace, Running } from '../downtime'
import { beginDowntime, doneSteps, moveDowntime, spendUpkeep } from '../downtime'
import type { UnitRow } from '../game/store'
import { fromJsonOrNull } from '../game/store'
import { RoomRefusal } from '../refusal'
import type { SeatRead } from '../seats'
import { SeatTable } from '../seats'
import type { AccountShelf } from './shelf'

/**
 * The player's solo table: each Shelf pilot's seat and its own Downtime, with
 * `convex/seats.ts` and `downtime.ts`'s rules for a null `gameId`. Only the
 * player writes them, and a seat plays only what is on their Shelf.
 */

/** A solo Downtime as its seat keeps it; one copied from Convex has no `runId`. */
type SoloDowntime = { runId?: string; stepIndex: number; startedAt: number; upkeepSpent: boolean }

/** A solo seat as `seats.solo` answered: its Downtime, with the steps taken, beside it. */
export type SoloSeatRead = SeatRead & {
  downtime: (Omit<Running, 'completedBy'> & { doneSteps: number[] }) | null
}

export class AccountSoloPlay extends SeatTable {
  constructor(private readonly shelf: AccountShelf) {
    super(shelf.store)
  }

  protected writable(actor: string, unitId: string, kind: 'pilot' | 'mech'): UnitRow {
    const unit = this.shelf.writable(actor, unitId)
    if (unit.kind !== kind)
      throw new RoomRefusal(`That is not a ${kind === 'pilot' ? 'Pilot' : 'Mech'}`)
    return unit
  }

  /** Every Shelf pilot's solo seat, for the player; a seat boarded off the Shelf reads as on foot. */
  soloSeats(actor: string): SoloSeatRead[] {
    if (this.shelf.owner() !== actor) return []
    return this.pilotSeats().map((seat) => {
      const offShelf = seat.mount.kind === 'boarded' && this.store.unit(seat.mount.mechId) === null
      const running = this.place(seat.pilotId).running()
      return {
        ...seat,
        ...(offShelf ? { mount: { kind: 'foot' as const }, resolving: null } : {}),
        downtime:
          running === null
            ? null
            : {
                runId: running.runId,
                stepIndex: running.stepIndex,
                startedAt: running.startedAt,
                upkeepSpent: running.upkeepSpent,
                doneSteps: doneSteps(this.store, running.runId, seat.pilotId),
              },
      }
    })
  }

  beginDowntime(actor: string, pilotId: string, at: number): void {
    // Named by its start, as Convex named a solo run, so a step op copied from there is this run's.
    this.asPilot(actor, pilotId, (place) => beginDowntime(place, String(at), at))
  }

  advanceDowntime(actor: string, pilotId: string): void {
    this.asPilot(actor, pilotId, (place) => moveDowntime(place, (r) => r.stepIndex + 1))
  }

  setDowntimeStep(actor: string, pilotId: string, stepIndex: number): void {
    this.asPilot(actor, pilotId, (place) => moveDowntime(place, () => stepIndex))
  }

  endDowntime(actor: string, pilotId: string): void {
    this.asPilot(actor, pilotId, (place) => place.write(null))
  }

  spendUpkeep(actor: string, pilotId: string): boolean {
    return this.asPilot(actor, pilotId, (place) => spendUpkeep(place))
  }

  private asPilot<T>(actor: string, pilotId: string, act: (place: DowntimePlace) => T): T {
    return this.store.sql.transaction(() => {
      this.writable(actor, pilotId, 'pilot')
      return act(this.place(pilotId))
    })
  }

  /** A pilot's solo Downtime, kept on its seat; writing one gives the pilot a seat. */
  private place(pilotId: string): DowntimePlace {
    const row = () => this.store.rows('select * from seats where pilot_id = ?', pilotId)[0]
    return {
      running: () => {
        const kept = fromJsonOrNull<SoloDowntime>(row()?.downtime_state as string | null)
        if (kept === null) return null
        return { ...kept, runId: kept.runId ?? String(kept.startedAt), completedBy: [] }
      },
      write: (next) => {
        if (row() === undefined) {
          const seat = this.pilotSeats().find((s) => s.pilotId === pilotId)
          if (seat !== undefined) this.putSeat({ ...seat, updatedAt: next?.startedAt ?? 0 })
        }
        const kept: SoloDowntime | null =
          next === null
            ? null
            : {
                runId: next.runId,
                stepIndex: next.stepIndex,
                startedAt: next.startedAt,
                upkeepSpent: next.upkeepSpent,
              }
        this.store.rows(
          'update seats set downtime_state = ? where pilot_id = ?',
          kept === null ? null : JSON.stringify(kept),
          pilotId
        )
      },
    }
  }
}
