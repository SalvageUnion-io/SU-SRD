import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

/**
 * observability — ITUN's only channel for finding out that production broke.
 *
 * It is entirely env-gated, and the gate is the interesting part: with no DSN
 * every function must be a silent no-op (local dev, CI and every build without
 * the var provisioned run that way), and with one it must actually report. A
 * regression in either direction is invisible until the day you need it — an
 * app that has stopped reporting looks exactly like an app with no errors.
 * That is the argument `apps/discord-bot/src/__tests__/observability.test.ts`
 * makes, and this file follows its mocking discipline deliberately, as its
 * srd counterpart does.
 *
 * `captureException` earns its own cases here rather than riding along with
 * `captureMessage`: catching is exactly what PREVENTS an error reaching
 * Sentry's `globalHandlers` integration, so a deliberately-caught failure —
 * including a failed mirror to the server of record — is reportable ONLY
 * through this function. It previously had no test at all.
 *
 * `mock.module` is process-global in Bun, not file-scoped, so the real
 * `@sentry/browser` namespace is captured BEFORE mocking and restored in
 * `afterAll`. Skipping that leaks the stub into every one of ITUN's ~180 test
 * files that happens to run later in the same process.
 *
 * The module is imported ONCE, statically, and the cases below walk its real
 * state machine in order — unconfigured, then configured, then already
 * configured. Re-importing under a cache-busting query instead would create a
 * fresh module each time and, more to the point, attribute no coverage to the
 * file under test. The DSN is driven through `process.env` because Bun backs
 * `import.meta.env` with it (asserted below rather than assumed) and the
 * module reads the var inside `initBrowserObservability`, not at module scope.
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
  captureMessage: (...args: unknown[]) => {
    sentryCalls.push({ fn: 'captureMessage', args })
  },
}))

const { captureException, captureMessage, initBrowserObservability } = await import(
  '../observability'
)

/** Env keys this file writes, so `afterAll` can put the environment back. */
const ENV_KEYS = ['VITE_SENTRY_DSN', 'VITE_COMMIT_REF'] as const
const realEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]))

afterAll(() => {
  mock.module('@sentry/browser', () => realSentry)
  // Restore rather than blank: a leaked DSN-shaped string would make every
  // later file in this process think observability is configured.
  for (const [key, value] of realEnv) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

beforeEach(() => {
  sentryCalls.length = 0
})

describe('observability', () => {
  // Order matters: these walk one module's state machine, unconfigured first.

  test('import.meta.env is process.env under Bun — the premise the gate is driven through', () => {
    // Stated as an assertion, not a comment. If Bun ever stops backing one
    // with the other, every case below would still pass while testing only
    // the no-DSN branch, which is precisely the silent-hole failure mode this
    // file exists to prevent.
    expect(import.meta.env).toBe(process.env)
    expect(import.meta.env.VITE_SENTRY_DSN).toBeUndefined()
  })

  test('with no DSN, init loads nothing and both capture verbs are silent no-ops', async () => {
    await initBrowserObservability()
    captureException(new Error('unreported'))
    captureMessage('unreported')

    // Not merely "does not throw" — nothing reached Sentry at all, so an
    // un-provisioned deploy ships no Sentry code and makes no requests.
    expect(sentryCalls).toEqual([])
  })

  test('with a DSN, init configures Sentry with the environment and release', async () => {
    process.env.VITE_SENTRY_DSN = 'https://public@o0.ingest.de.sentry.io/1'
    process.env.VITE_COMMIT_REF = 'deadbeef'

    // That this call initialises at all is the assertion: the DSN-less call in
    // the previous case must NOT have latched. It guards the ORDER of the two
    // early returns — `initialized` is set after the DSN check, not before, so
    // one call on an un-provisioned load cannot permanently disable reporting.
    await initBrowserObservability()

    const init = sentryCalls.find((c) => c.fn === 'init')
    expect(init).toBeTruthy()
    const options = init?.args[0] as Record<string, unknown>

    expect(options.dsn).toBe('https://public@o0.ingest.de.sentry.io/1')
    // Release tagging is what maps a production error back to a deploy, and it
    // has to stay in step with the release name @sentry/vite-plugin uploads
    // sourcemaps under — a mismatch means sourcemaps silently do not apply.
    expect(options.release).toBe('deadbeef')
    expect(options).toHaveProperty('environment')
    // Errors only — no tracing or replay. Keeps the CSP surface to the ingest
    // origin and the network chatter to actual failures.
    expect(options.tracesSampleRate).toBe(0)
  })

  test('init is idempotent — a second call does not reconfigure Sentry', async () => {
    await initBrowserObservability()

    expect(sentryCalls.filter((c) => c.fn === 'init')).toHaveLength(0)
  })

  test('concurrent calls still init once', async () => {
    // `initialized` is set BEFORE the dynamic import is awaited, specifically
    // so two callers racing on load cannot both reach `Sentry.init`.
    await Promise.all([initBrowserObservability(), initBrowserObservability()])

    expect(sentryCalls.filter((c) => c.fn === 'init')).toHaveLength(0)
  })

  test('captureException forwards the error, with context as extra when given', () => {
    const boom = new Error('mirror to server of record failed')
    captureException(boom, { entityKind: 'pilot' })

    const captured = sentryCalls.find((c) => c.fn === 'captureException')
    expect(captured?.args[0]).toBe(boom)
    expect(captured?.args[1]).toEqual({ extra: { entityKind: 'pilot' } })
  })

  test('captureException with no context sends undefined, not an empty extra bag', () => {
    captureException(new Error('bare'))

    expect(sentryCalls.find((c) => c.fn === 'captureException')?.args[1]).toBeUndefined()
  })

  test('captureMessage forwards too — snapshot-backend outages are not exceptions', () => {
    // `probeSnapshotService` feature-detects an outage and handles it; without
    // this verb that detection stays silent and nobody learns the backend is
    // down (see ShareSnapshotScreen).
    captureMessage('snapshot backend unavailable', { status: 503 })

    const captured = sentryCalls.find((c) => c.fn === 'captureMessage')
    expect(captured?.args[0]).toBe('snapshot backend unavailable')
    expect(captured?.args[1]).toEqual({ extra: { status: 503 } })
  })

  test('captureMessage with no context sends undefined too', () => {
    captureMessage('bare')

    expect(sentryCalls.find((c) => c.fn === 'captureMessage')?.args[1]).toBeUndefined()
  })
})
