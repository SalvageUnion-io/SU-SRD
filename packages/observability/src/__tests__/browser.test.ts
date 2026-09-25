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

  test('dedupe sends one error object once; without it, every time', async () => {
    const deduped = fakeSdk()
    const a = createBrowserObservability({ dedupe: true })
    await a.init(async () => deduped.sdk, { dsn: DSN })
    const err = new Error('twice')
    a.captureException(err)
    a.captureException(err)
    // Primitives cannot be tracked, so they are always sent.
    a.captureException('string-error')
    a.captureException('string-error')
    expect(deduped.calls.filter((c) => c.fn === 'captureException')).toHaveLength(3)

    const plain = fakeSdk()
    const b = createBrowserObservability()
    await b.init(async () => plain.sdk, { dsn: DSN })
    b.captureException(err)
    b.captureException(err)
    expect(plain.calls.filter((c) => c.fn === 'captureException')).toHaveLength(2)
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
