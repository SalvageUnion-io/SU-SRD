/**
 * The plan Mediate shows at the table (r6 B7, MD6-09): which of the Game's
 * session plans is the one being played. Pure.
 */

import type { GamePlan, PlanSession } from 'game-domain/schemas/gamePlan'
import { datedSessions } from '../games/prep/gamePrep.model'

/**
 * The session being played on `today` (a `YYYY-MM-DD` day): today's or the
 * next one planned and not yet played, else the first with no day not yet
 * played, else the last one played; null with none planned.
 */
export function currentSession(
  plan: Pick<GamePlan, 'sessions'>,
  today: string
): PlanSession | null {
  const sessions = datedSessions(plan)
  const dated = sessions.filter((s) => s.date !== undefined)
  // One the table has played (r8 B8) is never the one being played.
  const open = (s: PlanSession) => s.played === undefined
  return (
    dated.find((s) => open(s) && (s.date ?? '') >= today) ??
    sessions.find((s) => open(s) && s.date === undefined) ??
    dated.at(-1) ??
    sessions.find((s) => s.date === undefined) ??
    null
  )
}
