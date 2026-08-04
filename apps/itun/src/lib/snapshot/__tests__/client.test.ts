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

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { PublishResult, SnapshotPayload } from '../client'
import {
  deleteSnapshot,
  probeSnapshotService,
  publishSnapshot,
  retrieveSnapshot,
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
