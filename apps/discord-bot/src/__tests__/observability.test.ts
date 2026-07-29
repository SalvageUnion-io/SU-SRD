import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'

/**
 * observability — the bot's only channel for finding out that production
 * broke. It is entirely env-gated, and the gate is the interesting part: with
 * no DSN every function must be a silent no-op (local dev and CI run that way),
 * and with one it must actually report. A regression in either direction is
 * invisible until the day you need it — a bot that has stopped reporting looks
 * exactly like a bot with no errors.
 *
 * `config` is mocked rather than driven through `process.env`, deliberately.
 * `config.ts` reads the environment once at module scope, so setting
 * `SENTRY_DSN` here would hand a live DSN to every test file that runs after
 * this one — `mock.module` is process-global in Bun, not file-scoped, and the
 * env is worse still. Both the mocks below are captured and restored.
 */

const sentryCalls: Array<{ fn: string; args: unknown[] }> = []
let flushShouldThrow = false
let dsn: string | undefined

// `config.ts` throws at module scope on a missing token, and it is evaluated by
// the capture below. Same `??=` as the sibling tests, and deliberately no
// SENTRY_DSN: the DSN is supplied through the mock, never the environment.
process.env.DISCORD_TOKEN ??= 'test-token'
process.env.DISCORD_CLIENT_ID ??= 'test-client-id'

const realSentry = { ...(await import('@sentry/node')) }
const realConfig = { ...(await import('../config.js')) }

mock.module('@sentry/node', () => ({
  init: (...args: unknown[]) => sentryCalls.push({ fn: 'init', args }),
  flush: async (...args: unknown[]) => {
    sentryCalls.push({ fn: 'flush', args })
    if (flushShouldThrow) throw new Error('transport down')
    return true
  },
  captureException: (...args: unknown[]) => sentryCalls.push({ fn: 'captureException', args }),
  captureMessage: (...args: unknown[]) => sentryCalls.push({ fn: 'captureMessage', args }),
}))

mock.module('../config.js', () => ({
  config: {
    get sentryDsn() {
      return dsn
    },
    nodeEnv: undefined,
    releaseSha: 'abc123',
  },
}))

let obs: typeof import('../observability.js')

beforeAll(async () => {
  obs = await import('../observability.js')
})

afterAll(() => {
  mock.module('@sentry/node', () => realSentry)
  mock.module('../config.js', () => realConfig)
})

function calls(fn: string): Array<{ fn: string; args: unknown[] }> {
  return sentryCalls.filter((c) => c.fn === fn)
}

/**
 * These run in order against one module instance, because `enabled` is
 * module-level state and the transition from off to on is exactly what is
 * being tested.
 */
describe('with no DSN configured', () => {
  test('init reports nothing and does not enable Sentry', () => {
    dsn = undefined
    obs.initObservability()
    expect(calls('init')).toHaveLength(0)
  })

  test('captureException is a no-op rather than an unconfigured send', () => {
    obs.captureException(new Error('boom'))
    expect(calls('captureException')).toHaveLength(0)
  })

  test('captureMessage is a no-op too', () => {
    obs.captureMessage('ready')
    expect(calls('captureMessage')).toHaveLength(0)
  })

  test('flush resolves immediately instead of waiting on a transport', async () => {
    // A 2s flush timeout on every exit of a bot that never had a DSN would be
    // two wasted seconds on every restart.
    await obs.flushObservability()
    expect(calls('flush')).toHaveLength(0)
  })
})

describe('once a DSN is configured', () => {
  test('init passes the DSN, environment and release through', () => {
    dsn = 'https://key@example.ingest.sentry.io/1'
    obs.initObservability()

    const init = calls('init')[0]
    expect(init).toBeDefined()
    expect(init?.args[0]).toMatchObject({
      dsn: 'https://key@example.ingest.sentry.io/1',
      // Unset NODE_ENV must not leave the environment blank — an untagged event
      // is indistinguishable from one raised in dev.
      environment: 'production',
      release: 'abc123',
    })
  })

  test('a second call is a no-op, so startup can call it freely', () => {
    obs.initObservability()
    expect(calls('init')).toHaveLength(1)
  })

  test('exceptions are reported, with context as extra when given', () => {
    const error = new Error('boom')
    obs.captureException(error, { guildId: 'g1' })

    const c = calls('captureException')[0]
    expect(c?.args[0]).toBe(error)
    expect(c?.args[1]).toEqual({ extra: { guildId: 'g1' } })
  })

  test('no context sends undefined rather than an empty extra bag', () => {
    obs.captureException(new Error('bare'))
    expect(calls('captureException')[1]?.args[1]).toBeUndefined()
  })

  test('messages are reported — the worker has no port to health-probe', () => {
    obs.captureMessage('logged in', { shard: 0 })
    const c = calls('captureMessage')[0]
    expect(c?.args[0]).toBe('logged in')
    expect(c?.args[1]).toEqual({ extra: { shard: 0 } })
  })

  test('flush is awaited before exit, with the timeout passed through', async () => {
    // The transport is async; a synchronous exit right after captureException
    // drops the one event the restart happened for.
    await obs.flushObservability(500)
    expect(calls('flush')[0]?.args[0]).toBe(500)
  })

  test('a failing flush never rejects — the process is exiting anyway', async () => {
    flushShouldThrow = true
    expect(await obs.flushObservability(10).then(() => 'resolved')).toBe('resolved')
    flushShouldThrow = false
  })
})
