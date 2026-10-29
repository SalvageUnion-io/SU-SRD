import type { Running } from '../downtime'
import {
  beginDowntime,
  doneSteps,
  moveDowntime,
  requireRunning,
  spendNanites,
  spendUpkeep,
} from '../downtime'
import { RoomRefusal } from '../refusal'
import { SeatTable } from '../seats'
import type { GameStore, UnitRow } from './store'
import { fromJson } from './store'
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
    return {
      running: true,
      ...running,
      completedBy: running.completedBy.map((userId) => ({
        userId,
        displayName: this.store.member(userId)?.displayName ?? 'Crewmate',
      })),
      doneSteps: Object.fromEntries(
        this.store.units('pilot').map((p) => [p.id, doneSteps(this.store, running.runId, p.id)])
      ),
    }
  }

  beginDowntime(actor: string, at: number): void {
    this.asMediator(actor, () => beginDowntime(this.place, this.newId(), at))
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

  /** Mark yourself done with the current step, or not. Any member, for themselves only. */
  markStepDone(actor: string, done: boolean): void {
    this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      const running = requireRunning(this.place)
      const without = running.completedBy.filter((id) => id !== actor)
      this.place.write({ ...running, completedBy: done ? [...without, actor] : without })
    })
  }

  /** The crawler's upkeep, the Mediator's as the crawler is (ADR-038 §5). */
  spendUpkeep(actor: string): boolean {
    return this.asMediator(actor, () => spendUpkeep(this.place))
  }

  /** The crawler's Nanite processing, the Mediator's as its Upkeep is. */
  spendNanites(actor: string): boolean {
    return this.asMediator(actor, () => spendNanites(this.place))
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
        completedBy: fromJson<string[]>(row.completed_by),
        upkeepSpent: row.upkeep_spent === 1,
        nanitesSpent: row.nanites_spent === 1,
      }
    },
    write: (next: Running | null): void => {
      if (next === null) {
        this.store.rows('delete from downtime_run')
        return
      }
      this.store.rows(
        `insert into downtime_run (id, run_id, step_index, started_at, completed_by, upkeep_spent, nanites_spent)
         values (1, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set run_id = excluded.run_id, step_index = excluded.step_index,
           started_at = excluded.started_at, completed_by = excluded.completed_by,
           upkeep_spent = excluded.upkeep_spent, nanites_spent = excluded.nanites_spent`,
        next.runId,
        next.stepIndex,
        next.startedAt,
        JSON.stringify(next.completedBy),
        next.upkeepSpent ? 1 : 0,
        next.nanitesSpent ? 1 : 0
      )
    },
  }
}
