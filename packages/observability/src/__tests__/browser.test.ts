import { describe, expect, test } from 'bun:test'
import type { BrowserSentrySdk } from '../browser'
import { buildCaptureHint, createBrowserObservability } from '../browser'

/**
 * `buildCaptureHint` was the whole of `observability/browser` — the piece the
 * itun and srd Sentry shims shared — and until this file it had no direct test.
 * `createBrowserObservability` (audit AP-12) is tested at the bottom.
 * The package's only test covered `src/node.ts`, which is deleted along with the
 * Discord bot's Node gateway, so writing this was the alternative to leaving the
 * workspace with no tests at all.
 *
 * What it protects is not obvious from the function: it returns `undefined`
 * rather than `{}` because `Sentry.captureException(err, {})` and
 * `captureException(err)` are not the same call — an empty hint overrides
 * nothing but still travels through the SDK's hint-merging path. And the
 * fingerprint/tags fields exist because Convex's redacted errors
 * (`"[CONVEX M(fn)] [Request ID: 1b66…] Server Error"`) carry a per-request id
 * in the message, so without an explicit fingerprint one condition scatters
 * across issues titled with request ids. That happened in production.
 */
describe('buildCaptureHint', () => {
  test('returns undefined when there is nothing to attach', () => {
    // Not `{}`: an empty hint is a different call to the SDK, not a no-op.
    expect(buildCaptureHint()).toBeUndefined()
    expect(buildCaptureHint(undefined, undefined)).toBeUndefined()
    expect(buildCaptureHint(undefined, {})).toBeUndefined()
  })

  test('puts context under `extra`, which Sentry does not index', () => {
    expect(buildCaptureHint({ appId: 'abc' })).toEqual({ extra: { appId: 'abc' } })
  })

  test('carries tags and fingerprint through unchanged', () => {
    expect(buildCaptureHint(undefined, { tags: { surface: 'itun' } })).toEqual({
      tags: { surface: 'itun' },
    })
    expect(buildCaptureHint(undefined, { fingerprint: ['convex', 'games.create'] })).toEqual({
      fingerprint: ['convex', 'games.create'],
    })
  })

  test('combines all three without reordering or dropping any', () => {
    expect(
      buildCaptureHint(
        { requestId: '1b66' },
        { tags: { surface: 'srd' }, fingerprint: ['convex', 'server-error'] }
      )
    ).toEqual({
      extra: { requestId: '1b66' },
      tags: { surface: 'srd' },
      fingerprint: ['convex', 'server-error'],
    })
  })

  test('an empty context object still produces a hint', () => {
    // `{}` is truthy, so this attaches `extra: {}` rather than returning
    // undefined. Pinned because it is the one case where the "nothing to
    // attach" shortcut does NOT apply, and a future `Object.keys(context)`
    // guard would silently change it.
    expect(buildCaptureHint({})).toEqual({ extra: {} })
  })

  test('does not mutate the caller’s objects', () => {
    // The shims pass objects they keep using; the hint must be a fresh one.
    const context = { appId: 'abc' }
    const options = { tags: { surface: 'itun' } }
    const hint = buildCaptureHint(context, options)

    expect(hint).not.toBe(context)
    expect(hint?.extra).toBe(context)
    expect(context).toEqual({ appId: 'abc' })
    expect(options).toEqual({ tags: { surface: 'itun' } })
  })
})

/** A recording stand-in for the `@sentry/browser` namespace. */
function fakeSdk() {
  const calls: Array<{ fn: string; args: unknown[] }> = []
  const sdk: BrowserSentrySdk = {
    init: (...args) => calls.push({ fn: 'init', args }),
    captureException: (...args) => calls.push({ fn: 'captureException', args }),
    captureMessage: (...args) => calls.push({ fn: 'captureMessage', args }),
  }
  return { sdk, calls }
}

const DSN = 'https://public@o0.ingest.de.sentry.io/1'

describe('createBrowserObservability', () => {
  test('before init, both capture verbs are silent no-ops', () => {
    const { calls } = fakeSdk()
    const obs = createBrowserObservability()
    obs.captureException(new Error('early'))
    obs.captureMessage('early')
    expect(calls).toEqual([])
  })

  test('init is errors-only and passes the deploy values through', async () => {
    const { sdk, calls } = fakeSdk()
    const obs = createBrowserObservability()
    await obs.init(async () => sdk, { dsn: DSN, environment: 'production', release: 'abc123' })

    expect(calls).toEqual([
      {
        fn: 'init',
        args: [{ dsn: DSN, environment: 'production', release: 'abc123', tracesSampleRate: 0 }],
      },
    ])
  })

  test('an empty release is omitted rather than naming a release ""', async () => {
    // Unset locally, Vite inlines `VITE_COMMIT_REF` as "" — not undefined.
    const { sdk, calls } = fakeSdk()
    await createBrowserObservability().init(async () => sdk, { dsn: DSN, release: '' })
    const options = calls[0]?.args[0] as Record<string, unknown>
    expect(options.release).toBeUndefined()
  })

  test('ignoreErrors is sent only when configured', async () => {
    const withList = fakeSdk()
    await createBrowserObservability({ ignoreErrors: ['Transition was skipped'] }).init(
      async () => withList.sdk,
      { dsn: DSN }
    )
    expect(
      (withList.calls[0]?.args[0] as Record<string, unknown> | undefined)?.ignoreErrors
    ).toEqual(['Transition was skipped'])

    const without = fakeSdk()
    await createBrowserObservability().init(async () => without.sdk, { dsn: DSN })
    expect(without.calls[0]?.args[0]).not.toHaveProperty('ignoreErrors')
  })

  test('init runs once, even when two callers race on load', async () => {
    const { sdk, calls } = fakeSdk()
    let loads = 0
    const load = async () => {
      loads += 1
      return sdk
    }
    const obs = createBrowserObservability()
    await Promise.all([obs.init(load, { dsn: DSN }), obs.init(load, { dsn: DSN })])
    await obs.init(load, { dsn: DSN })

    expect(loads).toBe(1)
    expect(calls.filter((c) => c.fn === 'init')).toHaveLength(1)
  })

  test('after init, captures forward with the shared hint shape', async () => {
    const { sdk, calls } = fakeSdk()
    const obs = createBrowserObservability()
    await obs.init(async () => sdk, { dsn: DSN })
    calls.length = 0

    const boom = new Error('boom')
    obs.captureException(boom, { where: 'island' }, { tags: { surface: 'srd' } })
    obs.captureMessage('snapshot backend down', { status: 503 })
    obs.captureMessage('bare')

    expect(calls).toEqual([
      {
        fn: 'captureException',
        args: [boom, { extra: { where: 'island' }, tags: { surface: 'srd' } }],
      },
      { fn: 'captureMessage', args: ['snapshot backend down', { extra: { status: 503 } }] },
      { fn: 'captureMessage', args: ['bare', undefined] },
    ])
  })

  test('each instance keeps its own state', async () => {
    const first = fakeSdk()
    const a = createBrowserObservability()
    const b = createBrowserObservability()
    await a.init(async () => first.sdk, { dsn: DSN })
    b.captureException(new Error('b is not initialised'))
    expect(first.calls.filter((c) => c.fn === 'captureException')).toHaveLength(0)
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
  function setup(deps: { storage?: Storage; now?: () => number } = {}) {
    const target = new EventTarget()
    const obs = createBrowserObservability()
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

  test('a burst of failures in one page is one reload and one event', async () => {
    // A page that fails several imports at once: the first schedules the
    // reload, and the rest are the same skew, not failed recoveries.
    const { sdk, calls } = fakeSdk()
    const { obs, target, teardown, reloads } = setup()
    await obs.init(async () => sdk, { dsn: DSN })

    firePreloadError(target)
    const second = firePreloadError(target)
    const third = firePreloadError(target)
    teardown()

    expect(reloads()).toBe(1)
    expect(second.defaultPrevented).toBe(true)
    expect(third.defaultPrevented).toBe(true)
    const captured = calls.filter((c) => c.fn === 'captureException')
    expect(captured).toHaveLength(1)
    expect(captured[0]?.args[1]).toMatchObject({ tags: { recovered: 'true' } })
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
