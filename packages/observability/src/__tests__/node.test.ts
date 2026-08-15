import { beforeEach, describe, expect, test } from 'bun:test'
import type { SentrySdk } from '../node'
import { createObservability } from '../node'

type Call = { fn: string; args: unknown[] }
let calls: Call[] = []
let flushShouldThrow = false

/**
 * The SDK is a constructor parameter, so the double is passed in rather than
 * swapped into the module registry.
 *
 * This file used to `mock.module('@sentry/node', …)`, which is process-global —
 * it rewrote the registry for every test file that ran after it, and needed a
 * capture-and-restore dance in `afterAll` to stay honest (see
 * `.claude/rules/testing-patterns.md`). Injection deletes that whole hazard.
 * The return values are the real ones' shapes, so this stays assignable to
 * `SentrySdk` with no cast — if the SDK's API moves, this fails typecheck.
 */
const sentry: SentrySdk = {
  init: (...args: unknown[]) => {
    calls.push({ fn: 'init', args })
    return undefined
  },
  captureException: (...args: unknown[]) => {
    calls.push({ fn: 'captureException', args })
    return 'event-id'
  },
  captureMessage: (...args: unknown[]) => {
    calls.push({ fn: 'captureMessage', args })
    return 'event-id'
  },
  flush: async (...args: unknown[]) => {
    calls.push({ fn: 'flush', args })
    if (flushShouldThrow) throw new Error('transport down')
    return true
  },
}

beforeEach(() => {
  calls = []
  flushShouldThrow = false
})

const of = (fn: string) => calls.filter((c) => c.fn === fn)

describe('with no DSN', () => {
  test('init does nothing and everything stays a no-op', async () => {
    const o = createObservability(() => ({ dsn: undefined }), sentry)
    expect(o.init()).toBe(false)
    expect(o.enabled).toBe(false)
    o.captureException(new Error('boom'))
    o.captureMessage('hello')
    await o.flush()
    // The whole point of the env gate: not one SDK call is made.
    expect(calls).toHaveLength(0)
  })
})

describe('with a DSN', () => {
  test('init passes dsn, environment and release through', () => {
    const o = createObservability(
      () => ({
        dsn: 'https://key@example.ingest.de.sentry.io/1',
        environment: 'staging',
        release: 'abc123',
      }),
      sentry
    )
    expect(o.init()).toBe(true)
    expect(o.enabled).toBe(true)
    expect(of('init')[0]?.args[0]).toEqual({
      dsn: 'https://key@example.ingest.de.sentry.io/1',
      environment: 'staging',
      release: 'abc123',
    })
  })

  test('environment defaults to production', () => {
    const o = createObservability(() => ({ dsn: 'https://k@e.io/1' }), sentry)
    o.init()
    const options = of('init')[0]?.args[0] as { environment?: string } | undefined
    expect(options?.environment).toBe('production')
  })

  test('a second init is a no-op, so startup can call it freely', () => {
    const o = createObservability(() => ({ dsn: 'https://k@e.io/1' }), sentry)
    o.init()
    o.init()
    expect(of('init')).toHaveLength(1)
  })

  test('context rides as `extra`, and is omitted when absent', () => {
    const o = createObservability(() => ({ dsn: 'https://k@e.io/1' }), sentry)
    o.init()
    const err = new Error('boom')
    o.captureException(err, { entityId: 'e1' })
    o.captureException(err)
    expect(of('captureException')[0]?.args[1]).toEqual({ extra: { entityId: 'e1' } })
    expect(of('captureException')[1]?.args[1]).toBeUndefined()
  })

  test('flush passes the timeout and swallows a transport failure', async () => {
    const o = createObservability(() => ({ dsn: 'https://k@e.io/1' }), sentry)
    o.init()
    flushShouldThrow = true
    // Never rejects: the caller is on its way to process.exit().
    await o.flush(1234)
    expect(of('flush')[0]?.args[0]).toBe(1234)
  })
})

describe('the config thunk', () => {
  /**
   * The regression this exists for. An earlier draft took a plain object and
   * captured the DSN at import, which broke every consumer whose configuration
   * is not known at module scope — `process.env` on a Netlify cold start, and a
   * mockable `config` module in the bot.
   */
  test('is read at init, not at construction', () => {
    let dsn: string | undefined
    const o = createObservability(() => ({ dsn }), sentry)

    dsn = 'https://k@e.io/1' // set AFTER the instance exists
    expect(o.init()).toBe(true)
    expect(of('init')).toHaveLength(1)
  })

  test('is not called at all before init', () => {
    let resolved = 0
    createObservability(() => {
      resolved += 1
      return { dsn: undefined }
    }, sentry)
    expect(resolved).toBe(0)
  })
})
