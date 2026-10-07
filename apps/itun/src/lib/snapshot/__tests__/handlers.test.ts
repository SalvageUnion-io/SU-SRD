/**
 * `makeIdentityHandler` — the one snapshot handler left (ADR-036).
 *
 * It answers which entity a snapshot was taken of, and nothing else: the frozen
 * build in the stored blob must never come back out, because serving it is
 * exactly what was retired.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { makeIdentityHandler } from '../handlers'
import { setSnapshotReporter } from '../report'
import type { SnapshotStorage } from '../storage'

function storageWith(objects: Record<string, unknown>): SnapshotStorage {
  return { get: async (id) => objects[id] ?? null }
}

const unreachable: SnapshotStorage = {
  get: () => Promise.reject(new Error('R2 unavailable')),
}

const get = (id: string, init?: RequestInit) =>
  new Request(`https://example.test/api/snapshots/${id}`, init)

afterEach(() => {
  setSnapshotReporter(() => undefined)
})

describe('makeIdentityHandler', () => {
  it('answers { kind, appId } for a stored snapshot — and nothing else from it', async () => {
    const entity = pilotFixture({ id: 'p-identity', name: 'Rusty' })
    const handler = makeIdentityHandler(storageWith({ ABCD1234: { kind: 'pilot', entity } }))

    const res = await handler(get('ABCD1234'))

    expect(res.status).toBe(200)
    // Exact equality is the assertion: the frozen build stays in the bucket.
    expect(await res.json()).toEqual({ kind: 'pilot', appId: 'p-identity' })
  })

  it('404s an id with no stored snapshot', async () => {
    const res = await makeIdentityHandler(storageWith({}))(get('ZZZZZZZZ'))
    expect(res.status).toBe(404)
  })

  it('404s a stored snapshot that names no entity', async () => {
    // A blob with no entity id cannot be resolved to a sheet, so there is
    // nothing different to tell the caller from "never existed".
    const handler = makeIdentityHandler(
      storageWith({ ABCD1234: { kind: 'pilot', entity: { name: 'No id' } } })
    )
    expect((await handler(get('ABCD1234'))).status).toBe(404)
  })

  it('400s a malformed id without touching storage', async () => {
    const res = await makeIdentityHandler(unreachable)(get('not-a-valid-id'))
    expect(res.status).toBe(400)
  })

  for (const method of ['DELETE', 'POST', 'PUT', 'PATCH']) {
    it(`${method} is 405 — nothing writes to the store any more`, async () => {
      const res = await makeIdentityHandler(storageWith({}))(get('ABCD1234', { method }))
      expect(res.status).toBe(405)
      expect(res.headers.get('allow')).toBe('GET')
    })
  }

  it('answers 503 and reports a storage fault', async () => {
    const reports: Array<{ error: unknown; context?: Record<string, unknown> }> = []
    setSnapshotReporter((error, context) => {
      reports.push({ error, context })
    })

    const res = await makeIdentityHandler(unreachable)(get('ABCD1234'))

    expect(res.status).toBe(503)
    expect(reports).toHaveLength(1)
    expect(String(reports[0]?.error)).toContain('R2 unavailable')
    expect(reports[0]?.context).toEqual({
      fn: 'snapshot-identity',
      op: 'storage.get',
      id: 'ABCD1234',
    })
  })
})
