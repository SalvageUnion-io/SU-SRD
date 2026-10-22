import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { HOMEBREW_PATTERNS_PATH } from '../../lib/homebrew/endpoint'
import { serveHomebrew } from '../homebrew'
import type { Env } from '../index'
import worker from '../index'

/**
 * `GET /homebrew/patterns.json` (ADR-056): the SRD's pages read homebrew from
 * their own origin, and the Worker reads it from Convex.
 */

const CONVEX_URL = 'https://convex.example'
const ROWS = [{ appId: 'pat-1', body: { name: 'Tow Rig' }, madeBy: 'Rosa', sharedAt: 1 }]

/** A fake Convex that answers `homebrew:patterns`, recording what it was asked. */
function convex(answer: Response | (() => never)) {
  const asked: unknown[] = []
  const impl = (async (_url: string, init?: RequestInit) => {
    asked.push(JSON.parse(String(init?.body)))
    if (typeof answer === 'function') answer()
    return (answer as Response).clone()
  }) as unknown as typeof fetch
  return { impl, asked }
}

const ok = () => new Response(JSON.stringify({ status: 'success', value: ROWS }), { status: 200 })

describe('serveHomebrew', () => {
  it('serves every pattern, cached for a minute', async () => {
    const fake = convex(ok())
    const res = await serveHomebrew(
      new URL(`https://x${HOMEBREW_PATTERNS_PATH}`),
      { CONVEX_URL },
      fake.impl
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public,max-age=60')
    expect(await res.json()).toEqual(ROWS)
    expect(fake.asked).toEqual([{ path: 'homebrew:patterns', args: {}, format: 'json' }])
  })

  it('narrows to one chassis, and refuses a ref no chassis has', async () => {
    const fake = convex(ok())
    await serveHomebrew(
      new URL(`https://x${HOMEBREW_PATTERNS_PATH}?chassis=mule`),
      { CONVEX_URL },
      fake.impl
    )
    expect(fake.asked).toEqual([
      { path: 'homebrew:patterns', args: { chassisRef: 'mule' }, format: 'json' },
    ])
    const bad = await serveHomebrew(
      new URL(`https://x${HOMEBREW_PATTERNS_PATH}?chassis=..%2F`),
      { CONVEX_URL },
      fake.impl
    )
    expect(bad.status).toBe(400)
  })

  it('answers 503, uncached, when Convex does not', async () => {
    const down = convex(new Response('', { status: 500 }))
    const res = await serveHomebrew(
      new URL(`https://x${HOMEBREW_PATTERNS_PATH}`),
      { CONVEX_URL },
      down.impl
    )
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const unset = await serveHomebrew(new URL(`https://x${HOMEBREW_PATTERNS_PATH}`), {}, down.impl)
    expect(unset.status).toBe(503)
  })
})

describe('the Worker', () => {
  let spy: ReturnType<typeof spyOn> | undefined
  afterEach(() => spy?.mockRestore())

  it('routes the path to it', async () => {
    spy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      ok()) as unknown as typeof fetch)
    const env = { CONVEX_URL, ASSETS: { fetch: async () => new Response('') } } as unknown as Env
    const res = await worker.fetch(
      new Request(`https://salvageunion.io${HOMEBREW_PATTERNS_PATH}`),
      env
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(ROWS)
  })
})
