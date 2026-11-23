/**
 * What the table's events (`events.ts`) read before an act runs, to say
 * afterwards what it changed: pure reads of the room's store.
 */

import { seatOf } from '../seats'
import type { GameActName } from './acts'
import { isRevealedRoll } from './log'
import { STARTS_THE_SESSION } from './session'
import type { GameStore, StoredOp } from './store'

/** What an act needs remembered from before it ran, to say what changed. */
export type EventsBefore = {
  resolving?: string | null
  proposal?: StoredOp | null
  session?: boolean
  /** Whether a Downtime was running. */
  downtime?: boolean
  /** The step a running Downtime stood on, before the Mediator moved it (r5 A3). */
  downtimeStep?: number | null
  stop?: boolean
  /** Who showed the Stop Sign: lifted by anyone else, the Feed names who lifted it (r5 A8). */
  stopBy?: string | null
  /** Whether the effect was switched on. */
  effectOn?: boolean
  /** Who held the unit an assignment moves. */
  holder?: string | null
  /** Whether the roll was already revealed: a second Reveal tells nobody again. */
  revealed?: boolean
  /** Who was up: giving the same pilot the turn again tells nobody. */
  upNow?: string | null
  /** Whether an area with Supply left stood to salvage: setting another says nothing new (r6 D3). */
  area?: boolean
  /** The resolves nobody applied that the act may close (r5 A7). */
  unapplied?: { pilotId: string; name: string; owes: boolean }[]
}

/** What of a seat's resolve says how far it got. */
type Resolving = { activated?: unknown; roll?: unknown; salvage?: unknown; applied?: unknown }

/** Whether a seat's resolve has got anywhere: paid, rolled or applied (r8 A7). */
export function resolvingDone(resolving: Resolving | null | undefined): boolean {
  if (resolving == null) return false
  return (
    resolving.activated === true ||
    resolving.roll != null ||
    resolving.salvage != null ||
    resolving.applied === true
  )
}

/** What `after` needs from before the act ran. */
export function eventsBefore(store: GameStore, name: GameActName, args: unknown): EventsBefore {
  const before = beforeAct(store, name, args)
  // A table act that may start the session says so, if it did (r6 C3).
  return (STARTS_THE_SESSION as readonly string[]).includes(name)
    ? { ...before, session: sessionLive(store) }
    : before
}

const sessionLive = (store: GameStore) =>
  store.rows('select 1 from session where id = 1').length > 0

function beforeAct(store: GameStore, name: GameActName, args: unknown): EventsBefore {
  const a = (args ?? {}) as Record<string, unknown>
  switch (name) {
    case 'seats.setResolving': {
      const row = store.rows('select resolving from seats where pilot_id = ?', String(a.pilotId))[0]
      const resolving =
        typeof row?.resolving === 'string'
          ? (JSON.parse(row.resolving) as Resolving & { name?: string })
          : null
      // Its use is said once it got anywhere (r8 A7): until then it is not yet said.
      return { resolving: resolvingDone(resolving) ? (resolving?.name ?? null) : null }
    }
    case 'seats.toggleEffect': {
      const row = store.rows('select * from seats where pilot_id = ?', String(a.pilotId))[0]
      return {
        effectOn: row !== undefined && seatOf(row).activeEffects.includes(String(a.ref)),
      }
    }
    case 'assign':
    case 'unassign':
      return { holder: store.unit(String(a.unitId))?.ownerId ?? null }
    case 'ops.accept':
    case 'ops.decline':
    case 'ops.withdraw':
      return { proposal: store.op(String(a.opId)) }
    case 'session.start':
      return { session: store.rows('select 1 from session where id = 1').length > 0 }
    case 'session.end':
      return {
        session: store.rows('select 1 from session where id = 1').length > 0,
        unapplied: unappliedOf(store, null),
      }
    case 'downtime.advance':
    case 'downtime.setStep':
      return { downtimeStep: downtimeStepNow(store) }
    case 'salvageAreas.set':
      return { area: store.rows('select 1 from salvage_area where supply > 0').length > 0 }
    case 'downtime.begin':
    case 'downtime.end': {
      const was = name === 'downtime.begin' ? upNowOf(store) : null
      return {
        downtime: store.rows('select 1 from downtime_run where id = 1').length > 0,
        unapplied: was === null ? [] : unappliedOf(store, [was]),
      }
    }
    case 'changeLog.reveal': {
      const row = store.rows('select after from change_log where id = ?', String(a.rollId))[0]
      return {
        revealed:
          typeof row?.after === 'string' && isRevealedRoll(JSON.parse(row.after) as unknown),
      }
    }
    case 'scenes.setUpNow': {
      const was = upNowOf(store)
      return { upNow: was, unapplied: was === null ? [] : unappliedOf(store, [was]) }
    }
    case 'scenes.endTurn': {
      const was = upNowOf(store)
      return { unapplied: was === null ? [] : unappliedOf(store, [was]) }
    }
    case 'safety.showStop':
    case 'safety.liftStop': {
      const row = store.rows(
        'select shown_by from stop_sign where id = 1 and shown_at is not null'
      )[0]
      return {
        stop: row !== undefined,
        stopBy: (row?.shown_by as string | null | undefined) ?? null,
      }
    }
    default:
      return {}
  }
}

/** Who the Mediator has up, or null. */
function upNowOf(store: GameStore): string | null {
  const row = store.rows("select after from change_log where field = 'upNow'")[0]
  if (typeof row?.after !== 'string') return null
  return (JSON.parse(row.after) as { pilotId?: string | null }).pilotId ?? null
}

/**
 * The resolves nobody applied on these pilots' seats, or every seat's with
 * null (r5 A7). `owes` is whether it had anything to apply (r7 A5): a Cascade
 * Failure's roll, or an Area Salvage's find; any other roll writes nothing,
 * and one never rolled has no result.
 */
export function unappliedOf(
  store: GameStore,
  pilotIds: readonly string[] | null
): { pilotId: string; name: string; owes: boolean }[] {
  return store
    .rows('select pilot_id, resolving from seats where resolving is not null')
    .map((row) => ({
      pilotId: String(row.pilot_id),
      resolving: JSON.parse(String(row.resolving)) as {
        name?: string
        applied?: boolean
        roll?: { band?: string }
        salvage?: unknown
      },
    }))
    .filter(
      (s) => (pilotIds === null || pilotIds.includes(s.pilotId)) && s.resolving.applied !== true
    )
    .map((s) => ({
      pilotId: s.pilotId,
      name: s.resolving.name ?? '',
      owes: s.resolving.salvage != null || s.resolving.roll?.band === 'cascade',
    }))
}

/** The step the Game's Downtime stands on, or null when none runs. */
export function downtimeStepNow(store: GameStore): number | null {
  const row = store.rows('select step_index from downtime_run where id = 1')[0]
  return row === undefined ? null : Number(row.step_index)
}
