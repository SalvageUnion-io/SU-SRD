/**
 * snapshot/client — publish → retrieve round-trip tests (#244).
 *
 * The existing PublishButton tests exercise the UI flow using a mocked
 * publishFn and hardcoded payloads. This file tests the actual client
 * functions (publishSnapshot, retrieveSnapshot, SnapshotNotFoundError)
 * by stubbing the global fetch to avoid real HTTP calls.
 *
 * Strategy:
 *   - Stub global.fetch before each test; restore after.
 *   - publishSnapshot → stub returns { id, url } → assert return value.
 *   - retrieveSnapshot → stub returns the same payload → assert round-trip.
 *   - Error paths: non-OK publish, 404 retrieve, non-OK retrieve.
 */

import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import type { PublishResult, SnapshotPayload } from '../client'
import {
  deleteSnapshot,
  probeSnapshotService,
  publishSnapshot,
  retrieveSnapshot,
  SNAPSHOT_TIMING,
  SnapshotNotFoundError,
} from '../client'

// ---------------------------------------------------------------------------
// Fetch stub helpers
// ---------------------------------------------------------------------------

type FetchStubOptions = {
  /** Redundant with `status` now that the stub returns real Responses — kept so call sites stay declarative. */
  ok: boolean
  status: number
  body: unknown
}

/**
 * Returns a fetch-compatible function that always responds with the given
 * stub as a REAL `Response` (so it satisfies `typeof fetch` with no cast).
 * Keeps track of calls in the `calls` array for assertion.
 */
function makeFetchStub(response: FetchStubOptions): {
  fn: typeof fetch
  calls: Array<[string, RequestInit | undefined]>
} {
  const calls: Array<[string, RequestInit | undefined]> = []
  const fn = asFetch(async (url, opts) => {
    calls.push([String(url), opts])
    return Response.json(response.body, { status: response.status })
  })
  return { fn, calls }
}

/** Wraps a handler as `typeof fetch` — Bun's fetch also carries `preconnect`. */
function asFetch(
  impl: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): typeof fetch {
  return Object.assign(impl, { preconnect: globalThis.fetch.preconnect })
}

let originalFetch: typeof fetch

beforeEach(() => {
  originalFetch = global.fetch
})

afterEach(() => {
  global.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// publishSnapshot
// ---------------------------------------------------------------------------

describe('publishSnapshot — success', () => {
  test('returns PublishResult from server response', async () => {
    const serverResult: PublishResult = {
      id: 'abc123',
      url: '/api/snapshots/abc123',
    }
    const { fn } = makeFetchStub({ ok: true, status: 200, body: serverResult })
    global.fetch = fn

    const payload: SnapshotPayload = {
      kind: 'pilot',
      entity: { id: 'p-1', name: 'Test' },
    }
    const result = await publishSnapshot(payload)

    expect(result.id).toBe('abc123')
    expect(result.url).toBe('/api/snapshots/abc123')
  })

  test('sends POST to /api/snapshots with correct content-type', async () => {
    const serverResult: PublishResult = {
      id: 'xyz',
      url: '/api/snapshots/xyz',
    }
    const { fn, calls } = makeFetchStub({
      ok: true,
      status: 200,
      body: serverResult,
    })
    global.fetch = fn

    const payload: SnapshotPayload = { kind: 'mech', entity: { id: 'm-1' } }
    await publishSnapshot(payload)

    expect(calls.length).toBe(1)
    const call = calls[0]
    if (!call) throw new Error('expected one fetch call')
    const [url, options] = call
    expect(url).toBe('/api/snapshots')
    expect(options?.method).toBe('POST')
    const headers = options?.headers as Record<string, string> | undefined
    expect(headers?.['content-type']).toBe('application/json')
    expect(JSON.parse(options?.body as string)).toMatchObject({ kind: 'mech' })
  })
})

describe('publishSnapshot — error', () => {
  test('throws when server returns non-OK status', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 500, body: null })
    global.fetch = fn

    await expect(publishSnapshot({ data: 'x' })).rejects.toThrow('publish failed: 500')
  })
})

// ---------------------------------------------------------------------------
// retrieveSnapshot
// ---------------------------------------------------------------------------

describe('retrieveSnapshot — success', () => {
  test('returns the payload from server', async () => {
    const storedPayload: SnapshotPayload = {
      kind: 'pilot',
      entity: { id: 'p-1', name: 'Zara Heln' },
    }
    const { fn } = makeFetchStub({
      ok: true,
      status: 200,
      body: storedPayload,
    })
    global.fetch = fn

    const result = await retrieveSnapshot('abc123')

    expect(result).toMatchObject({ kind: 'pilot' })
    expect((result as { entity: { name: string } }).entity.name).toBe('Zara Heln')
  })

  test('sends GET to /api/snapshots/:id', async () => {
    const { fn, calls } = makeFetchStub({
      ok: true,
      status: 200,
      body: { kind: 'pilot', entity: {} },
    })
    global.fetch = fn

    await retrieveSnapshot('my-snap-id')

    expect(calls.length).toBe(1)
    expect(calls[0]?.[0]).toBe('/api/snapshots/my-snap-id')
  })
})

describe('retrieveSnapshot — 404', () => {
  test('throws SnapshotNotFoundError on 404', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 404, body: null })
    global.fetch = fn

    await expect(retrieveSnapshot('gone-id')).rejects.toThrow(SnapshotNotFoundError)
  })

  test('SnapshotNotFoundError carries the snapshot id', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 404, body: null })
    global.fetch = fn

    let caught: unknown
    try {
      await retrieveSnapshot('gone-id')
    } catch (e) {
      caught = e
    }

    expect(caught instanceof SnapshotNotFoundError).toBe(true)
    expect((caught as SnapshotNotFoundError).snapshotId).toBe('gone-id')
  })
})

describe('retrieveSnapshot — other errors', () => {
  test('throws generic Error on non-404 non-OK status', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 503, body: null })
    global.fetch = fn

    await expect(retrieveSnapshot('any-id')).rejects.toThrow('retrieve failed: 503')
  })
})

// ---------------------------------------------------------------------------
// Publish → retrieve round-trip (two stubbed calls)
// ---------------------------------------------------------------------------

describe('publish → retrieve round-trip', () => {
  test('a published payload can be retrieved and contains the same data', async () => {
    const payload: SnapshotPayload = {
      kind: 'pilot',
      entity: {
        id: 'pilot-roundtrip-1',
        name: 'Roundtrip Pilot',
        callsign: 'RT',
      },
    }

    const publishResult: PublishResult = {
      id: 'rt-001',
      url: '/api/snapshots/rt-001',
    }
    let callCount = 0

    global.fetch = asFetch(async () => {
      callCount++
      // POST /api/snapshots first, then GET /api/snapshots/rt-001
      return Response.json(callCount === 1 ? publishResult : payload, { status: 200 })
    })

    const published = await publishSnapshot(payload)
    expect(published.id).toBe('rt-001')

    // Retrieve using the id from publish
    const retrieved = await retrieveSnapshot(published.id)
    expect(retrieved).toMatchObject({ kind: 'pilot' })
    expect((retrieved as { entity: { name: string } }).entity.name).toBe('Roundtrip Pilot')
  })
})

// ---------------------------------------------------------------------------
// deleteSnapshot — revoke / un-publish
// ---------------------------------------------------------------------------

describe('deleteSnapshot', () => {
  test('sends DELETE to /api/snapshots/:id', async () => {
    const { fn, calls } = makeFetchStub({ ok: true, status: 204, body: null })
    global.fetch = fn

    await deleteSnapshot('abc123')

    expect(calls.length).toBe(1)
    const call = calls[0]
    if (!call) throw new Error('expected one fetch call')
    const [url, options] = call
    expect(url).toBe('/api/snapshots/abc123')
    expect(options?.method).toBe('DELETE')
  })

  test('resolves on 204 (success)', async () => {
    const { fn } = makeFetchStub({ ok: true, status: 204, body: null })
    global.fetch = fn
    await expect(deleteSnapshot('abc123')).resolves.toBeUndefined()
  })

  test('resolves on 404 (already gone — idempotent)', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 404, body: null })
    global.fetch = fn
    await expect(deleteSnapshot('gone')).resolves.toBeUndefined()
  })

  test('throws on other non-OK statuses', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 503, body: null })
    global.fetch = fn
    await expect(deleteSnapshot('any')).rejects.toThrow('delete failed: 503')
  })
})

// ---------------------------------------------------------------------------
// probeSnapshotService — S6 feature-detect
// ---------------------------------------------------------------------------

describe('probeSnapshotService', () => {
  test('sends HEAD to /api/snapshots', async () => {
    const { fn, calls } = makeFetchStub({ ok: false, status: 405, body: null })
    global.fetch = fn

    await probeSnapshotService()

    expect(calls.length).toBe(1)
    expect(calls[0]?.[0]).toBe('/api/snapshots')
    expect(calls[0]?.[1]?.method).toBe('HEAD')
  })

  test('resolves true on 405 (the publish function answers non-POST with 405)', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 405, body: null })
    global.fetch = fn
    expect(await probeSnapshotService()).toBe(true)
  })

  test('resolves true on 204 (explicit HEAD support)', async () => {
    const { fn } = makeFetchStub({ ok: true, status: 204, body: null })
    global.fetch = fn
    expect(await probeSnapshotService()).toBe(true)
  })

  test('resolves false on 404 (no function deployed)', async () => {
    const { fn } = makeFetchStub({ ok: false, status: 404, body: null })
    global.fetch = fn
    expect(await probeSnapshotService()).toBe(false)
  })

  test('resolves false on a 200 SPA-fallback response', async () => {
    const { fn } = makeFetchStub({ ok: true, status: 200, body: '<html>' })
    global.fetch = fn
    expect(await probeSnapshotService()).toBe(false)
  })

  test('resolves false (never throws) on a network error', async () => {
    global.fetch = asFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await probeSnapshotService()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Transient-platform retry (ITUN-7 / ITUN-8)
// ---------------------------------------------------------------------------

/**
 * A stub that answers each call with the next status in `statuses`, repeating
 * the last one once the list runs out. Lets a test assert on the *sequence* —
 * "a 502 then a 200" — which is the whole behaviour under test here.
 *
 * It records the `init` alongside the URL, not just the URL. Without that a
 * retry which dropped `init` would turn `probeSnapshotService`'s HEAD into a
 * GET on the second attempt and every case here would still pass — the probe
 * only reads `.status`, and a GET to the publish endpoint answers 405 too.
 */
function makeSequencedFetchStub(statuses: number[], body: unknown = { ok: true }) {
  const calls: Array<[string, RequestInit | undefined]> = []
  const fn = asFetch(async (url, init) => {
    const status = statuses[calls.length] ?? statuses[statuses.length - 1] ?? 200
    calls.push([String(url), init])
    return Response.json(body, { status })
  })
  return { fn, calls, urls: () => calls.map(([url]) => url) }
}

/**
 * Collapses the client's retry pause to nothing, and records every deadline it
 * arms on the way through.
 *
 * `.claude/rules/testing-patterns.md` bans waiting out a real timer in a test —
 * dead wall clock on every run, buying no assertion. The seam is the same one
 * this file already uses for the network: the client reaches both its pause and
 * its `AbortController` deadlines through the global `setTimeout`, so stubbing
 * that global is enough, with none of the fake-timer interleaving that an
 * in-flight promise makes fragile.
 *
 * Only the retry *pause* is collapsed; a request budget is passed through to the
 * real timer untouched. That is load-bearing, not fastidiousness — collapsing a
 * request budget would abort every request on the next tick and every test here
 * would fail as a timeout.
 *
 * Both buckets are recorded because both are asserted. The pauses catch a
 * regression that dropped the wait and hammered a cold-starting function twice
 * in one millisecond; the budgets are the only thing that pins
 * `retryTimeoutMs`, which the client's docblock calls load-bearing to its ≤10s
 * ceiling and which nothing else would notice being raised to a minute.
 */
function stubRetryDelay(): { pauses: number[]; budgets: number[]; restore: () => void } {
  const pauses: number[] = []
  const budgets: number[] = []
  const real = globalThis.setTimeout
  globalThis.setTimeout = ((cb: () => void, ms?: number, ...rest: unknown[]) => {
    if (ms !== SNAPSHOT_TIMING.retryDelayMs) {
      if (ms !== undefined) budgets.push(ms)
      return real(cb, ms, ...rest)
    }
    pauses.push(ms)
    return real(cb, 0)
  }) as typeof globalThis.setTimeout
  return {
    pauses,
    budgets,
    restore: () => {
      globalThis.setTimeout = real
    },
  }
}

describe('transient platform failures are retried once', () => {
  let retryDelay: ReturnType<typeof stubRetryDelay>

  beforeEach(() => {
    retryDelay = stubRetryDelay()
  })

  afterEach(() => {
    retryDelay.restore()
  })

  test('retrieveSnapshot survives a 502 and returns the retried payload', async () => {
    const payload = { kind: 'mech', entity: { id: 'm-1' } }
    const { fn, urls } = makeSequencedFetchStub([502, 200], payload)
    global.fetch = fn

    expect(await retrieveSnapshot('SZPPXCM3')).toEqual(payload)
    // Two attempts, both at the same URL — a retry, not a fallback endpoint.
    expect(urls()).toEqual(['/api/snapshots/SZPPXCM3', '/api/snapshots/SZPPXCM3'])
    // …separated by a real pause, not fired back-to-back at a cold start.
    expect(retryDelay.pauses).toEqual([SNAPSHOT_TIMING.retryDelayMs])
    // The retry runs on its own, shorter budget. Asserting the deadline actually
    // armed — rather than merely that a signal exists, which is true of any
    // request — is what stops `retryTimeoutMs` from being silently raised.
    //
    // `toContain`, not `toEqual`: the stub classifies timers by duration and so
    // sees every `setTimeout` in the process during this window, including any
    // happy-dom or React arms. Exact equality would make that a flake.
    expect(retryDelay.budgets).toContain(SNAPSHOT_TIMING.requestTimeoutMs)
    expect(retryDelay.budgets).toContain(SNAPSHOT_TIMING.retryTimeoutMs)
  })

  test('the timings keep their invariant: a retry cannot outlast one attempt', () => {
    // The client's docblock argues that retrying never pushes time-to-first-byte
    // past what a single attempt was already allowed. That argument is only as
    // good as the four numbers behind it, so it is arithmetic here rather than
    // prose there — change any of them and this is what says so.
    const worstCase =
      SNAPSHOT_TIMING.retryIfAnsweredWithinMs +
      SNAPSHOT_TIMING.retryDelayMs +
      SNAPSHOT_TIMING.retryTimeoutMs

    expect(worstCase).toBeLessThanOrEqual(SNAPSHOT_TIMING.requestTimeoutMs)
    // And the retry's budget must be the shorter of the two, or the sum above
    // could only hold by shrinking the first attempt — a different trade.
    expect(SNAPSHOT_TIMING.retryTimeoutMs).toBeLessThan(SNAPSHOT_TIMING.requestTimeoutMs)
  })

  test('the retry re-sends the same method — a HEAD probe stays a HEAD', async () => {
    const { fn, calls } = makeSequencedFetchStub([502, 405])
    global.fetch = fn

    await probeSnapshotService()

    expect(calls.map(([, init]) => init?.method)).toEqual(['HEAD', 'HEAD'])
  })

  test('deleteSnapshot retries — revoke is idempotent, and a false failure is the costly one', async () => {
    const { fn, calls } = makeSequencedFetchStub([502, 200])
    global.fetch = fn

    await deleteSnapshot('SZPPXCM3')

    expect(calls.map(([, init]) => init?.method)).toEqual(['DELETE', 'DELETE'])
  })

  test('retrieveSnapshot gives up after the second attempt also fails', async () => {
    const { fn, calls } = makeSequencedFetchStub([502, 502])
    global.fetch = fn

    // The error still names the real status, so Sentry keeps grouping it as a
    // 502 rather than as some synthesised "retries exhausted".
    await expect(retrieveSnapshot('SZPPXCM3')).rejects.toThrow('retrieve failed: 502')
    expect(calls.length).toBe(2)
  })

  test('a 404 is not retried — it is an answer, not an outage', async () => {
    const { fn, calls } = makeSequencedFetchStub([404, 200])
    global.fetch = fn

    await expect(retrieveSnapshot('SZPPXCM3')).rejects.toThrow(SnapshotNotFoundError)
    expect(calls.length).toBe(1)
    expect(retryDelay.pauses).toEqual([])
  })

  test('a 503 is not retried — the handler chose it about the Blobs store', async () => {
    // `snapshot-retrieve.ts` answers 503 when `storage.get` throws. That is a
    // considered answer about a dependency, so asking the same store again
    // 400ms later buys nothing; only platform-level 502/504 are transient.
    const { fn, calls } = makeSequencedFetchStub([503, 200])
    global.fetch = fn

    await expect(retrieveSnapshot('SZPPXCM3')).rejects.toThrow('retrieve failed: 503')
    expect(calls.length).toBe(1)
    expect(retryDelay.pauses).toEqual([])
  })

  test('probeSnapshotService reports available when the retry succeeds', async () => {
    const { fn, calls } = makeSequencedFetchStub([502, 405])
    global.fetch = fn

    // Without the retry this returned false, which both hid the share
    // affordance and reported `snapshot service unavailable` to Sentry.
    expect(await probeSnapshotService()).toBe(true)
    expect(calls.length).toBe(2)
  })

  test('publishSnapshot is never retried — a POST mints a new id per call', async () => {
    const { fn, calls } = makeSequencedFetchStub([502, 200], { id: 'x', url: '/s/x' })
    global.fetch = fn

    await expect(publishSnapshot({ data: 'x' })).rejects.toThrow('publish failed: 502')
    expect(calls.length).toBe(1)
  })

  test('a SLOW 502 is not retried — the function ran and blew its execution limit', async () => {
    // Netlify emits 502 both when it declines to start a function (fast, worth
    // one more try) and when a running function exceeds its limit (slow, and
    // asking again only makes a person wait for the same answer twice). The
    // clock is what tells them apart, so it is driven rather than waited on.
    const start = Date.now()
    setSystemTime(new Date(start))
    const calls: string[] = []
    global.fetch = asFetch(async (url) => {
      calls.push(String(url))
      setSystemTime(new Date(start + 8_000))
      return Response.json(null, { status: 502 })
    })

    try {
      await expect(retrieveSnapshot('SZPPXCM3')).rejects.toThrow('retrieve failed: 502')
      expect(calls.length).toBe(1)
      expect(retryDelay.pauses).toEqual([])
    } finally {
      setSystemTime()
    }
  })
})
