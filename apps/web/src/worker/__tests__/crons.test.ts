import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { FEEDBACK_CRON, METRICS_CRON, runCron } from '../crons'
import type { Env } from '../env'
import { testDb } from '../shared/__tests__/d1'
import { markFilled } from '../shared/db'
import { acceptFeedback } from '../shared/feedback'
import { readMetrics } from '../shared/signals'
import { worker } from './worker'

/** The Worker's Cron Triggers: the daily snapshot and the hourly feedback sweep. */

const WRANGLER = (
  (await import(join(import.meta.dir, '../../../wrangler.jsonc'))) as {
    default: { triggers: { crons: string[] } }
  }
).default

describe('the Cron Triggers', () => {
  it('are the two wrangler.jsonc schedules', () => {
    expect(WRANGLER.triggers.crons).toEqual([METRICS_CRON, FEEDBACK_CRON])
  })

  it('take the snapshot through the Worker, once the database is filled', async () => {
    const SHARED = testDb()
    const tick = (scheduledTime: number) =>
      worker.scheduled({ cron: METRICS_CRON, scheduledTime }, { SHARED } as unknown as Env)
    await tick(4)
    expect((await readMetrics(SHARED)).snapshot).toBeNull()
    await markFilled(SHARED)
    await tick(5)
    expect((await readMetrics(SHARED)).snapshot?.takenAt).toBe(5)
  })

  it('throw when GitHub refuses a note, so the run reaches Workers Issues', async () => {
    const SHARED = testDb()
    await acceptFeedback(SHARED, {
      sender: 'user:u-1',
      source: 'app',
      kind: 'report',
      text: 'Something is broken here.',
      page: null,
    })
    const refuse = (async () => new Response('', { status: 500 })) as unknown as typeof fetch
    await expect(
      runCron(FEEDBACK_CRON, { SHARED, GITHUB_FEEDBACK_TOKEN: 't' }, Date.now(), refuse)
    ).rejects.toThrow('refused 1')
    await expect(runCron('* * * * *', { SHARED })).rejects.toThrow('no job')
    await expect(runCron(METRICS_CRON, {})).rejects.toThrow('no shared database')
  })
})
