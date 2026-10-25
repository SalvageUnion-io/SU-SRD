import { describe, expect, it } from 'bun:test'
import { HOMEBREW_PATTERNS_PATH } from '../../lib/homebrew/endpoint'
import { serveHomebrew } from '../homebrew'
import type { Env } from '../index'
import worker from '../index'
import { testDb } from '../shared/__tests__/d1'
import type { SharedDb } from '../shared/db'
import { putHomebrew, setHomebrewHidden } from '../shared/homebrew'

/**
 * `GET /homebrew/patterns.json` (ADR-061): the SRD's pages read homebrew from
 * their own origin, and the Worker reads it from the shared database.
 */

const TOW_RIG = {
  appId: 'pat-1',
  ownerId: 'u-1',
  chassisRef: 'mule',
  name: 'Tow Rig',
  body: { name: 'Tow Rig', chassisRef: 'mule' },
  madeBy: 'Rosa',
  sharedAt: 1,
}
const ROW = { appId: 'pat-1', body: TOW_RIG.body, madeBy: 'Rosa', sharedAt: 1 }

async function listing(): Promise<SharedDb> {
  const db = testDb()
  await putHomebrew(db, TOW_RIG)
  await putHomebrew(db, { ...TOW_RIG, appId: 'pat-2', chassisRef: 'brawler', sharedAt: 2 })
  return db
}

const at = (query = '') => new URL(`https://x${HOMEBREW_PATTERNS_PATH}${query}`)

describe('serveHomebrew', () => {
  it('serves every pattern, newest share first, cached for a minute', async () => {
    const res = await serveHomebrew(at(), { SHARED: await listing() })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public,max-age=60')
    expect(((await res.json()) as { appId: string }[]).map((r) => r.appId)).toEqual([
      'pat-2',
      'pat-1',
    ])
  })

  it('narrows to one chassis, and refuses a ref no chassis has', async () => {
    const SHARED = await listing()
    expect(await (await serveHomebrew(at('?chassis=mule'), { SHARED })).json()).toEqual([ROW])
    expect((await serveHomebrew(at('?chassis=..%2F'), { SHARED })).status).toBe(400)
  })

  it('leaves out a hidden pattern', async () => {
    const SHARED = await listing()
    await setHomebrewHidden(SHARED, 'pat-2', true)
    expect(await (await serveHomebrew(at(), { SHARED })).json()).toEqual([ROW])
  })

  it('answers 503, uncached, when the shared database does not', async () => {
    const down: SharedDb = {
      prepare() {
        throw new Error('D1 is down')
      },
      batch: async () => [],
    }
    const res = await serveHomebrew(at(), { SHARED: down })
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect((await serveHomebrew(at(), {})).status).toBe(503)
  })
})

describe('the Worker', () => {
  it('routes the path to it', async () => {
    const env = {
      SHARED: await listing(),
      ASSETS: { fetch: async () => new Response('') },
    } as unknown as Env
    const res = await worker.fetch(
      new Request(`https://salvageunion.io${HOMEBREW_PATTERNS_PATH}?chassis=mule`),
      env
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([ROW])
  })
})
