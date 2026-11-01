import type { DowntimeClaim } from 'game-domain/ops/downtimeStep'
import type { DowntimePlace, Running } from '../downtime'
import { beginDowntime, claimed, claimInStep, doneSteps, moveDowntime } from '../downtime'
import type { UnitRow } from '../game/store'
import { fromJsonOrNull } from '../game/store'
import type { OpInput } from '../ops'
import { RoomRefusal } from '../refusal'
import type { SeatRead } from '../seats'
import { SeatTable } from '../seats'
import type { AccountShelf } from './shelf'

/**
 * The player's solo table: each Shelf pilot's seat and its own Downtime, for a
 * null `gameId`. Only the
 * player writes them, and a seat plays only what is on their Shelf.
 */

/**
 * A solo Downtime as its seat keeps it; one copied from Convex has no
 * `runId`. `upkeepSpent` and `nanitesSpent` are no longer set: the claims are
 * ops (`claimed`). A run kept from before keeps them until it ends.
 */
type SoloDowntime = {
  runId?: string
  stepIndex: number
  startedAt: number
  upkeepSpent?: boolean
  nanitesSpent?: boolean
}

/** A solo seat as `seats.solo` answered: its Downtime, with the steps taken, beside it. */
export type SoloSeatRead = SeatRead & {
  downtime:
    | (Omit<Running, 'completedBy' | 'legacyClaims'> & {
        upkeepSpent: boolean
        doneSteps: number[]
      })
    | null
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
                upkeepSpent: claimed(this.store, running, 'upkeep'),
                doneSteps: doneSteps(this.store, running.runId, seat.pilotId),
              },
      }
    })
  }

  /** Begin the pilot's solo Downtime; true when this began one. */
  beginDowntime(actor: string, pilotId: string, at: number): boolean {
    // Named by its start, as Convex named a solo run, so a step op copied from there is this run's.
    return this.asPilot(actor, pilotId, (place) => beginDowntime(place, String(at), at))
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

  /** Pay the crawler's Upkeep or process its Nanites in the pilot's Downtime (`claimInStep`). */
  claim(actor: string, pilotId: string, claim: DowntimeClaim, op: OpInput): boolean {
    return this.asPilot(actor, pilotId, (place) => {
      const crawler = this.shelf.writable(actor, op.unitId)
      if (crawler.kind !== 'crawler') throw new RoomRefusal('That is not a crawler')
      const room = { store: this.store, units: this.shelf.units, place }
      return claimInStep(room, claim, op, actor, crawler)
    })
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
        return {
          runId: kept.runId ?? String(kept.startedAt),
          stepIndex: kept.stepIndex,
          startedAt: kept.startedAt,
          completedBy: [],
          legacyClaims: [
            ...(kept.upkeepSpent === true ? (['upkeep'] as const) : []),
            ...(kept.nanitesSpent === true ? (['nanites'] as const) : []),
          ],
        }
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
                ...(next.legacyClaims.includes('upkeep') ? { upkeepSpent: true } : {}),
                ...(next.legacyClaims.includes('nanites') ? { nanitesSpent: true } : {}),
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
