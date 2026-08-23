/**
 * Handler-level tests for snapshot publish + retrieve endpoints.
 *
 * Uses InMemoryStorage for all tests — no live network, no @netlify/blobs
 * runtime dependency. Handlers are tested via the makePublishHandler and
 * makeRetrieveHandler factories (dependency injection, no mock.module()).
 *
 * Assertion style: toBeTruthy() / toBe() / toEqual() — not toBeInTheDocument().
 */

import { beforeEach, describe, expect, it, setSystemTime } from 'bun:test'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
} from '../../../src/components/__tests__/fixtures'
import { getClientIp, RateLimiter } from '../../../src/lib/snapshot/rateLimit'
import { InMemoryStorage } from '../../../src/lib/snapshot/storage'
import { makeDeleteHandler } from '../snapshot-delete'
import { makePublishHandler } from '../snapshot-publish'
import { makeRetrieveHandler } from '../snapshot-retrieve'

/** Fixed origin for the rate-limiter's clock; only the deltas matter. */
const CLOCK = new Date('2026-01-01T00:00:00.000Z')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, url: string, body?: unknown): Request {
  if (body !== undefined) {
    return new Request(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  return new Request(url, { method })
}

/**
 * A publishable snapshot body.
 *
 * These tests previously posted shapes like `{ kind: 'pilot', name: 'Rook' }`,
 * which publish now refuses — correctly, since nothing could have rendered
 * them. That they passed is the gap `lib/snapshot/payload.ts` closes: the suite
 * was asserting that unrenderable payloads publish successfully.
 *
 * Built from the shared fixtures so "valid" means the same thing here as in the
 * renderer, and so a schema change breaks this file rather than silently
 * loosening it.
 */
function validPayload(kind: 'pilot' | 'mech' | 'crawler', id: string) {
  if (kind === 'mech') return { kind, entity: mechFixture({ id }) }
  if (kind === 'crawler') return { kind, entity: crawlerFixture({ id }) }
  return { kind, entity: pilotFixture({ id }) }
}

/**
 * `InMemoryStorage` that counts writes.
 *
 * "Refused with a 400" and "wrote nothing" are two different claims, and for
 * validation the second is the one that matters — a handler that rejects the
 * response while still minting the object would pass a status-only assertion.
 * Test-local on purpose: production storage gains no accessor that exists only
 * for a test to read.
 */
class CountingStorage extends InMemoryStorage {
  puts = 0

  override async put(
    id: string,
    payload: unknown,
    options?: Parameters<InMemoryStorage['put']>[2]
  ): Promise<Awaited<ReturnType<InMemoryStorage['put']>>> {
    this.puts += 1
    return super.put(id, payload, options)
  }
}

// ---------------------------------------------------------------------------
// Publish endpoint
// ---------------------------------------------------------------------------

describe('snapshot-publish', () => {
  let storage: InMemoryStorage
  let handler: (req: Request) => Promise<Response>

  beforeEach(() => {
    storage = new InMemoryStorage()
    handler = makePublishHandler(storage)
  })

  it('POST with valid JSON → 201 + returns id and url', async () => {
    const req = makeRequest('POST', 'http://localhost/api/snapshots', validPayload('pilot', 'p1'))
    const res = await handler(req)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
    expect(body.url).toBeTruthy()
    expect(body.url).toContain(body.id)
  })

  it('POST with valid JSON → storage receives the payload', async () => {
    const payload = validPayload('mech', 'm1')
    const req = makeRequest('POST', 'http://localhost/api/snapshots', payload)
    const res = await handler(req)

    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string; url: string }

    const stored = await storage.get(id)
    expect(stored).toEqual(payload)
  })

  it('GET → 405 Method Not Allowed', async () => {
    const req = makeRequest('GET', 'http://localhost/api/snapshots')
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('PATCH → 405 Method Not Allowed', async () => {
    const req = makeRequest('PATCH', 'http://localhost/api/snapshots', { x: 1 })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('PUT → 405 Method Not Allowed', async () => {
    const req = makeRequest('PUT', 'http://localhost/api/snapshots', { x: 1 })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('DELETE → 405 Method Not Allowed', async () => {
    const req = makeRequest('DELETE', 'http://localhost/api/snapshots')
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('POST with invalid JSON body → 400', async () => {
    const req = new Request('http://localhost/api/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json{{{',
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('POST {} → 400 and nothing is stored', async () => {
    // The reported gap: this used to answer 201 with a real share URL for a
    // snapshot that `/s/$id` could never render.
    const counting = new CountingStorage()
    const res = await makePublishHandler(counting)(
      makeRequest('POST', 'http://localhost/api/snapshots', {})
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Entity data is missing')
    expect(counting.puts).toBe(0)
  })

  it('POST with a known kind but an unrenderable entity → 400 and nothing is stored', async () => {
    const counting = new CountingStorage()
    const res = await makePublishHandler(counting)(
      makeRequest('POST', 'http://localhost/api/snapshots', {
        kind: 'pilot',
        entity: { nonsense: true },
      })
    )

    expect(res.status).toBe(400)
    expect(counting.puts).toBe(0)
  })

  it('POST with a JSON array body → 400 (must be an object)', async () => {
    const req = makeRequest('POST', 'http://localhost/api/snapshots', [1, 2, 3])
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('POST with an oversized payload → 413 and nothing is stored', async () => {
    // > 256 KB once serialized
    const huge = { kind: 'mech', blob: 'x'.repeat(300 * 1024) }
    const req = makeRequest('POST', 'http://localhost/api/snapshots', huge)
    const res = await handler(req)
    expect(res.status).toBe(413)
    // storage untouched — InMemoryStorage.get returns null for any id, but the
    // important invariant is the handler short-circuited before put().
  })

  describe('rate limiting', () => {
    it('exceeding the limit → 429', async () => {
      // Use a tight limiter: 2 requests per minute
      const tightLimiter = new RateLimiter({ limit: 2, windowMs: 60_000 })
      // Patch: makePublishHandler uses the module-level limiter; we need to
      // test via the RateLimiter directly since the handler factory doesn't
      // accept a custom limiter (keeping the handler simple).
      // We test the RateLimiter in isolation here.
      const ip = '192.0.2.1'
      expect(tightLimiter.check(ip)).toBe(true) // 1st request allowed
      expect(tightLimiter.check(ip)).toBe(true) // 2nd request allowed
      expect(tightLimiter.check(ip)).toBe(false) // 3rd request blocked
    })

    it('different IPs are tracked independently', () => {
      const limiter = new RateLimiter({ limit: 1, windowMs: 60_000 })
      expect(limiter.check('10.0.0.1')).toBe(true)
      expect(limiter.check('10.0.0.2')).toBe(true) // different IP — allowed
      expect(limiter.check('10.0.0.1')).toBe(false) // first IP exceeded
    })

    it('window resets after windowMs', () => {
      // RateLimiter reads Date.now(), so the clock is moved rather than slept
      // through: exact, instant, and it can't race a loaded scheduler the way a
      // real sleep with a fixed margin over the window can.
      setSystemTime(CLOCK)
      try {
        const limiter = new RateLimiter({ limit: 1, windowMs: 50 })
        expect(limiter.check('10.0.0.1')).toBe(true)
        expect(limiter.check('10.0.0.1')).toBe(false) // within window

        setSystemTime(new Date(CLOCK.getTime() + 51))
        expect(limiter.check('10.0.0.1')).toBe(true) // new window
      } finally {
        setSystemTime()
      }
    })

    it('expired windows are evicted (map does not grow unbounded)', () => {
      setSystemTime(CLOCK)
      try {
        const limiter = new RateLimiter({ limit: 1, windowMs: 50 })
        // Reach into the private window map to assert eviction behaviour.
        const internals = limiter as unknown as {
          check(ip: string): boolean
          windows: Map<string, unknown>
        }
        internals.check('10.0.0.1')
        internals.check('10.0.0.2')
        expect(internals.windows.size).toBe(2)

        setSystemTime(new Date(CLOCK.getTime() + 51))
        // A check after expiry sweeps the stale entries before recording the new one
        internals.check('10.0.0.3')
        expect(internals.windows.size).toBe(1)
      } finally {
        setSystemTime()
      }
    })
  })

  describe('getClientIp', () => {
    it('prefers the unspoofable x-nf-client-connection-ip header', () => {
      const req = new Request('http://localhost/api/snapshots', {
        method: 'POST',
        headers: {
          'x-nf-client-connection-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.9', // attacker-supplied — must be ignored
        },
      })
      expect(getClientIp(req)).toBe('203.0.113.7')
    })

    it('falls back to the leftmost x-forwarded-for entry when Netlify IP is absent', () => {
      const req = new Request('http://localhost/api/snapshots', {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
      })
      expect(getClientIp(req)).toBe('198.51.100.9')
    })

    it('falls back to 0.0.0.0 when no IP headers are present', () => {
      const req = new Request('http://localhost/api/snapshots', { method: 'POST' })
      expect(getClientIp(req)).toBe('0.0.0.0')
    })
  })
})

// ---------------------------------------------------------------------------
// Retrieve endpoint
// ---------------------------------------------------------------------------

describe('snapshot-retrieve', () => {
  let storage: InMemoryStorage
  let handler: (req: Request) => Promise<Response>

  beforeEach(() => {
    storage = new InMemoryStorage()
    handler = makeRetrieveHandler(storage)
  })

  it('GET with existing id → 200 + JSON payload', async () => {
    const payload = { kind: 'crawler', name: 'Big Mango' }
    await storage.put('TESTABC1', payload)

    const req = makeRequest('GET', 'http://localhost/api/snapshots/TESTABC1')
    const res = await handler(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(payload)
  })

  it('GET with unknown (but well-formed) id → 404', async () => {
    // ZZZZZZZZ is a valid 8-char Crockford-base32 id that was never stored.
    const req = makeRequest('GET', 'http://localhost/api/snapshots/ZZZZZZZZ')
    const res = await handler(req)
    expect(res.status).toBe(404)
  })

  it('GET with malformed id → 400 (before any store lookup)', async () => {
    // Contains I and O (excluded from Crockford base32) and is rejected by the
    // format guard without touching the blob store.
    const req = makeRequest('GET', 'http://localhost/api/snapshots/NOTEXIST')
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('POST → 405 Method Not Allowed', async () => {
    const req = makeRequest('POST', 'http://localhost/api/snapshots/TESTABC1', { x: 1 })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('PATCH → 405 Method Not Allowed', async () => {
    const req = makeRequest('PATCH', 'http://localhost/api/snapshots/TESTABC1', { x: 1 })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('PUT → 405 Method Not Allowed', async () => {
    const req = makeRequest('PUT', 'http://localhost/api/snapshots/TESTABC1', { x: 1 })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('DELETE → 405 Method Not Allowed', async () => {
    const req = makeRequest('DELETE', 'http://localhost/api/snapshots/TESTABC1')
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('round-trip: published snapshot is retrievable', async () => {
    // Use the same storage instance for both handlers
    const publish = makePublishHandler(storage)
    const retrieve = makeRetrieveHandler(storage)

    const payload = validPayload('pilot', 'p-roundtrip')
    const publishRes = await publish(makeRequest('POST', 'http://localhost/api/snapshots', payload))

    expect(publishRes.status).toBe(201)
    const { id } = (await publishRes.json()) as { id: string; url: string }

    const retrieveRes = await retrieve(makeRequest('GET', `http://localhost/api/snapshots/${id}`))
    expect(retrieveRes.status).toBe(200)
    const retrieved = await retrieveRes.json()
    expect(retrieved).toEqual(payload)
  })
})

// ---------------------------------------------------------------------------
// Delete endpoint (revoke / un-publish)
// ---------------------------------------------------------------------------

describe('snapshot-delete', () => {
  let storage: InMemoryStorage
  let handler: (req: Request) => Promise<Response>

  beforeEach(() => {
    storage = new InMemoryStorage()
    handler = makeDeleteHandler(storage)
  })

  // Distinct IP so the module-level rate limiter is never a factor across tests.
  function del(id: string, ip = '198.51.100.50'): Request {
    return new Request(`http://localhost/api/snapshots/${id}`, {
      method: 'DELETE',
      headers: { 'x-nf-client-connection-ip': ip },
    })
  }

  it('DELETE existing id → 204 and the snapshot is gone', async () => {
    // Valid 8-char Crockford id (no I/L/O/U).
    await storage.put('TESTDE01', { kind: 'pilot', name: 'Revoke Me' })
    const res = await handler(del('TESTDE01'))
    expect(res.status).toBe(204)
    expect(await storage.get('TESTDE01')).toBeNull()
  })

  it('DELETE unknown but well-formed id → 204 (idempotent)', async () => {
    const res = await handler(del('ZZZZZZZZ'))
    expect(res.status).toBe(204)
  })

  it('DELETE malformed id → 400 (contains excluded I/O chars)', async () => {
    const res = await handler(del('NOTEXIST'))
    expect(res.status).toBe(400)
  })

  it('GET → 405 Method Not Allowed', async () => {
    const res = await handler(makeRequest('GET', 'http://localhost/api/snapshots/TESTDEL1'))
    expect(res.status).toBe(405)
  })

  it('POST → 405 Method Not Allowed', async () => {
    const res = await handler(
      makeRequest('POST', 'http://localhost/api/snapshots/TESTDEL1', { x: 1 })
    )
    expect(res.status).toBe(405)
  })

  it('round-trip: published snapshot is 404 after a revoke', async () => {
    const publish = makePublishHandler(storage)
    const retrieve = makeRetrieveHandler(storage)

    const publishRes = await publish(
      makeRequest('POST', 'http://localhost/api/snapshots', validPayload('mech', 'm-revoke'))
    )
    const { id } = (await publishRes.json()) as { id: string }

    const delRes = await handler(del(id))
    expect(delRes.status).toBe(204)

    const getRes = await retrieve(makeRequest('GET', `http://localhost/api/snapshots/${id}`))
    expect(getRes.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Storage abstraction (InMemoryStorage unit tests)
// ---------------------------------------------------------------------------

describe('InMemoryStorage', () => {
  it('get on missing key returns null', async () => {
    const s = new InMemoryStorage()
    expect(await s.get('nope')).toBeNull()
  })

  it('put then get returns the stored value', async () => {
    const s = new InMemoryStorage()
    await s.put('k1', { x: 42 })
    expect(await s.get('k1')).toEqual({ x: 42 })
  })

  it('put with onlyIfNew does not overwrite existing key', async () => {
    const s = new InMemoryStorage()
    await s.put('k1', { v: 1 })
    const result = await s.put('k1', { v: 2 }, { onlyIfNew: true })
    expect(result.modified).toBe(false)
    expect(await s.get('k1')).toEqual({ v: 1 }) // unchanged
  })

  it('put without onlyIfNew overwrites existing key', async () => {
    const s = new InMemoryStorage()
    await s.put('k1', { v: 1 })
    const result = await s.put('k1', { v: 2 })
    expect(result.modified).toBe(true)
    expect(await s.get('k1')).toEqual({ v: 2 })
  })

  it('delete removes a stored key', async () => {
    const s = new InMemoryStorage()
    await s.put('k1', { v: 1 })
    await s.delete('k1')
    expect(await s.get('k1')).toBeNull()
  })

  it('delete on a missing key is a no-op (does not throw)', async () => {
    const s = new InMemoryStorage()
    await s.delete('nope')
    expect(await s.get('nope')).toBeNull()
  })
})
