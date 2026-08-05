/**
 * _observability — the artwork host's only channel for finding out that
 * production broke. It is entirely env-gated, and the gate is the interesting
 * part: with no DSN every export must be a silent no-op (local dev, CI and
 * forks all run that way), and with one it must actually report. A regression
 * in either direction is invisible until the day you need it — a host that has
 * stopped reporting looks exactly like a host with no errors.
 *
 * `@sentry/node` is mocked and **restored in `afterAll`**: `mock.module` is
 * process-global in Bun, not file-scoped, so leaving it in place would hand
 * this fake to `asset.test.ts` too. The DSN is driven through `process.env`
 * because that is what the module actually reads, and it is deleted again
 * before the mock is restored so no later file inherits a live DSN.
 *
 * Assertion style: toBe() / toEqual() — not toBeInTheDocument().
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

const sentryCalls: Array<{ fn: string; args: unknown[] }> = []

const realSentry = { ...(await import('@sentry/node')) }

mock.module('@sentry/node', () => ({
  init: (...args: unknown[]) => sentryCalls.push({ fn: 'init', args }),
  captureException: (...args: unknown[]) => sentryCalls.push({ fn: 'captureException', args }),
}))

let obs: typeof import('../_observability')

beforeAll(async () => {
  obs = await import('../_observability')
})

afterAll(() => {
  delete process.env.SENTRY_DSN
  delete process.env.COMMIT_REF
  mock.module('@sentry/node', () => realSentry)
})

function calls(fn: string): Array<{ fn: string; args: unknown[] }> {
  return sentryCalls.filter((c) => c.fn === fn)
}

/**
 * These run in order against one module instance, because `initialized` /
 * `enabled` are module-level state and the transition from off to on is
 * exactly what is being tested.
 */
describe('with no DSN configured', () => {
  test('init reports nothing and does not enable Sentry', () => {
    delete process.env.SENTRY_DSN
    obs.initObservability()
    expect(calls('init')).toHaveLength(0)
  })

  test('captureException is a no-op rather than an unconfigured send', () => {
    obs.captureException(new Error('boom'))
    expect(calls('captureException')).toHaveLength(0)
  })

  test('a later init with a DSN stays off — the gate latches on first call', () => {
    // Netlify Functions call `initObservability()` at the top of every
    // invocation, so the first call of a cold start decides. A DSN appearing
    // afterwards cannot happen in production, and pretending otherwise would
    // let this test file mask a real "we never read the DSN" bug.
    process.env.SENTRY_DSN = 'https://key@example.ingest.sentry.io/1'
    obs.initObservability()
    expect(calls('init')).toHaveLength(0)
    expect(calls('captureException')).toHaveLength(0)
  })
})

/**
 * A fresh module instance, because the gate above has latched. `import()`
 * dedupes by specifier, so a query string is the way to get a second
 * evaluation of the same file. It is held in a variable rather than written
 * inline because TypeScript resolves *literal* specifiers and has no module
 * declaration for a cache-busted one; a non-literal specifier is untyped, so
 * the cast restores the real shape.
 */
const FRESH_SPECIFIER = '../_observability?fresh'

describe('once a DSN is configured before the first init', () => {
  let fresh: typeof import('../_observability')

  beforeAll(async () => {
    process.env.SENTRY_DSN = 'https://key@example.ingest.sentry.io/1'
    process.env.COMMIT_REF = 'abc123'
    fresh = (await import(FRESH_SPECIFIER)) as typeof import('../_observability')
  })

  test('init passes the DSN, environment and release through', () => {
    fresh.initObservability()

    const init = calls('init')[0]
    expect(init).toBeDefined()
    expect(init?.args[0]).toMatchObject({
      dsn: 'https://key@example.ingest.sentry.io/1',
      // bunfig.toml pins NODE_ENV = "test" for this workspace; the point is
      // that the environment is never blank — an untagged event is
      // indistinguishable from one raised in dev.
      environment: 'test',
      release: 'abc123',
    })
  })

  test('a second call is a no-op, so every invocation can call it freely', () => {
    fresh.initObservability()
    expect(calls('init')).toHaveLength(1)
  })

  test('exceptions are reported, with context as extra when given', () => {
    const error = new Error('blobs down')
    fresh.captureException(error, { fn: 'asset', key: 'chassis/iron-mongrel.png' })

    const c = calls('captureException')[0]
    expect(c?.args[0]).toBe(error)
    expect(c?.args[1]).toEqual({ extra: { fn: 'asset', key: 'chassis/iron-mongrel.png' } })
  })

  test('no context sends undefined rather than an empty extra bag', () => {
    fresh.captureException(new Error('bare'))
    expect(calls('captureException')[1]?.args[1]).toBeUndefined()
  })
})
