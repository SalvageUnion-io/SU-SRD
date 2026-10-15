import { afterEach, describe, expect, test } from 'bun:test'
import type { ErrorReport } from '../browserObservability'
import {
  createBrowserObservability,
  ERROR_REPORT_PATH,
  MAX_REPORTS_PER_PAGE,
} from '../browserObservability'

/** A recording transport: every report that would leave the page. */
function recorder() {
  const sent: Array<{ endpoint: string; report: ErrorReport }> = []
  const transport = (endpoint: string, body: string) => {
    sent.push({ endpoint, report: JSON.parse(body) as ErrorReport })
  }
  return { sent, transport }
}

const ENDPOINT = `/build${ERROR_REPORT_PATH}`

describe('createBrowserObservability', () => {
  test('before init, captureException is a silent no-op', () => {
    const { sent, transport } = recorder()
    createBrowserObservability({ transport }).captureException(new Error('early'))
    expect(sent).toEqual([])
  })

  test('after init, a caught error is posted to the endpoint with its context', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, release: 'abc123', target: new EventTarget() })

    const boom = new Error('boom')
    obs.captureException(boom, { where: 'island' }, { tags: { surface: 'srd' } })

    expect(sent).toHaveLength(1)
    expect(sent[0]?.endpoint).toBe(ENDPOINT)
    expect(sent[0]?.report).toMatchObject({
      name: 'Error',
      message: 'boom',
      release: 'abc123',
      context: { where: 'island' },
      tags: { surface: 'srd' },
    })
    expect(sent[0]?.report.stack).toContain('boom')
  })

  test('an empty release is omitted rather than naming a release ""', () => {
    // Unset locally, Vite inlines `VITE_COMMIT_REF` as "" — not undefined.
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, release: '', target: new EventTarget() })
    obs.captureException(new Error('x'))
    expect(sent[0]?.report).not.toHaveProperty('release')
  })

  test('the fingerprint travels with the report, for the Worker to group by', () => {
    // Convex's redacted errors carry a per-request id in the message, so
    // without a fingerprint one condition scatters across issues.
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException(
      new Error('[CONVEX M(games:create)] [Request ID: 1b66] Server Error'),
      undefined,
      {
        fingerprint: ['convex', 'games:create'],
      }
    )
    expect(sent[0]?.report.fingerprint).toEqual(['convex', 'games:create'])
  })

  test('ignoreErrors drops a match of the error’s name and message, and only a match', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport, ignoreErrors: ['Transition was skipped'] })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException(Object.assign(new Error('Transition was skipped'), { name: 'AbortError' }))
    obs.captureException(new Error('a real one'))
    expect(sent.map((s) => s.report.message)).toEqual(['a real one'])
  })

  test('the ResizeObserver loop notice is dropped with no ignoreErrors of the app’s own', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException('ResizeObserver loop completed with undelivered notifications.')
    obs.captureException(new Error('ResizeObserver loop limit exceeded'))
    obs.captureException(new Error('a real one'))
    expect(sent.map((s) => s.report.message)).toEqual(['a real one'])
  })

  test('the same error object is reported once, however many handlers see it', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    const boom = new Error('seen twice')
    obs.captureException(boom)
    obs.captureException(boom)
    expect(sent).toHaveLength(1)
  })

  test('a page sends at most MAX_REPORTS_PER_PAGE reports', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    for (let i = 0; i < MAX_REPORTS_PER_PAGE + 5; i++) obs.captureException(new Error(`loop ${i}`))
    expect(sent).toHaveLength(MAX_REPORTS_PER_PAGE)
  })

  test('a thrown non-Error, a cyclic context and a failing transport never throw', () => {
    const obs = createBrowserObservability({
      transport: () => {
        throw new Error('offline')
      },
    })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => obs.captureException('a string', cyclic)).not.toThrow()
  })

  test('a non-Error is named NonError, with its JSON as the message', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException({ code: 42 })
    expect(sent[0]?.report).toMatchObject({ name: 'NonError', message: '{"code":42}' })
  })

  test('init hears the window’s error and unhandledrejection events, once', () => {
    const { sent, transport } = recorder()
    const target = new EventTarget()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target })
    obs.init({ endpoint: '/elsewhere', target })

    const uncaught = new Event('error')
    Object.assign(uncaught, { error: new Error('uncaught'), message: 'Uncaught Error: uncaught' })
    target.dispatchEvent(uncaught)
    const rejection = new Event('unhandledrejection')
    Object.assign(rejection, { reason: new Error('rejected') })
    target.dispatchEvent(rejection)

    expect(sent.map((s) => [s.endpoint, s.report.message, s.report.tags])).toEqual([
      [ENDPOINT, 'uncaught', { handler: 'error' }],
      [ENDPOINT, 'rejected', { handler: 'unhandledrejection' }],
    ])
  })

  test('teardown stops reporting and removes the window listeners', () => {
    const { sent, transport } = recorder()
    const target = new EventTarget()
    const obs = createBrowserObservability({ transport })
    const teardown = obs.init({ endpoint: ENDPOINT, target })
    teardown()

    obs.captureException(new Error('after teardown'))
    const rejection = new Event('unhandledrejection')
    Object.assign(rejection, { reason: new Error('after teardown too') })
    target.dispatchEvent(rejection)
    expect(sent).toEqual([])
  })

  test('a thrown value JSON cannot serialise is reported by its string form', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException(10n)
    expect(sent[0]?.report).toMatchObject({ name: 'NonError', message: '10' })
  })

  test('an oversized context is sent truncated, not dropped', () => {
    const { sent, transport } = recorder()
    const obs = createBrowserObservability({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException(new Error('big'), { blob: 'x'.repeat(5_000) })
    const context = sent[0]?.report.context as { truncated?: string }
    expect(context.truncated?.length).toBeLessThan(2_100)
  })

  test('each instance keeps its own state', () => {
    const { sent, transport } = recorder()
    const a = createBrowserObservability({ transport })
    const b = createBrowserObservability({ transport })
    a.init({ endpoint: ENDPOINT, target: new EventTarget() })
    b.captureException(new Error('b is not initialised'))
    expect(sent).toHaveLength(0)
  })
})

/**
 * The default transport: `navigator.sendBeacon`, and a `keepalive` fetch where
 * the beacon is missing or refuses the report.
 */
describe('the default transport', () => {
  const nav = globalThis.navigator as unknown as { sendBeacon?: unknown }
  const realBeacon = nav.sendBeacon
  const realFetch = globalThis.fetch

  afterEach(() => {
    nav.sendBeacon = realBeacon
    globalThis.fetch = realFetch
  })

  function capture(): void {
    const obs = createBrowserObservability()
    const teardown = obs.init({ endpoint: ENDPOINT, target: new EventTarget() })
    obs.captureException(new Error('sent'))
    teardown()
  }

  test('sends with sendBeacon when it accepts the report', () => {
    const beacons: unknown[][] = []
    nav.sendBeacon = (...args: unknown[]) => {
      beacons.push(args)
      return true
    }
    globalThis.fetch = (() => {
      throw new Error('fetch must not run')
    }) as unknown as typeof fetch
    capture()
    expect(beacons).toHaveLength(1)
    expect(beacons[0]?.[0]).toBe(ENDPOINT)
  })

  test('falls back to a keepalive POST, and swallows its failure', async () => {
    nav.sendBeacon = () => false
    const fetched: RequestInit[] = []
    globalThis.fetch = (async (_: unknown, init?: RequestInit) => {
      fetched.push(init ?? {})
      throw new Error('offline')
    }) as unknown as typeof fetch
    capture()
    await Promise.resolve()
    expect(fetched).toHaveLength(1)
    expect(fetched[0]).toMatchObject({ method: 'POST', keepalive: true })
  })
})

/** Minimal in-memory Storage stand-in. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage
}

/** A storage whose every access throws, as in a locked-down privacy mode. */
function hostileStorage(): Storage {
  const deny = () => {
    throw new Error('denied')
  }
  return {
    clear: deny,
    getItem: deny,
    key: deny,
    removeItem: deny,
    setItem: deny,
  } as unknown as Storage
}

function firePreloadError(target: EventTarget): Event {
  const event = new Event('vite:preloadError', { cancelable: true })
  Object.defineProperty(event, 'payload', {
    value: new Error('Failed to fetch dynamically imported module: /assets/x-OLDHASH.js'),
  })
  target.dispatchEvent(event)
  return event
}

/**
 * The deploy-skew reload guard, driven with a dispatched `vite:preloadError`
 * on a plain EventTarget. Storage, clock and reload are injected, so nothing
 * touches a real page.
 */
describe('installChunkRecovery', () => {
  function setup(
    deps: {
      storage?: Storage
      now?: () => number
      transport?: (endpoint: string, body: string) => void
    } = {}
  ) {
    const target = new EventTarget()
    const obs = createBrowserObservability({ transport: deps.transport })
    let reloads = 0
    const teardown = obs.installChunkRecovery({
      target,
      storage: deps.storage ?? fakeStorage(),
      reload: () => {
        reloads += 1
      },
      now: deps.now ?? (() => 1_000_000),
    })
    return { obs, target, teardown, reloads: () => reloads }
  }

  test('reloads once on the first preload failure, and cancels the rethrow', () => {
    const { target, teardown, reloads } = setup()
    const event = firePreloadError(target)
    teardown()

    expect(reloads()).toBe(1)
    expect(event.defaultPrevented).toBe(true)
  })

  test('a burst of failures in one page is one reload and one event', () => {
    // A page that fails several imports at once: the first schedules the
    // reload, and the rest are the same skew, not failed recoveries.
    const { sent, transport } = recorder()
    const { obs, target, teardown, reloads } = setup({ transport })
    obs.init({ endpoint: ENDPOINT, target: new EventTarget() })

    firePreloadError(target)
    const second = firePreloadError(target)
    const third = firePreloadError(target)
    teardown()

    expect(reloads()).toBe(1)
    expect(second.defaultPrevented).toBe(true)
    expect(third.defaultPrevented).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.report).toMatchObject({
      fingerprint: ['chunk-preload-error'],
      tags: { recovered: 'true' },
    })
  })

  test('does NOT reload inside a cooldown a previous load recorded — the loop guard', () => {
    // The reload happened, the page came back, and it failed again at once.
    const { target, teardown, reloads } = setup({
      storage: fakeStorage({ 'chunk-reload-at': '1000000' }),
      now: () => 1_002_000,
    })
    const event = firePreloadError(target)
    teardown()

    expect(reloads()).toBe(0)
    // Left to surface, not silently swallowed.
    expect(event.defaultPrevented).toBe(false)
  })

  test('rearms after the cooldown, so a later deploy in a long-lived tab still recovers', () => {
    const storage = fakeStorage({ 'chunk-reload-at': '1000000' })
    const { target, teardown, reloads } = setup({ storage, now: () => 1_060_000 })
    firePreloadError(target)
    teardown()

    expect(reloads()).toBe(1)
    expect(storage.getItem('chunk-reload-at')).toBe('1060000')
  })

  test('still recovers when sessionStorage throws on every access', () => {
    const { target, teardown, reloads } = setup({ storage: hostileStorage() })
    expect(() => firePreloadError(target)).not.toThrow()
    teardown()

    expect(reloads()).toBe(1)
  })

  test('listens on the global object (the page’s window) by default', () => {
    let reloads = 0
    const teardown = createBrowserObservability().installChunkRecovery({
      storage: fakeStorage(),
      reload: () => {
        reloads += 1
      },
    })
    firePreloadError(globalThis)
    teardown()

    expect(reloads).toBe(1)
  })

  test('removes its listener on teardown', () => {
    const { target, teardown, reloads } = setup()
    teardown()
    firePreloadError(target)

    expect(reloads()).toBe(0)
  })
})
