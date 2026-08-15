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
  captureCheckIn: (...args: unknown[]) => {
    calls.push({ fn: 'captureCheckIn', args })
    if (checkInShouldThrow) throw new Error('check-in transport down')
    return 'check-in-id'
  },
}

let checkInShouldThrow = false

/** Captures `console.warn` so the missing-DSN alarm can be asserted, not merely printed. */
function recordWarnings(): { warnings: string[]; restore: () => void } {
  const warnings: string[] = []
  const real = console.warn
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  }
  return {
    warnings,
    restore: () => {
      console.warn = real
    },
  }
}

beforeEach(() => {
  calls = []
  flushShouldThrow = false
  checkInShouldThrow = false
})

const of = (fn: string) => calls.filter((c) => c.fn === fn)

describe('with no DSN', () => {
  test('init does nothing and everything stays a no-op', async () => {
    const w = recordWarnings()
    try {
      const o = createObservability(() => ({ dsn: undefined }), sentry)
      expect(o.init()).toBe(false)
      expect(o.enabled).toBe(false)
      o.captureException(new Error('boom'))
      o.captureMessage('hello')
      await o.flush()
      // The whole point of the env gate: not one SDK call is made.
      expect(calls).toHaveLength(0)
    } finally {
      w.restore()
    }
  })

  test('it SAYS it is reporting nothing, naming the surface and where to fix it', () => {
    // `itun-functions` received zero events in its entire existence, and nothing
    // distinguished that from "no errors happened". This warning is the only
    // thing that can, so it is asserted rather than left to inspection.
    const w = recordWarnings()
    try {
      createObservability(
        () => ({
          dsn: undefined,
          surface: 'the itun snapshot Functions',
          remediation: "the Netlify site's env vars, with the Functions scope enabled",
        }),
        sentry
      ).init()
    } finally {
      w.restore()
    }

    expect(w.warnings).toHaveLength(1)
    expect(w.warnings[0]).toContain('SENTRY_DSN not set')
    expect(w.warnings[0]).toContain('the itun snapshot Functions')
    expect(w.warnings[0]).toContain('Functions scope')
  })

  test('warns once per process, not once per init call', () => {
    const w = recordWarnings()
    try {
      const o = createObservability(() => ({ dsn: undefined }), sentry)
      o.init()
      o.init()
      o.init()
    } finally {
      w.restore()
    }
    // A Function cold start calls init on every invocation path; a warning per
    // call would bury the function log it is supposed to make legible.
    expect(w.warnings).toHaveLength(1)
  })

  test('startHeartbeat starts no timer at all when disabled', () => {
    const w = recordWarnings()
    let started = 0
    try {
      const o = createObservability(() => ({ dsn: undefined }), sentry)
      o.init()
      const stop = o.startHeartbeat({
        monitorSlug: 'x',
        intervalMs: 1000,
        monitorConfig: { schedule: { type: 'interval', value: 5, unit: 'minute' } },
        setIntervalFn: (() => {
          started++
          return 0 as unknown as ReturnType<typeof setInterval>
        }) as unknown as typeof setInterval,
      })
      stop()
    } finally {
      w.restore()
    }
    expect(started).toBe(0)
    expect(of('captureCheckIn')).toHaveLength(0)
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

describe('startHeartbeat — the liveness monitor', () => {
  /** A controllable stand-in for the global timer, so no test waits on wall clock. */
  function fakeTimer() {
    let tick: (() => void) | null = null
    let cleared = 0
    let unrefs = 0
    const handle = {
      unref: () => {
        unrefs++
        return handle
      },
    }
    return {
      cleared: () => cleared,
      unrefs: () => unrefs,
      fire: () => tick?.(),
      setIntervalFn: ((cb: () => void) => {
        tick = cb
        return handle as unknown as ReturnType<typeof setInterval>
      }) as unknown as typeof setInterval,
      clearIntervalFn: (() => {
        cleared++
      }) as unknown as typeof clearInterval,
    }
  }

  const enabled = () => {
    const o = createObservability(() => ({ dsn: 'https://k@e.io/1' }), sentry)
    o.init()
    return o
  }

  const monitorConfig = {
    schedule: { type: 'interval', value: 5, unit: 'minute' },
    checkinMargin: 2,
  } as const

  const start = (o: ReturnType<typeof enabled>, timer: ReturnType<typeof fakeTimer>) =>
    o.startHeartbeat({
      monitorSlug: 'discord-bot-heartbeat',
      intervalMs: 300_000,
      monitorConfig,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    })

  test('checks in immediately, not only on the first interval', () => {
    const timer = fakeTimer()
    start(enabled(), timer)

    // Without the eager check-in the monitor's first window closes with nothing
    // sent, so a perfectly healthy start reads as a missed check-in.
    expect(of('captureCheckIn')).toHaveLength(1)
    expect(of('captureCheckIn')[0]?.args[0]).toEqual({
      monitorSlug: 'discord-bot-heartbeat',
      status: 'ok',
    })
  })

  test('upserts the monitor config, so there is no dashboard step to forget', () => {
    const timer = fakeTimer()
    start(enabled(), timer)
    expect(of('captureCheckIn')[0]?.args[1]).toEqual(monitorConfig)
  })

  test('keeps checking in on the interval, and stop() ends it', () => {
    const timer = fakeTimer()
    const stop = start(enabled(), timer)

    timer.fire()
    timer.fire()
    expect(of('captureCheckIn')).toHaveLength(3) // 1 eager + 2 ticks

    stop()
    expect(timer.cleared()).toBe(1)
  })

  test('unrefs the timer, so liveness reporting never keeps the process alive', () => {
    const timer = fakeTimer()
    start(enabled(), timer)
    expect(timer.unrefs()).toBe(1)
  })

  test('a failing check-in does not take the worker down with it', () => {
    const timer = fakeTimer()
    checkInShouldThrow = true

    // This runs on a bare timer, so an escaping throw becomes an unhandled
    // rejection — the monitor killing the very thing it monitors.
    expect(() => start(enabled(), timer)).not.toThrow()
    expect(() => timer.fire()).not.toThrow()
  })
})
