/**
 * The session's notices that reach a member off the Play screen, pure but for
 * this browser's memory (r6 C1, C4, C5): the Games page, where each Game's
 * card has its one Join; "Session ended", said the first time it is seen and
 * never pinned again; and a Downtime step still to take.
 */

/** A running Downtime whose current step this pilot has not taken (r6 C5). */
export function downtimeWaits(
  downtime: { running: boolean; stepIndex: number | null; doneSteps: readonly number[] } | null
): boolean {
  if (downtime === null || !downtime.running) return false
  return !downtime.doneSteps.includes(downtime.stepIndex ?? 0)
}

/** The Games page: each Game's card carries its one Join session (r6 C4). */
const GAMES_HUB = /^\/games\/?$/

/** The Games page is open (`GAMES_HUB`). */
export const onHub = (pathname: string) => GAMES_HUB.test(pathname)

/** Where the session ends this browser has been told of are remembered (r6 C1). */
const ENDED_SEEN = 'su-session-ended-seen'

/** The ends shown in this tab: they stay up until it moves on or dismisses them. */
const showingEnded = new Set<string>()

/**
 * "Session ended" is news the first time it is seen, never again (r6 C1): it
 * stays in the tab that first showed it, and no other visit pins it.
 */
export function firstSight(key: string): boolean {
  if (showingEnded.has(key)) return true
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(ENDED_SEEN) ?? '[]')
    const seen = Array.isArray(kept) ? kept.filter((k) => typeof k === 'string') : []
    if (seen.includes(key)) return false
    localStorage.setItem(ENDED_SEEN, JSON.stringify([...seen, key].slice(-20)))
  } catch {
    // Storage is off: it is said in this tab alone.
  }
  showingEnded.add(key)
  return true
}
