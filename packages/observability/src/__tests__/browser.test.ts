import { describe, expect, test } from 'bun:test'
import { buildCaptureHint } from '../browser'

/**
 * `buildCaptureHint` is the whole of `observability/browser` — the piece the
 * itun and srd Sentry shims share — and until this file it had no direct test.
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
