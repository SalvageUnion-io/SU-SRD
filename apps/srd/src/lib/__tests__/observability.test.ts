import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

/**
 * observability — srd's only channel for finding out that production broke.
 *
 * It is entirely env-gated, and the gate is the interesting part: with no DSN
 * every function must be a silent no-op (local dev, CI and every build without
 * the var provisioned run that way), and with one it must actually report. A
 * regression in either direction is invisible until the day you need it — a
 * site that has stopped reporting looks exactly like a site with no errors.
 * That is the argument `apps/discord-bot/src/__tests__/observability.test.ts`
 * makes, and this file follows its mocking discipline deliberately.
 *
 * `mock.module` is process-global in Bun, not file-scoped, so the real
 * `@sentry/browser` namespace is captured BEFORE mocking and restored in
 * `afterAll`. Skipping that leaks the stub into every test file that runs
 * later in the same process.
 *
 * The module is imported ONCE, statically, and the cases below walk its real
 * state machine in order — unconfigured, then configured, then already
 * configured. Re-importing under a cache-busting query instead would create a
 * fresh module each time and, more to the point, attribute no coverage to the
 * file under test. The DSN is driven through `process.env` because Bun backs
 * `import.meta.env` with it (verified) and the module reads the var inside
 * `initBrowserObservability`, not at module scope.
 */

const sentryCalls: Array<{ fn: string; args: unknown[] }> = []

const realSentry = { ...(await import('@sentry/browser')) }

mock.module('@sentry/browser', () => ({
  ...realSentry,
  init: (...args: unknown[]) => {
    sentryCalls.push({ fn: 'init', args })
  },
  captureException: (...args: unknown[]) => {
    sentryCalls.push({ fn: 'captureException', args })
  },
}))

const { captureException, initBrowserObservability } = await import('../observability')

afterAll(() => {
  mock.module('@sentry/browser', () => realSentry)
  process.env.PUBLIC_SENTRY_DSN = ''
  process.env.PUBLIC_COMMIT_REF = ''
})

beforeEach(() => {
  sentryCalls.length = 0
})

describe('observability', () => {
  // Order matters: these walk one module's state machine, unconfigured first.

  test('with no DSN, init loads nothing and capture is a silent no-op', async () => {
    process.env.PUBLIC_SENTRY_DSN = ''

    await initBrowserObservability()
    captureException(new Error('unreported'))

    // Not merely "does not throw" — nothing reached Sentry at all, so an
    // un-provisioned deploy ships no Sentry code and makes no requests.
    expect(sentryCalls).toEqual([])
  })

  test('with a DSN, init configures Sentry and captureException forwards to it', async () => {
    process.env.PUBLIC_SENTRY_DSN = 'https://public@o0.ingest.de.sentry.io/1'
    process.env.PUBLIC_COMMIT_REF = 'deadbeef'

    await initBrowserObservability()

    const init = sentryCalls.find((c) => c.fn === 'init')
    expect(init).toBeTruthy()
    const options = init?.args[0] as Record<string, unknown>
    expect(options.dsn).toBe('https://public@o0.ingest.de.sentry.io/1')
    // Release tagging is what maps a production error back to a deploy, and it
    // has to stay in step with the sourcemap release name.
    expect(options.release).toBe('deadbeef')
    // Errors only — no tracing. Keeps the CSP surface to the ingest origin
    // `tools/check-observability.ts` asserts against both netlify.tomls.
    expect(options.tracesSampleRate).toBe(0)

    const boom = new Error('boom')
    captureException(boom, { where: 'island' })

    const captured = sentryCalls.find((c) => c.fn === 'captureException')
    expect(captured?.args[0]).toBe(boom)
    expect(captured?.args[1]).toEqual({ extra: { where: 'island' } })
  })

  test('init is idempotent — a second call does not reconfigure Sentry', async () => {
    await initBrowserObservability()

    expect(sentryCalls.filter((c) => c.fn === 'init')).toHaveLength(0)
  })

  test('captureException still forwards after init, with no context', () => {
    const boom = new Error('later')
    captureException(boom)

    const captured = sentryCalls.find((c) => c.fn === 'captureException')
    expect(captured?.args[0]).toBe(boom)
    expect(captured?.args[1]).toBeUndefined()
  })
})
