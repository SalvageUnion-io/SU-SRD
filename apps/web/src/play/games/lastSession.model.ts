/**
 * "Last session" on a Game's page (play.md §16), pure: the table's events
 * (`rooms/game/events.ts`) between the newest group session's start and its
 * end, so the session leaves a record outside Play.
 */

import type { TableEvent } from '../../rooms/game/events'

export type SessionRecord = {
  startedAt: number
  /** Null while the session still runs. */
  endedAt: number | null
  /** What happened in it, newest first, its own start and end left out. */
  lines: TableEvent[]
  /** The rolls the whole table reads: the same count on every screen (r3 K6). */
  rolls: number
  /** Rolls only a Mediator is served: private ones, never counted with the table's. */
  privateRolls: number
  /** Vitals changes, an accepted proposal and its undoing among them. */
  changes: number
}

/** The newest session the stream still holds, or null when it holds none. */
export function lastSession(events: readonly TableEvent[]): SessionRecord | null {
  const ordered = [...events].sort((a, b) => a.ts - b.ts)
  const startAt = ordered.findLastIndex((event) => event.session === 'start')
  const start = ordered[startAt]
  if (start === undefined) return null
  const after = ordered.slice(startAt + 1)
  const endAt = after.findIndex((event) => event.session === 'end')
  const within = endAt === -1 ? after : after.slice(0, endAt)
  return {
    startedAt: start.ts,
    endedAt: endAt === -1 ? null : (after[endAt]?.ts ?? null),
    lines: within.reverse(),
    rolls: within.filter((event) => event.kind === 'roll' && event.private !== true).length,
    privateRolls: within.filter((event) => event.kind === 'roll' && event.private === true).length,
    changes: within.filter((event) => event.kind === 'vitals' || event.answer !== undefined).length,
  }
}
