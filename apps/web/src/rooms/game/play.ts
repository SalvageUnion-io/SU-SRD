import type { DowntimeClaim } from 'game-domain/ops/downtimeStep'
import type { Running } from '../downtime'
import { beginDowntime, claimed, claimInStep, doneSteps, moveDowntime } from '../downtime'
import type { OpInput } from '../ops'
import { RoomRefusal } from '../refusal'
import { SeatTable } from '../seats'
import type { GameStore, UnitRow } from './store'
import type { GameUnits } from './units'

/**
 * Play at a Game's table: each pilot's seat (ADR-038 §2, `../seats.ts`) and
 * the Game's Downtime (`../downtime.ts`). A seat is written by whoever may write its pilot;
 * the Mediator runs the Downtime.
 */

/** The Game's Downtime as every member reads it (`downtime.state`), and each pilot's steps taken. */
export type DowntimeRead = {
  running: boolean
  runId: string | null
  stepIndex: number | null
  startedAt: number | null
  /**
   * The members done with the current step: each has a pilot here and every
   * one of them took it (their step ops, `doneSteps`). Read, never stored.
   */
  completedBy: { userId: string; displayName: string }[]
  upkeepSpent: boolean
  /** Each pilot's steps taken this Downtime, by pilot id. */
  doneSteps: Record<string, number[]>
}

const NOT_RUNNING: DowntimeRead = {
  running: false,
  runId: null,
  stepIndex: null,
  startedAt: null,
  completedBy: [],
  upkeepSpent: false,
  doneSteps: {},
}

export class GamePlay extends SeatTable {
  constructor(
    store: GameStore,
    private readonly units: GameUnits,
    private readonly newId: () => string
  ) {
    super(store)
  }

  protected writable(actor: string, unitId: string, kind: 'pilot' | 'mech'): UnitRow {
    this.store.requireMember(actor)
    const unit = this.store.unit(unitId)
    if (unit === null || unit.kind !== kind) {
      throw new RoomRefusal(`That ${kind === 'pilot' ? 'Pilot' : 'Mech'} is not in this Game`)
    }
    this.units.assertMayWrite(actor, unit)
    return unit
  }

  /** Every pilot's seat, for any member. */
  seats(actor: string) {
    return this.store.member(actor) === null ? [] : this.pilotSeats()
  }

  // -------------------------------------------------------------- Downtime

  /** The Game's Downtime, for any member; not running is a state, reported as one. */
  downtime(actor: string): DowntimeRead | null {
    if (this.store.member(actor) === null) return null
    const running = this.place.running()
    if (running === null) return NOT_RUNNING
    const pilots = this.store.units('pilot')
    const steps = new Map(pilots.map((p) => [p.id, doneSteps(this.store, running.runId, p.id)]))
    const tookIt = (pilotId: string) => steps.get(pilotId)?.includes(running.stepIndex) ?? false
    return {
      running: true,
      ...running,
      upkeepSpent: claimed(this.store, running, 'upkeep'),
      completedBy: this.store
        .members()
        .filter((m) => {
          const own = pilots.filter((p) => p.ownerId === m.userId)
          return own.length > 0 && own.every((p) => tookIt(p.id))
        })
        .map((m) => ({ userId: m.userId, displayName: m.displayName ?? 'Crewmate' })),
      doneSteps: Object.fromEntries(steps),
    }
  }

  /** Begin a Downtime; true when this began one, false when one was already running. */
  beginDowntime(actor: string, at: number): boolean {
    return this.asMediator(actor, () => beginDowntime(this.place, this.newId(), at))
  }

  advanceDowntime(actor: string): void {
    this.asMediator(actor, () => moveDowntime(this.place, (running) => running.stepIndex + 1))
  }

  setDowntimeStep(actor: string, stepIndex: number): void {
    this.asMediator(actor, () => moveDowntime(this.place, () => stepIndex))
  }

  /** End the Downtime. Not running is not an error. */
  endDowntime(actor: string): void {
    this.asMediator(actor, () => this.place.write(null))
  }

  /** Pay the crawler's Upkeep or process its Nanites (`claimInStep`): the Mediator's, as the Downtime is. */
  claim(actor: string, claim: DowntimeClaim, op: OpInput): boolean {
    return this.asMediator(actor, () => {
      const crawler = this.store.requireUnit(op.unitId)
      if (crawler.kind !== 'crawler') throw new RoomRefusal('That is not a crawler')
      this.units.assertMayWrite(actor, crawler)
      const room = { store: this.store, units: this.units, place: this.place }
      return claimInStep(room, claim, op, actor, crawler)
    })
  }

  private asMediator<T>(actor: string, act: () => T): T {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      return act()
    })
  }

  private readonly place = {
    running: (): Running | null => {
      const row = this.store.rows('select * from downtime_run where id = 1')[0]
      if (row === undefined) return null
      return {
        runId: String(row.run_id),
        stepIndex: Number(row.step_index),
        startedAt: Number(row.started_at),
        legacyClaims: [
          ...(row.upkeep_spent === 1 ? (['upkeep'] as const) : []),
          ...(row.nanites_spent === 1 ? (['nanites'] as const) : []),
        ],
      }
    },
    write: (next: Running | null): void => {
      if (next === null) {
        this.store.rows('delete from downtime_run')
        return
      }
      // `upkeep_spent` and `nanites_spent` are no longer written: the claims are ops
      // (`claimed`). A run kept from before keeps its flags; a new one starts at 0.
      // `completed_by` is read off the step ops (`downtime`), so it stays empty.
      this.store.rows(
        `insert into downtime_run (id, run_id, step_index, started_at, completed_by, upkeep_spent)
         values (1, ?, ?, ?, '[]', 0)
         on conflict (id) do update set run_id = excluded.run_id, step_index = excluded.step_index,
           started_at = excluded.started_at, completed_by = '[]'`,
        next.runId,
        next.stepIndex,
        next.startedAt
      )
    },
  }
}
