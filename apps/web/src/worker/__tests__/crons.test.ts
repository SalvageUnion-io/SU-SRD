import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { BACKUP_CRON, FEEDBACK_CRON, runCron } from '../crons'
import type { Env } from '../env'
import { testDb } from '../shared/__tests__/d1'
import { acceptFeedback } from '../shared/feedback'
import { worker } from './worker'

/** The Worker's Cron Triggers: the hourly feedback sweep and the nightly backup. */

const WRANGLER = (
  (await import(join(import.meta.dir, '../../../wrangler.jsonc'))) as {
    default: { triggers: { crons: string[] } }
  }
).default

describe('the Cron Triggers', () => {
  it('are the two wrangler.jsonc schedules', () => {
    expect(WRANGLER.triggers.crons).toEqual([FEEDBACK_CRON, BACKUP_CRON])
  })

  it('run through the Worker, and an unknown schedule throws there too', async () => {
    const SHARED = testDb()
    const env = { SHARED } as unknown as Env
    await worker.scheduled({ cron: FEEDBACK_CRON, scheduledTime: 5 }, env)
    await expect(worker.scheduled({ cron: '* * * * *', scheduledTime: 5 }, env)).rejects.toThrow(
      'no job'
    )
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
    await expect(runCron(FEEDBACK_CRON, {})).rejects.toThrow('no shared database')
    await expect(runCron(BACKUP_CRON, { SHARED })).rejects.toThrow('no archive bucket')
  })

  it('back up every room the shared database knows into the archive', async () => {
    const SHARED = testDb()
    SHARED.sqlite.exec("insert into games (game_id, name, updated_at) values ('g-1', 'Wastes', 1)")
    const written: string[] = []
    const ARCHIVE = {
      put: async (key: string) => {
        written.push(key)
      },
      get: async () => null,
    }
    const rooms = () => ({
      dump: async () => ({ format: 1 as const, schema: 1, tables: { units: [{ id: 'u' }] } }),
      restore: async () => {},
    })
    await runCron(BACKUP_CRON, { SHARED, ARCHIVE }, Date.UTC(2026, 9, 30), fetch, rooms)
    expect(written).toEqual(['rooms/2026-10-30/game/g-1.json', 'rooms/2026-10-30/manifest.json'])
  })
})
