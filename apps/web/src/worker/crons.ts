/**
 * The Worker's Cron Triggers (`triggers.crons` in wrangler.jsonc), over the
 * shared database (ADR-057):
 *
 *   - `METRICS_CRON`, daily: the usage totals into a snapshot (`takeSnapshot`).
 *   - `FEEDBACK_CRON`, hourly: waiting feedback filed as GitHub issues, and
 *     old rows deleted (`sweepFeedback`).
 *   - `BACKUP_CRON`, daily: every room's storage into R2 (`backUpRooms`).
 *
 * A failure throws, so it reaches Workers Issues as the run's exception.
 */

import { backupRooms } from './roomStubs'
import type { ArchiveBucket, BackupRooms } from './shared/backups'
import { backUpRooms } from './shared/backups'
import type { SharedDb } from './shared/db'
import { sweepFeedback } from './shared/feedback'
import { takeSnapshot } from './shared/signals'

/** 05:13 UTC every day. */
export const METRICS_CRON = '13 5 * * *'

/** Twenty-three minutes past every hour. */
export const FEEDBACK_CRON = '23 * * * *'

/** 04:43 UTC every day, the quietest hour. */
export const BACKUP_CRON = '43 4 * * *'

export type CronEnv = {
  SHARED?: SharedDb
  /**
   * A GitHub token that may open issues on SU-SRD (`wrangler secret put`).
   * Unset, feedback waits, and is dropped after a week.
   */
  GITHUB_FEEDBACK_TOKEN?: string
  /** The private archive bucket the room backups go to (`su-archive`); not on a Preview. */
  ARCHIVE?: ArchiveBucket
}

/** Run the job a Cron Trigger names. */
export async function runCron(
  cron: string,
  env: CronEnv,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
  rooms: () => BackupRooms = backupRooms
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
  if (cron === BACKUP_CRON) {
    if (!env.ARCHIVE) throw new Error('cron: no archive bucket bound for the room backup')
    await backUpRooms(env.SHARED, env.ARCHIVE, rooms(), now)
    return
  }
  throw new Error(`cron: no job for "${cron}"`)
}
