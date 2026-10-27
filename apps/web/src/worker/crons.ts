/**
 * The Worker's Cron Triggers (`triggers.crons` in wrangler.jsonc), over the
 * shared database (ADR-057):
 *
 *   - `METRICS_CRON`, daily: the usage totals into a snapshot (`takeSnapshot`).
 *   - `FEEDBACK_CRON`, hourly: waiting feedback filed as GitHub issues, and
 *     old rows deleted (`sweepFeedback`).
 *
 * A failure throws, so it reaches Workers Issues as the run's exception.
 */

import type { SharedDb } from './shared/db'
import { sweepFeedback } from './shared/feedback'
import { takeSnapshot } from './shared/signals'

/** 05:13 UTC every day. */
export const METRICS_CRON = '13 5 * * *'

/** Twenty-three minutes past every hour. */
export const FEEDBACK_CRON = '23 * * * *'

export type CronEnv = {
  SHARED?: SharedDb
  /**
   * A GitHub token that may open issues on SU-SRD (`wrangler secret put`).
   * Unset, feedback waits, and is dropped after a week.
   */
  GITHUB_FEEDBACK_TOKEN?: string
}

/** Run the job a Cron Trigger names. */
export async function runCron(
  cron: string,
  env: CronEnv,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  if (!env.SHARED) throw new Error('cron: no shared database bound')
  if (cron === METRICS_CRON) {
    await takeSnapshot(env.SHARED, now)
    return
  }
  if (cron === FEEDBACK_CRON) {
    const result = await sweepFeedback(env.SHARED, env.GITHUB_FEEDBACK_TOKEN, fetchImpl, now)
    if (result.failed > 0)
      throw new Error(`feedback sweep: GitHub refused ${result.failed} note(s)`)
    return
  }
  throw new Error(`cron: no job for "${cron}"`)
}
