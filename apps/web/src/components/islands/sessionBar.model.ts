/**
 * The session bar on a Reference page (r2 I1): which of the reader's Games
 * have a group session running, as the Worker answers (`games.liveSessions`),
 * and which bars this tab has put away.
 */

/** One Game with a session running. */
export type LiveSession = { gameId: string; name: string; startedAt: number | null }

/** Where a put-away bar is remembered: this tab's, one key per session. */
const DISMISSED_PREFIX = 'su:session-bar:'

/** A session's key: a new session of the same Game is a new bar. */
export function sessionKey(session: Pick<LiveSession, 'gameId' | 'startedAt'>): string {
  return `${DISMISSED_PREFIX}${session.gameId}:${session.startedAt ?? 0}`
}

type TabStorage = Pick<Storage, 'getItem' | 'setItem'>

/** The sessions still to show: every live one this tab has not put away. */
export function sessionsToShow(
  live: readonly LiveSession[],
  storage: TabStorage | null
): LiveSession[] {
  return live.filter((session) => {
    try {
      return storage?.getItem(sessionKey(session)) == null
    } catch {
      return true
    }
  })
}

/** Put a session's bar away for this tab. */
export function dismissSession(session: LiveSession, storage: TabStorage | null): void {
  try {
    storage?.setItem(sessionKey(session), '1')
  } catch {
    // A tab with no storage puts it away until the next page.
  }
}

/** What the Worker answered, as live sessions; anything else is none. */
export function liveSessionsOf(answer: unknown): LiveSession[] {
  if (typeof answer !== 'object' || answer === null) return []
  const { ok, value } = answer as { ok?: unknown; value?: unknown }
  if (ok !== true || !Array.isArray(value)) return []
  return value.flatMap((game: unknown) => {
    if (typeof game !== 'object' || game === null) return []
    const { gameId, name, startedAt } = game as Record<string, unknown>
    if (typeof gameId !== 'string' || typeof name !== 'string') return []
    return [{ gameId, name, startedAt: typeof startedAt === 'number' ? startedAt : null }]
  })
}
