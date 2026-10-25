import { downtimeStepCount, isUpkeepStep, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import type { RangeBand, SeatMount, SeatResolving } from 'game-domain/schemas/seat'
import { RANGE_BANDS, SeatSchema } from 'game-domain/schemas/seat'
import { RoomRefusal } from '../refusal'
import type { GameStore } from './store'
import { bit, fromJson, fromJsonOrNull } from './store'
import type { GameUnits } from './units'

/**
 * Play at a Game's table: each pilot's seat (ADR-038 §2) and the Game's
 * Downtime, with `convex/seats.ts` and `downtime.ts`'s rules.
 *
 * A Downtime step a pilot applies is an op with a stable id
 * (`downtimeStepOpId`, ADR-063 §6): applying it twice is a no-op, so the
 * claim bookkeeping Convex kept is gone.
 */

export type SeatRead = {
  pilotId: string
  mount: SeatMount
  range: RangeBand
  activeEffects: string[]
  resolving: SeatResolving | null
  ejected: boolean
  updatedAt: number
}

export type DowntimeRead = {
  running: boolean
  /** Names this Downtime, so its step ops are its own (`downtimeStepOpId`). */
  runId: string | null
  stepIndex: number | null
  startedAt: number | null
  completedBy: string[]
  upkeepSpent: boolean
}

/** The op id of one pilot's step in one Downtime: the same press always names the same op. */
export function downtimeStepOpId(runId: string, pilotId: string, stepIndex: number): string {
  return `downtime:${runId}:${pilotId}:${stepIndex}`
}

const FOOT: SeatMount = { kind: 'foot' }

/** A pilot with no seat yet: on foot, at Close range, nothing switched on. */
function defaultSeat(pilotId: string, at: number): SeatRead {
  return {
    pilotId,
    mount: FOOT,
    range: 'Close',
    activeEffects: [],
    resolving: null,
    ejected: false,
    updatedAt: at,
  }
}

type Running = Omit<DowntimeRead, 'running'> & { runId: string; stepIndex: number }

export class GamePlay {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits,
    private readonly newId: () => string
  ) {}

  // ----------------------------------------------------------------- seats

  /** Every seat at the table, for any member. */
  seats(actor: string): SeatRead[] {
    if (this.store.member(actor) === null) return []
    return this.store.rows('select * from seats order by pilot_id').map(seatOf)
  }

  seat(pilotId: string): SeatRead | null {
    const row = this.store.rows('select * from seats where pilot_id = ?', pilotId)[0]
    return row === undefined ? null : seatOf(row)
  }

  /**
   * Board a mech: the caller writes both the pilot and the mech, the mech is
   * here and not destroyed, and no other pilot is aboard it. Boarding never
   * assigns: the mech-to-pilot link is untouched.
   */
  board(actor: string, pilotId: string, mechId: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => {
      const mech = this.store.unit(mechId)
      if (mech === null || mech.kind !== 'mech')
        throw new RoomRefusal('That Mech is not in this Game')
      this.units.assertMayWrite(actor, mech)
      if (mech.body.destroyed === true) throw new RoomRefusal('That Mech is destroyed')
      for (const other of this.seats(actor)) {
        if (other.pilotId === pilotId) continue
        if (other.mount.kind === 'boarded' && other.mount.mechId === mechId) {
          throw new RoomRefusal('Another Pilot is already aboard that Mech')
        }
      }
      return { ...remount(seat, { kind: 'boarded', mechId }), ejected: false }
    })
  }

  /** Climb out, back on foot. */
  dismount(actor: string, pilotId: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => ({ ...remount(seat, FOOT), ejected: false }))
  }

  /** The emergency exit: on foot, and marked ejected until the pilot next boards or dismounts. */
  eject(actor: string, pilotId: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => ({ ...remount(seat, FOOT), ejected: true }))
  }

  setRange(actor: string, pilotId: string, range: string, at: number): void {
    if (!(RANGE_BANDS as readonly string[]).includes(range))
      throw new Error(`Not one of RANGE_BANDS: ${range}`)
    this.write(actor, pilotId, at, () => ({ range: range as RangeBand }))
  }

  /** Switch an activated effect on or off, by the ref that declares it (ADR-029 §4). */
  toggleEffect(actor: string, pilotId: string, ref: string, at: number): void {
    this.write(actor, pilotId, at, (seat) => ({
      activeEffects: seat.activeEffects.includes(ref)
        ? seat.activeEffects.filter((r) => r !== ref)
        : [...seat.activeEffects, ref],
    }))
  }

  /** The deck action being resolved, and how far it has got; each step replaces the last. */
  setResolving(actor: string, pilotId: string, resolving: unknown, at: number): void {
    const parsed = SeatSchema.shape.resolving.unwrap().parse(resolving)
    this.write(actor, pilotId, at, () => ({ resolving: parsed }))
  }

  clearResolving(actor: string, pilotId: string, at: number): void {
    this.write(actor, pilotId, at, () => ({ resolving: null }))
  }

  /** Write part of a pilot's seat, as whoever may write the pilot; the row is made on first use. */
  private write(
    actor: string,
    pilotId: string,
    at: number,
    change: (seat: SeatRead) => Partial<SeatRead>
  ): void {
    this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      const pilot = this.store.unit(pilotId)
      if (pilot === null || pilot.kind !== 'pilot') {
        throw new RoomRefusal('That Pilot is not in this Game')
      }
      this.units.assertMayWrite(actor, pilot)
      const seat = this.seat(pilotId) ?? defaultSeat(pilotId, at)
      this.putSeat({ ...seat, ...change(seat), updatedAt: at })
    })
  }

  putSeat(seat: SeatRead): void {
    this.store.rows(
      `insert into seats (pilot_id, mount, range_band, active_effects, resolving, ejected, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(pilot_id) do update set mount = excluded.mount, range_band = excluded.range_band,
         active_effects = excluded.active_effects, resolving = excluded.resolving,
         ejected = excluded.ejected, updated_at = excluded.updated_at`,
      seat.pilotId,
      JSON.stringify(seat.mount),
      seat.range,
      JSON.stringify(seat.activeEffects),
      seat.resolving === null ? null : JSON.stringify(seat.resolving),
      bit(seat.ejected),
      seat.updatedAt
    )
  }

  // -------------------------------------------------------------- Downtime

  /** The Game's Downtime, for any member; not running is a state, reported as one. */
  downtime(actor: string): DowntimeRead | null {
    if (this.store.member(actor) === null) return null
    const running = this.running()
    if (running === null) {
      return {
        running: false,
        runId: null,
        stepIndex: null,
        startedAt: null,
        completedBy: [],
        upkeepSpent: false,
      }
    }
    return { running: true, ...running }
  }

  /** Begin a Downtime at its first step. Already running, a no-op: a second press must not charge upkeep twice. */
  beginDowntime(actor: string, at: number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      if (this.running() !== null) return
      this.store.rows(
        `insert into downtime_run (id, run_id, step_index, started_at, completed_by, upkeep_spent)
         values (1, ?, 0, ?, '[]', 0)`,
        this.newId(),
        at
      )
    })
  }

  /** The next step, stopping at the last; a move clears who is done. */
  advanceDowntime(actor: string): void {
    this.moveTo(actor, (running) => running.stepIndex + 1)
  }

  /** Any step, back or forward, held to the guide's. It never re-opens upkeep. */
  setDowntimeStep(actor: string, stepIndex: number): void {
    this.moveTo(actor, () => stepIndex)
  }

  /** End the Downtime. Not running is not an error. */
  endDowntime(actor: string): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.store.rows('delete from downtime_run')
    })
  }

  /** Mark yourself done with the current step, or not. Any member, for themselves only. */
  markStepDone(actor: string, done: boolean): void {
    this.store.sql.transaction(() => {
      this.store.requireMember(actor)
      const running = this.requireRunning()
      const without = running.completedBy.filter((id) => id !== actor)
      this.store.rows(
        'update downtime_run set completed_by = ? where id = 1',
        JSON.stringify(done ? [...without, actor] : without)
      )
    })
  }

  /**
   * Record the crawler upkeep paid, in the Upkeep & Upgrade step only; the
   * Mediator's, as the crawler is (ADR-038 §5). False when it was already
   * paid, so the caller deducts the scrap once.
   */
  spendUpkeep(actor: string): boolean {
    return this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const running = this.requireRunning()
      if (!isUpkeepStep(running.stepIndex)) {
        throw new RoomRefusal(`Upkeep is paid in the ${UPKEEP_STEP_NAME} step`)
      }
      if (running.upkeepSpent) return false
      this.store.rows('update downtime_run set upkeep_spent = 1 where id = 1')
      return true
    })
  }

  private moveTo(actor: string, next: (running: Running) => number): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      const running = this.requireRunning()
      const last = downtimeStepCount() - 1
      if (last < 0) throw new Error('The Crawler Downtime guide has no steps')
      const stepIndex = Math.max(0, Math.min(Math.trunc(next(running)), last))
      if (stepIndex === running.stepIndex) return
      this.store.rows(
        "update downtime_run set step_index = ?, completed_by = '[]' where id = 1",
        stepIndex
      )
    })
  }

  private running(): Running | null {
    const row = this.store.rows('select * from downtime_run where id = 1')[0]
    if (row === undefined) return null
    return {
      runId: String(row.run_id),
      stepIndex: Number(row.step_index),
      startedAt: Number(row.started_at),
      completedBy: fromJson<string[]>(row.completed_by),
      upkeepSpent: row.upkeep_spent === 1,
    }
  }

  private requireRunning(): Running {
    const running = this.running()
    if (running === null) throw new RoomRefusal('Downtime is not running')
    return running
  }
}

/** Move to `mount`, dropping the resolve in progress when the mount changed. */
function remount(seat: SeatRead, mount: SeatMount): Partial<SeatRead> {
  const same =
    seat.mount.kind === mount.kind &&
    (mount.kind === 'foot' || (seat.mount.kind === 'boarded' && seat.mount.mechId === mount.mechId))
  return same ? { mount } : { mount, resolving: null }
}

function seatOf(row: Record<string, unknown>): SeatRead {
  return {
    pilotId: String(row.pilot_id),
    mount: fromJson<SeatMount>(row.mount as string),
    range: row.range_band as RangeBand,
    activeEffects: fromJson<string[]>(row.active_effects as string),
    resolving: fromJsonOrNull<SeatResolving>(row.resolving as string | null),
    ejected: row.ejected === 1,
    updatedAt: Number(row.updated_at),
  }
}
