import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { finishCheckIn, reportError, startCheckIn, withObservability } from '../cloudflare'

/**
 * `withObservability` is the whole of the three production Workers' error
 * reporting, and this surface has shipped reporting to NOTHING before: for the
 * entire Cloudflare cutover every Worker logged to `console.error` only, while
 * the checker that should have noticed stayed green (see the module header).
 * Until this file it had no test either (audit PK-12).
 *
 * So these drive the REAL `@sentry/cloudflare` SDK — no `mock.module`, which
 * is process-global in Bun and would only prove that our code calls a stub.
 * The one seam replaced is `globalThis.fetch`, which is the SDK's transport on
 * workerd: every envelope it would send to Sentry lands in `sent` instead.
 * That makes the assertions about what actually leaves the Worker — "an event
 * for this error, tagged with this release, from this server" — rather than
 * about which function was called.
 *
 * `fetch` is restored in `afterAll`; nothing else global is touched.
 */

type Envelope = { url: string; items: Record<string, unknown>[] }
const sent: Envelope[] = []
const realFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const body = typeof init?.body === 'string' ? init.body : ''
    const items = body
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
    sent.push({ url, items })
    return new Response('{}', { status: 200 })
  }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = realFetch
})

afterEach(() => {
  sent.length = 0
})

const DSN = 'https://public@o0.ingest.de.sentry.io/1'

/** A workerd-shaped ctx whose `waitUntil` promises the test can drain. */
function makeCtx() {
  const pending: Promise<unknown>[] = []
  return {
    ctx: {
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise)
      },
    },
    drain: () => Promise.allSettled(pending),
  }
}

/** Every error event in what was sent (envelope items carrying `exception`). */
function errorEvents(): Record<string, unknown>[] {
  return sent.flatMap((e) => e.items).filter((item) => 'exception' in item)
}

function exceptionValue(event: Record<string, unknown>): string | undefined {
  const exception = event.exception as { values?: { value?: string }[] } | undefined
  return exception?.values?.[0]?.value
}

describe('withObservability', () => {
  test('with a DSN, an error escaping fetch is reported and still rethrown', async () => {
    const worker = withObservability('test-worker', {
      fetch() {
        throw new Error('escaped-fetch')
      },
    })
    const { ctx, drain } = makeCtx()

    const outcome = await Promise.resolve(
      worker.fetch(
        new Request('https://worker.test/publish', { method: 'POST', body: 'player-sheet' }),
        { SENTRY_DSN: DSN, COMMIT_REF: 'abc123' },
        ctx
      )
    ).catch((error: unknown) => error)
    await drain()

    // Rethrown: reporting must not turn a crash into a silent 200.
    expect(outcome).toBeInstanceOf(Error)
    expect((outcome as Error).message).toBe('escaped-fetch')

    // Sent to the ingest host the DSN encodes — the host the CSP checks pin.
    expect(sent.length).toBeGreaterThan(0)
    expect(
      sent.every((e) => e.url.startsWith('https://o0.ingest.de.sentry.io/api/1/envelope/'))
    ).toBe(true)

    const [event] = errorEvents()
    expect(event).toBeDefined()
    if (!event) return
    expect(exceptionValue(event)).toBe('escaped-fetch')
    // The release is what maps an error back to a deploy.
    expect(event.release).toBe('abc123')
    expect(event.environment).toBe('production')
    // Three Workers report into one account; the server name is what says which.
    expect(event.server_name).toBe('test-worker')
    // `sendDefaultPii: false` — a request body is a player's sheet or a signed
    // Discord payload and must never ride along in a report.
    expect(JSON.stringify(sent)).not.toContain('player-sheet')
  })

  test('SENTRY_ENVIRONMENT overrides the production default', async () => {
    const worker = withObservability('test-worker', {
      fetch() {
        throw new Error('staging-error')
      },
    })
    const { ctx, drain } = makeCtx()

    await Promise.resolve(
      worker.fetch(
        new Request('https://worker.test/'),
        { SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: 'staging' },
        ctx
      )
    ).catch(() => undefined)
    await drain()

    const [event] = errorEvents()
    expect(event?.environment).toBe('staging')
  })

  test('with no DSN, the handler runs unchanged and nothing is sent', async () => {
    const worker = withObservability('test-worker', {
      fetch: () => new Response('ok', { status: 201, headers: { 'x-probe': '1' } }),
    })
    const { ctx, drain } = makeCtx()

    const response = await worker.fetch(new Request('https://worker.test/'), {}, ctx)
    await drain()

    expect(response.status).toBe(201)
    expect(response.headers.get('x-probe')).toBe('1')
    expect(await response.text()).toBe('ok')
    expect(sent).toEqual([])
  })

  test('with no DSN, a thrown error still propagates and nothing is sent', async () => {
    const worker = withObservability('test-worker', {
      fetch() {
        throw new Error('dark')
      },
    })
    const { ctx, drain } = makeCtx()

    const outcome = await Promise.resolve(
      worker.fetch(new Request('https://worker.test/'), {}, ctx)
    ).catch((error: unknown) => error)
    await drain()

    expect((outcome as Error).message).toBe('dark')
    expect(sent).toEqual([])
  })

  test('an error thrown by a scheduled handler is reported too', async () => {
    // Nobody watches a cron run, so an unreported throw there is silent by
    // definition — this is the case the wrapper matters most for.
    const worker = withObservability('test-worker', {
      fetch: () => new Response('ok'),
      scheduled() {
        throw new Error('cron-failed')
      },
    })
    const { ctx, drain } = makeCtx()

    await Promise.resolve(
      worker.scheduled?.({ cron: '*/5 * * * *', scheduledTime: 0 }, { SENTRY_DSN: DSN }, ctx)
    ).catch(() => undefined)
    await drain()

    expect(errorEvents().map(exceptionValue)).toContain('cron-failed')
  })
})

describe('reportError', () => {
  test('reports a HANDLED error, with its context under extra', async () => {
    // The Workers catch nearly everything and turn it into a response, so
    // `withObservability` never sees those; this is the only way they alert.
    const worker = withObservability('test-worker', {
      fetch() {
        reportError(new Error('storage-down'), { bucket: 'snapshots' })
        return new Response('unavailable', { status: 503 })
      },
    })
    const { ctx, drain } = makeCtx()

    const response = await worker.fetch(
      new Request('https://worker.test/'),
      { SENTRY_DSN: DSN },
      ctx
    )
    await drain()

    expect(response.status).toBe(503)
    const event = errorEvents().find((e) => exceptionValue(e) === 'storage-down')
    expect(event).toBeDefined()
    expect(event?.extra).toEqual({ bucket: 'snapshots' })
    expect(event?.server_name).toBe('test-worker')
  })

  test('is a safe no-op with no DSN, inside a handler or outside one', async () => {
    const worker = withObservability('test-worker', {
      fetch() {
        reportError(new Error('unreported'))
        return new Response('ok')
      },
    })
    const { ctx, drain } = makeCtx()

    const response = await worker.fetch(new Request('https://worker.test/'), {}, ctx)
    expect(() => reportError(new Error('outside'), { at: 'module' })).not.toThrow()
    await drain()

    expect(response.status).toBe(200)
    expect(sent).toEqual([])
  })
})

describe('cron check-ins', () => {
  test('open and close a check-in around a scheduled run', async () => {
    const ids: string[] = []
    const worker = withObservability('test-worker', {
      fetch: () => new Response('ok'),
      scheduled() {
        const id = startCheckIn('test-monitor')
        ids.push(id)
        finishCheckIn('test-monitor', id, 'ok')
      },
    })
    const { ctx, drain } = makeCtx()

    await worker.scheduled?.({ cron: '*/5 * * * *', scheduledTime: 0 }, { SENTRY_DSN: DSN }, ctx)
    await drain()

    expect(ids).toHaveLength(1)
    expect(typeof ids[0]).toBe('string')

    const checkIns = sent
      .flatMap((e) => e.items)
      .filter((item) => item.monitor_slug === 'test-monitor')
    // Both phases, same id: a monitor that only heard "ok" could not tell
    // "failed" from "never ran".
    expect(checkIns.map((c) => c.status)).toEqual(['in_progress', 'ok'])
    expect(checkIns.every((c) => c.check_in_id === ids[0])).toBe(true)
  })
})
