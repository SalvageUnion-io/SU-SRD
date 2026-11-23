/**
 * The plans a Game's recap names (r6 C1, MD6-09; r7 C10, MD7-09): for
 * whoever runs the table, their plan's sessions from Prep (each its title,
 * else its day). The next is the first whose day has not passed; a plan
 * dated the day the table last played, once that session has ended, is the
 * last session, never the next. For everyone else the next day the table
 * meets. Null with none.
 */

import { formatDay, todayDay } from '../../lib/formatDate'
import type { GameCallResult } from '../../replica/roomCalls'
import { useGamesQuery } from '../../replica/roomCalls'

type Game = NonNullable<GameCallResult<'games.get'>>

type PlannedSession = { title?: string | undefined; date?: string | undefined }

export type SessionPlans = { next: string | null; last: string | null }

/** What the recap reads, given the day the last session ended on (null: none has). */
export type PlansFor = (playedOn: string | null) => SessionPlans

function named(session: PlannedSession): string | null {
  const title = session.title?.trim() ?? ''
  if (title !== '') return session.date ? `${title} · ${formatDay(session.date)}` : title
  return session.date ? formatDay(session.date) : null
}

/** The next and last plans, pure: `today` and `playedOn` are days (`YYYY-MM-DD`). */
export function sessionPlans(
  sessions: readonly PlannedSession[],
  days: readonly string[],
  today: string,
  playedOn: string | null
): SessionPlans {
  const playedToday = playedOn === today
  const passed = (day: string | undefined) =>
    day !== undefined && (day < today || (day === today && playedToday))
  const upcoming = sessions.find((s) => !passed(s.date))
  const past = sessions
    .filter((s) => passed(s.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .at(-1)
  const day = days.find((d) => !passed(d) && d >= today)
  const next = upcoming === undefined ? null : named(upcoming)
  return {
    next: next ?? (day === undefined ? null : formatDay(day)),
    last: past === undefined ? null : named(past),
  }
}

export function useNextSession(game: Game): PlansFor {
  // The plan is the table runner's alone (`plan.read`): nobody else asks for it.
  const plan = useGamesQuery('plan.get', game.tableRunner ? { gameId: game._id } : 'skip')
  const today = todayDay()
  return (playedOn) => sessionPlans(plan?.sessions ?? [], game.sessionDays ?? [], today, playedOn)
}
