/**
 * "Last time at the table" on a Game's page (play.md §16), pure: the newest
 * stretch of play in the table's events (`rooms/game/events.ts`), so play
 * leaves a record outside Play.
 *
 * A stretch is everything since the previous group session ended, up to this
 * one's end: play counts whether or not Start group session was pressed
 * (MD4-04). A stretch with no play in it (a session started and ended by
 * accident) never replaces one that has some.
 */

import type { TableEvent, TableEventKind } from '../../rooms/game/events'

export type SessionRecord = {
  startedAt: number
  /** Null while a group session still runs. */
  endedAt: number | null
  /** What happened in it, newest first, a session's own start and end left out. */
  lines: TableEvent[]
  /** The rolls the whole table reads: the same count on every screen (r3 K6). */
  rolls: number
  /** Rolls only a Mediator is served: private ones, never counted with the table's. */
  privateRolls: number
  /** Vitals changes, an accepted proposal and its undoing among them. */
  changes: number
}

/** Who is at the table and who runs it: said on the page, but not play. */
const NOT_PLAY: ReadonlySet<TableEventKind> = new Set([
  'session',
  'join',
  'leave',
  'role',
  'assign',
])

const isPlay = (event: TableEvent) => !NOT_PLAY.has(event.kind)

type Stretch = { events: TableEvent[]; end: TableEvent | null }

/** The stream cut after each session's end; the last stretch has none yet. */
function stretches(ordered: readonly TableEvent[]): Stretch[] {
  const cut: Stretch[] = []
  let events: TableEvent[] = []
  for (const event of ordered) {
    if (event.session === 'end') {
      cut.push({ events, end: event })
      events = []
    } else events.push(event)
  }
  cut.push({ events, end: null })
  return cut
}

/** The newest stretch of play the stream still holds, or null when it holds none. */
export function lastSession(events: readonly TableEvent[]): SessionRecord | null {
  const ordered = [...events].sort((a, b) => a.ts - b.ts)
  const cut = stretches(ordered)
  const started = (stretch: Stretch) => stretch.events.some((event) => event.session === 'start')
  // The newest with play in it; with none anywhere, the newest session, empty as it is.
  const shown = cut.findLast((s) => s.events.some(isPlay)) ?? cut.findLast(started)
  if (shown === undefined) return null
  // It opens at its first play or its session's start, whichever came first.
  const first = shown.events.find((event) => isPlay(event) || event.session === 'start')
  if (first === undefined) return null
  const within = shown.events.filter((event) => event.ts >= first.ts && event.kind !== 'session')
  const running = shown.end === null && shown === cut.at(-1) && started(shown)
  return {
    startedAt: first.ts,
    endedAt: running ? null : (shown.end?.ts ?? within.at(-1)?.ts ?? first.ts),
    lines: within.reverse(),
    rolls: within.filter((event) => event.kind === 'roll' && event.private !== true).length,
    privateRolls: within.filter((event) => event.kind === 'roll' && event.private === true).length,
    changes: within.filter((event) => event.kind === 'vitals' || event.answer !== undefined).length,
  }
}
