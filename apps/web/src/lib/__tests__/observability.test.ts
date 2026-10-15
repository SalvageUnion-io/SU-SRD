import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * observability — srd's only channel for finding out that production broke.
 *
 * It is gated on a production build, and the gate is the interesting part:
 * outside one every function must be a silent no-op (the dev server has no
 * Worker to post to), and inside one it must actually report. A regression in
 * either direction is invisible until the day you need it — a site that has
 * stopped reporting looks exactly like a site with no errors.
 *
 * The module is imported ONCE, statically, and the cases below walk its real
 * state machine in order — not production, then production. The gate is
 * driven through `process.env` because Bun backs `import.meta.env` with it and
 * the module reads `PROD` inside `initBrowserObservability`, not at module
 * scope. What leaves the page is read off `fetch`: the transport falls back to
 * a `keepalive` fetch where there is no `sendBeacon`, as under happy-dom here.
 */

const posts: Array<{ url: string; body: Record<string, unknown> }> = []
const realFetch = globalThis.fetch
const nav = globalThis.navigator as unknown as { sendBeacon?: unknown }
const realBeacon = nav.sendBeacon
const ENV_KEYS = ['PROD', 'VITE_COMMIT_REF'] as const
const realEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]))

nav.sendBeacon = undefined
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  posts.push({ url: String(input), body: JSON.parse(String(init?.body)) })
  return new Response(null, { status: 204 })
}) as typeof fetch

const { captureException, initBrowserObservability } = await import('../observability')

/** Stops the module's reporting, so it does not outlive this file. */
let teardown = () => {}

afterAll(() => {
  teardown()
  globalThis.fetch = realFetch
  nav.sendBeacon = realBeacon
  for (const [key, value] of realEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

beforeEach(() => {
  posts.length = 0
})

describe('observability', () => {
  // Order matters: these walk one module's state machine, not production first.

  test('outside a production build, init does nothing and capture is a silent no-op', () => {
    delete process.env.PROD
    initBrowserObservability()
    captureException(new Error('unreported'))
    expect(posts).toEqual([])
  })

  test('in a production build, a caught error is posted to srd’s Worker with the release', () => {
    process.env.PROD = 'true'
    process.env.VITE_COMMIT_REF = 'deadbeef'
    // That this call initialises at all is the assertion: the call in the
    // previous case must NOT have latched.
    teardown = initBrowserObservability()

    captureException(new Error('boom'), { where: 'island' })

    expect(posts).toHaveLength(1)
    expect(posts[0]?.url).toBe('/__errors')
    expect(posts[0]?.body).toMatchObject({
      name: 'Error',
      message: 'boom',
      release: 'deadbeef',
      context: { where: 'island' },
    })
  })

  test('the browser’s abandoned view transitions are never reported', () => {
    // Cross-document view transitions reject a promise the browser owns
    // whenever it abandons a transition. It is not ours to catch and it means
    // nothing went wrong. Matched against the real titles of the three issues
    // these were added for.
    const titles: Array<[string, string]> = [
      ['AbortError', 'Transition was skipped'], // SRD-A
      ['AbortError', 'Skipping view transition because skipTransition() was called.'], // SRD-B
      ['InvalidStateError', 'Transition was aborted because of invalid state'], // SRD-D
    ]
    for (const [name, message] of titles) {
      captureException(Object.assign(new Error(message), { name }))
    }
    expect(posts).toEqual([])
  })

  test('init is idempotent, and capture still posts after a second call', () => {
    initBrowserObservability()
    captureException(new Error('later'))
    expect(posts).toHaveLength(1)
    expect(posts[0]?.body).not.toHaveProperty('context')
  })
})
