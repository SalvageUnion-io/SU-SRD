/**
 * The next session as a Game's recap names it (r6 C1, MD6-09): for whoever
 * runs the table, their plan's next session (its title, else its day), the
 * one they wrote in Prep; for everyone else the next day the table meets.
 * Null with neither.
 */

import { formatDay, todayDay } from '../../lib/formatDate'
import type { GameCallResult } from '../../replica/roomCalls'
import { useGamesQuery } from '../../replica/roomCalls'

type Game = NonNullable<GameCallResult<'games.get'>>

export function useNextSession(game: Game): string | null {
  // The plan is the table runner's alone (`plan.read`): nobody else asks for it.
  const plan = useGamesQuery('plan.get', game.tableRunner ? { gameId: game._id } : 'skip')
  const today = todayDay()
  const planned = plan?.sessions.find((s) => s.date === undefined || s.date >= today)
  if (planned !== undefined) {
    const title = planned.title?.trim() ?? ''
    if (title !== '') return planned.date ? `${title} · ${formatDay(planned.date)}` : title
    if (planned.date) return formatDay(planned.date)
  }
  const day = game.sessionDays?.find((d) => d >= today)
  return day === undefined ? null : formatDay(day)
}
