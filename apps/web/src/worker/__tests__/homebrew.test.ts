import { describe, expect, it, spyOn } from 'bun:test'
import { HOMEBREW_PATTERNS_PATH } from '../../lib/homebrew/endpoint'
import type { Env } from '../env'
import { serveHomebrew } from '../homebrew'
import { testDb } from '../shared/__tests__/d1'
import type { SharedDb } from '../shared/db'
import { worker } from './worker'

/**
 * `GET /homebrew/patterns.json` (ADR-061): the SRD's pages read homebrew from
 * their own origin, and the Worker reads it from the shared database.
 */

const at = (query = '') => new URL(`https://x${HOMEBREW_PATTERNS_PATH}${query}`)

describe('serveHomebrew', () => {
  it('serves every pattern, cached for a minute', async () => {
    const res = await serveHomebrew(at(), { SHARED: testDb() })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public,max-age=60')
    expect(await res.json()).toEqual([])
  })

  it('refuses a ref no chassis has', async () => {
    expect((await serveHomebrew(at('?chassis=mule'), { SHARED: testDb() })).status).toBe(200)
    expect((await serveHomebrew(at('?chassis=..%2F'), { SHARED: testDb() })).status).toBe(400)
  })

  it('answers 503, uncached, unbound or when the read fails', async () => {
    const unbound = await serveHomebrew(at(), {})
    expect(unbound.status).toBe(503)
    expect(unbound.headers.get('cache-control')).toBe('no-store')
    const errors = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const broken = {
        prepare: () => {
          throw new Error('D1 down')
        },
      } as unknown as SharedDb
      expect((await serveHomebrew(at(), { SHARED: broken })).status).toBe(503)
    } finally {
      errors.mockRestore()
    }
  })
})

describe('the Worker', () => {
  it('routes the path to it', async () => {
    const env = { SHARED: testDb(), ASSETS: { fetch: async () => new Response('') } }
    const res = await worker.fetch(
      new Request(`https://salvageunion.io${HOMEBREW_PATTERNS_PATH}`),
      env as unknown as Env
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
