/**
 * snapshot/client — `retrieveSnapshotIdentity`, the one call left (ADR-036).
 *
 * Stubs the global fetch rather than `mock.module()`: the function is a plain
 * async call, and what matters is how it reads each status the Worker can
 * answer, and how it retries the two that mean the platform failed.
 */

import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import { retrieveSnapshotIdentity, SNAPSHOT_TIMING } from '../client'

// ---------------------------------------------------------------------------
// Fetch stub helpers
// ---------------------------------------------------------------------------

/** Wraps a handler as `typeof fetch` — Bun's fetch also carries `preconnect`. */
function asFetch(
  impl: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): typeof fetch {
  return Object.assign(impl, { preconnect: globalThis.fetch.preconnect })
}

/** Answers every call with `body` at `status`, as a REAL `Response`. */
function makeFetchStub(status: number, body: unknown = null) {
  const calls: string[] = []
  const fn = asFetch(async (url) => {
    calls.push(String(url))
    return Response.json(body, { status })
  })
  return { fn, calls }
}

let originalFetch: typeof fetch

beforeEach(() => {
  originalFetch = global.fetch
})

afterEach(() => {
  global.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// The answers
// ---------------------------------------------------------------------------

describe('retrieveSnapshotIdentity', () => {
  test('returns the identity the Worker answers, from GET /api/snapshots/:id', async () => {
    const { fn, calls } = makeFetchStub(200, { kind: 'mech', appId: 'm-1' })
    global.fetch = fn

    expect(await retrieveSnapshotIdentity('ABCD1234')).toEqual({ kind: 'mech', appId: 'm-1' })
    expect(calls).toEqual(['/api/snapshots/ABCD1234'])
  })

  test('reads the full stored snapshot too — the old, year-cacheable answer', async () => {
    // This URL used to return the whole snapshot with `immutable`, so a browser
    // that opened the link before can still be handed that body from its cache.
    const { fn } = makeFetchStub(200, { kind: 'pilot', entity: { id: 'p-1', name: 'Zara' } })
    global.fetch = fn

    expect(await retrieveSnapshotIdentity('ABCD1234')).toEqual({ kind: 'pilot', appId: 'p-1' })
  })

  test('null on 404 — the link names no snapshot, which is a designed outcome', async () => {
    const { fn } = makeFetchStub(404)
    global.fetch = fn
    expect(await retrieveSnapshotIdentity('ABCD1234')).toBeNull()
  })

  test('null on 400, and null without asking for an id that cannot exist', async () => {
    const { fn, calls } = makeFetchStub(400)
    global.fetch = fn

    expect(await retrieveSnapshotIdentity('ABCD1234')).toBeNull()
    expect(await retrieveSnapshotIdentity('not-a-snapshot-id')).toBeNull()
    expect(calls).toEqual(['/api/snapshots/ABCD1234'])
  })

  test('null for a 200 that names no entity', async () => {
    const { fn } = makeFetchStub(200, { kind: 'dropship', appId: 'x' })
    global.fetch = fn
    expect(await retrieveSnapshotIdentity('ABCD1234')).toBeNull()
  })

  test('throws on any other non-OK status, naming it', async () => {
    const { fn } = makeFetchStub(503)
    global.fetch = fn
    await expect(retrieveSnapshotIdentity('ABCD1234')).rejects.toThrow('retrieve failed: 503')
  })
})

// ---------------------------------------------------------------------------
// Transient-platform retry (ITUN-7 / ITUN-8)
// ---------------------------------------------------------------------------

/**
 * A stub that answers each call with the next status in `statuses`, repeating
 * the last one once the list runs out. Lets a test assert on the *sequence* —
 * "a 502 then a 200" — which is the whole behaviour under test here.
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
 * dead wall clock on every run, buying no assertion. The client reaches both its
 * pause and its `AbortController` deadlines through the global `setTimeout`, so
 * stubbing that global is enough, with none of the fake-timer interleaving that
 * an in-flight promise makes fragile.
 *
 * Only the retry *pause* is collapsed; a request budget is passed through to the
 * real timer untouched. That is load-bearing — collapsing a request budget would
 * abort every request on the next tick and every test here would fail as a
 * timeout.
 *
 * Both buckets are recorded because both are asserted. The pauses catch a
 * regression that dropped the wait and hammered a cold start twice in one
 * millisecond; the budgets are the only thing that pins `retryTimeoutMs`, which
 * the client's docblock calls load-bearing to its ≤10s ceiling.
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

  test('survives a 502 and returns the retried answer', async () => {
    const identity = { kind: 'mech', appId: 'm-1' } as const
    const { fn, urls } = makeSequencedFetchStub([502, 200], identity)
    global.fetch = fn

    expect(await retrieveSnapshotIdentity('SZPPXCM3')).toEqual(identity)
    // Two attempts, both at the same URL — a retry, not a fallback endpoint.
    expect(urls()).toEqual(['/api/snapshots/SZPPXCM3', '/api/snapshots/SZPPXCM3'])
    // …separated by a real pause, not fired back-to-back at a cold start.
    expect(retryDelay.pauses).toEqual([SNAPSHOT_TIMING.retryDelayMs])
    // The retry runs on its own, shorter budget. `toContain`, not `toEqual`:
    // the stub sees every `setTimeout` in the process during this window.
    expect(retryDelay.budgets).toContain(SNAPSHOT_TIMING.requestTimeoutMs)
    expect(retryDelay.budgets).toContain(SNAPSHOT_TIMING.retryTimeoutMs)
  })

  test('the timings keep their invariant: a retry cannot outlast one attempt', () => {
    // The client's docblock argues that retrying never pushes time-to-first-byte
    // past what a single attempt was already allowed. That argument is only as
    // good as the four numbers behind it, so it is arithmetic here.
    const worstCase =
      SNAPSHOT_TIMING.retryIfAnsweredWithinMs +
      SNAPSHOT_TIMING.retryDelayMs +
      SNAPSHOT_TIMING.retryTimeoutMs

    expect(worstCase).toBeLessThanOrEqual(SNAPSHOT_TIMING.requestTimeoutMs)
    expect(SNAPSHOT_TIMING.retryTimeoutMs).toBeLessThan(SNAPSHOT_TIMING.requestTimeoutMs)
  })

  test('gives up after the second attempt also fails', async () => {
    const { fn, calls } = makeSequencedFetchStub([502, 502])
    global.fetch = fn

    // The error still names the real status, so Sentry keeps grouping it as a
    // 502 rather than as some synthesised "retries exhausted".
    await expect(retrieveSnapshotIdentity('SZPPXCM3')).rejects.toThrow('retrieve failed: 502')
    expect(calls.length).toBe(2)
  })

  test('a 404 is not retried — it is an answer, not an outage', async () => {
    const { fn, calls } = makeSequencedFetchStub([404, 200])
    global.fetch = fn

    expect(await retrieveSnapshotIdentity('SZPPXCM3')).toBeNull()
    expect(calls.length).toBe(1)
    expect(retryDelay.pauses).toEqual([])
  })

  test('a 503 is not retried — the handler chose it about the store', async () => {
    const { fn, calls } = makeSequencedFetchStub([503, 200])
    global.fetch = fn

    await expect(retrieveSnapshotIdentity('SZPPXCM3')).rejects.toThrow('retrieve failed: 503')
    expect(calls.length).toBe(1)
    expect(retryDelay.pauses).toEqual([])
  })

  test('a SLOW 502 is not retried — the handler ran and blew its execution limit', async () => {
    // A platform 502 comes both from failing to start the handler (fast, worth
    // one more try) and from a running handler exceeding its limit (slow, and
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
      await expect(retrieveSnapshotIdentity('SZPPXCM3')).rejects.toThrow('retrieve failed: 502')
      expect(calls.length).toBe(1)
      expect(retryDelay.pauses).toEqual([])
    } finally {
      setSystemTime()
    }
  })
})
