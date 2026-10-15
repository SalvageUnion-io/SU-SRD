import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

/**
 * observability — the Cantina's only channel for finding out that production broke.
 *
 * It is gated on a production build, and the gate is the interesting part:
 * outside one every function must be a silent no-op (the dev server has no
 * Worker to post to), and inside one it must actually report. A regression in
 * either direction is invisible until the day you need it — an app that has
 * stopped reporting looks exactly like an app with no errors.
 *
 * `captureException` earns its own cases here: catching is exactly what
 * PREVENTS an error reaching the window's `error` event, so a
 * deliberately-caught failure — including a failed Change Log commit — is
 * reportable ONLY through this function.
 *
 * The module is imported ONCE, statically, and the cases below walk its real
 * state machine in order. The gate is driven through `process.env` because Bun
 * backs `import.meta.env` with it (asserted below rather than assumed). What
 * leaves the page is read off `fetch`: the transport falls back to a
 * `keepalive` fetch where there is no `sendBeacon`.
 */

const posts: Array<{ url: string; body: Record<string, unknown> }> = []
const realFetch = globalThis.fetch
const nav = globalThis.navigator as unknown as { sendBeacon?: unknown }
const realBeacon = nav.sendBeacon
/** Env keys this file writes, so `afterAll` can put the environment back. */
const ENV_KEYS = ['PROD', 'VITE_COMMIT_REF'] as const
const realEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]))

nav.sendBeacon = undefined
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  posts.push({ url: String(input), body: JSON.parse(String(init?.body)) })
  return new Response(null, { status: 204 })
}) as typeof fetch

const { captureException, initBrowserObservability, reactRootErrorHandlers } = await import(
  '../observability'
)

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

/** Runs `fn` with `console.error` silenced: the React hooks still log. */
function quietly(fn: () => void): void {
  const realConsoleError = console.error
  console.error = () => {}
  try {
    fn()
  } finally {
    console.error = realConsoleError
  }
}

describe('observability', () => {
  // Order matters: these walk one module's state machine, not production first.

  test('a process.env write is visible through import.meta.env — the premise the gate is driven through', () => {
    // If Bun ever stops backing one with the other, every case below would
    // still pass while testing only the no-op branch.
    process.env.VITE_ENV_PREMISE_CHECK = 'yes'
    expect(import.meta.env.VITE_ENV_PREMISE_CHECK).toBe('yes')
    delete process.env.VITE_ENV_PREMISE_CHECK
  })

  test('outside a production build, init does nothing and capture is a silent no-op', () => {
    delete process.env.PROD
    initBrowserObservability()
    captureException(new Error('unreported'))
    expect(posts).toEqual([])
  })

  test('in a production build, a caught error is posted under the base with the release', () => {
    process.env.PROD = 'true'
    process.env.VITE_COMMIT_REF = 'deadbeef'
    // That this call initialises at all is the assertion: the call in the
    // previous case must NOT have latched.
    teardown = initBrowserObservability()

    captureException(new Error('change log commit failed'), { entityKind: 'pilot' })

    expect(posts).toHaveLength(1)
    expect(posts[0]?.url).toBe('/build/__errors')
    expect(posts[0]?.body).toMatchObject({
      message: 'change log commit failed',
      release: 'deadbeef',
      context: { entityKind: 'pilot' },
    })
  })

  test('init is idempotent', () => {
    initBrowserObservability()
    captureException(new Error('once'))
    expect(posts).toHaveLength(1)
  })

  test('captureException carries fingerprint and tags', () => {
    // The grouping half. Without it a Convex defect groups by its own message,
    // which carries a per-request id — one condition, N issues.
    captureException(
      new Error('[CONVEX M(entities:upsertByAppId)] [Request ID: abc] Server Error'),
      { source: 'commitWrite' },
      {
        fingerprint: ['cantina-commit-write-failed', 'entities:upsertByAppId', 'defect'],
        tags: { convex_function: 'entities:upsertByAppId' },
      }
    )

    expect(posts[0]?.body).toMatchObject({
      context: { source: 'commitWrite' },
      fingerprint: ['cantina-commit-write-failed', 'entities:upsertByAppId', 'defect'],
      tags: { convex_function: 'entities:upsertByAppId' },
    })
  })

  test('a render error a boundary catches is reported, with its component stack', () => {
    // The whole point of the createRoot hooks: a caught render error never
    // reaches the window's `error` event, so without this it was recorded nowhere.
    quietly(() => {
      reactRootErrorHandlers.onCaughtError(
        new Error('Cannot read properties of undefined (reading hp)'),
        { componentStack: '\n    at MechSheet' }
      )
    })

    expect(posts[0]?.body).toMatchObject({
      context: { componentStack: '\n    at MechSheet' },
      tags: { boundary: 'caught' },
    })
  })

  test('an error no boundary catches is reported and tagged as such', () => {
    quietly(() => {
      reactRootErrorHandlers.onUncaughtError(new Error('escaped every boundary'), {})
    })

    expect(posts[0]?.body).toMatchObject({ tags: { boundary: 'uncaught' } })
  })
})
