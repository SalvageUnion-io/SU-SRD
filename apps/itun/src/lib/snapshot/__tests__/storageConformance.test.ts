import { describe, expect, it } from 'bun:test'
import type { R2BucketLike, SnapshotStorage } from '../storage'
import { createR2Storage } from '../storage'

/**
 * One contract, every implementation (ADR-033 §3).
 *
 * The store is read-only now (ADR-036): snapshots are no longer minted or
 * revoked, and the objects already in R2 are kept untouched. So the contract
 * is the read half alone — what a missing key returns, and that a stored body
 * comes back as the JSON it was written as.
 *
 * The R2 row runs against an in-process fake, so this proves *semantics*, not
 * the platform. Bodies are kept as the serialised strings R2 holds, so a value
 * that does not survive `JSON.stringify` → `json()` fails here rather than in
 * production.
 */

function fakeR2Bucket(objects: Record<string, unknown>): R2BucketLike {
  const stored = new Map(Object.entries(objects).map(([k, v]) => [k, JSON.stringify(v)]))
  return {
    async get(key: string) {
      const body = stored.get(key)
      if (body === undefined) return null
      return { json: async <T>(): Promise<T> => JSON.parse(body) as T }
    },
  }
}

const implementations: Array<{
  name: string
  make: (objects: Record<string, unknown>) => SnapshotStorage
}> = [{ name: 'createR2Storage', make: (objects) => createR2Storage(fakeR2Bucket(objects)) }]

for (const { name, make } of implementations) {
  describe(`SnapshotStorage contract — ${name}`, () => {
    it('returns null for a key that was never written', async () => {
      expect(await make({}).get('MISSING1')).toBeNull()
    })

    it('returns a stored snapshot as the object it was written as', async () => {
      const snapshot = { kind: 'pilot', entity: { id: 'p-1', name: 'Mule' } }
      expect(await make({ ABCD1234: snapshot }).get('ABCD1234')).toEqual(snapshot)
    })

    it('survives a body with unicode and nested arrays', async () => {
      // Snapshots carry user-entered names. A backend that mangled non-ASCII on
      // the way through would corrupt them silently rather than failing.
      const snapshot = { name: 'Crawler “Bänshee” — 🜁', log: [[1, 2], ['x']] }
      expect(await make({ UNICODE1: snapshot }).get('UNICODE1')).toEqual(snapshot)
    })
  })
}
