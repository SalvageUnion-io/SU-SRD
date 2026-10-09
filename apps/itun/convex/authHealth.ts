import { internal } from './_generated/api'
import { internalAction, internalQuery } from './_generated/server'

/**
 * Hourly check that Discord sign-in still completes.
 *
 * From 2026-10-06 to 2026-10-09 every sign-in failed and nothing alerted.
 * `@convex-dev/auth` catches a failed OAuth callback, logs it and redirects home
 * without a code — it never throws, so Convex's Exception Reporting had nothing
 * to send to Sentry. Watching for that one error would only catch that one
 * cause, so this watches the outcome instead.
 *
 * Every sign-in leaves an `authVerifiers` row with a `signature` once the user
 * is sent to Discord, and the callback deletes that row only when it succeeds.
 * Every completed sign-in creates an `authSessions` row. So signed verifiers
 * piling up while no session is created means people are reaching Discord and
 * not getting back in, whatever the reason: a provider change, a rotated
 * secret, a wrong `SITE_URL`.
 *
 * When that happens `check` throws. Exception Reporting sends the throw to the
 * `itun-convex` Sentry project, whose "high priority issues" alert emails the
 * owners. The alert lives in Sentry; this only has to throw.
 */

/** How far back an hourly run looks. */
export const WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * Attempts younger than this are skipped: the user may still be on Discord's
 * consent screen, and their row is not stranded yet.
 */
export const IN_FLIGHT_MS = 15 * 60 * 1000

/**
 * Stranded attempts, with no sign-in completed, that count as an outage. A few
 * are people pressing Cancel on Discord. Replayed hourly over production
 * history (2026-07-29 to 2026-10-09), 4 never fired before the outage and first
 * fired at 2026-10-06T22:07Z, about 19 hours in. 3 fired in three ordinary
 * windows as well.
 */
export const FAILING_ATTEMPTS = 4

export type SignInCounts = {
  /** Signed verifiers in the window that the callback never consumed. */
  stranded: number
  /** Sessions created in the window: sign-ins that completed. */
  completed: number
}

/** The decision, apart from the database, so it can be tested on numbers. */
export function signInFailing({ stranded, completed }: SignInCounts): boolean {
  return completed === 0 && stranded >= FAILING_ATTEMPTS
}

export const counts = internalQuery({
  args: {},
  handler: async (ctx): Promise<SignInCounts> => {
    const now = Date.now()
    const from = now - WINDOW_MS
    const to = now - IN_FLIGHT_MS

    const verifiers = await ctx.db
      .query('authVerifiers')
      .withIndex('by_creation_time', (q) => q.gte('_creationTime', from).lt('_creationTime', to))
      .collect()
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('by_creation_time', (q) => q.gte('_creationTime', from))
      .collect()

    return {
      // A verifier with no signature never reached Discord, so it says nothing
      // about whether the callback works.
      stranded: verifiers.filter((verifier) => verifier.signature !== undefined).length,
      completed: sessions.length,
    }
  },
})

export const check = internalAction({
  args: {},
  handler: async (ctx): Promise<SignInCounts> => {
    const result = await ctx.runQuery(internal.authHealth.counts, {})
    if (signInFailing(result)) {
      throw new Error(
        `Discord sign-in is failing: ${result.stranded} attempts in the last 6 hours reached Discord and none completed. ` +
          'The callback logs the cause rather than throwing it: `bunx convex logs --prod`, filter on /api/auth/callback/discord.'
      )
    }
    return result
  },
})
