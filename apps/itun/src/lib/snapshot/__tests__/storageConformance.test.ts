import { describe, expect, it } from 'bun:test'
import type { R2BucketLike, SnapshotStorage } from '../storage'
import { createR2Storage, InMemoryStorage } from '../storage'

/**
 * One contract, every implementation (ADR-033 §3).
 *
 * `SnapshotStorage` has three methods and, as of the Cloudflare cutover, three
 * implementations: `InMemoryStorage` (tests), Netlify Blobs (production today)
 * and R2 (production after the flip). The handler suite in
 * `netlify/functions/__tests__/snapshot.test.ts` runs entirely against
 * `InMemoryStorage`, which is only sound if the implementations genuinely agree
 * — otherwise the handlers are verified against a stand-in that behaves
 * differently from the thing actually deployed.
 *
 * So the contract is asserted once, here, and every implementation is driven
 * through it. A new backend adds a row to the table below and nothing else.
 *
 * ## What this cannot cover, and what covers it instead
 *
 * The R2 rows run against an in-process fake, so this proves *semantics* — what
 * `onlyIfNew` means, what a missing key returns — and not the platform's
 * consistency model. The consistency claim is the reason ADR-033 chose R2 over
 * KV, and it was measured directly against a real bucket instead:
 * **20/20 publish → immediate-read round trips returned the written bytes with
 * no delay.** A fake cannot demonstrate that, and pretending otherwise would be
 * the more dangerous kind of green test.
 */

/**
 * An in-process stand-in for an R2 bucket binding.
 *
 * Models the two behaviours the storage layer depends on: `get` resolves to
 * null for an absent key rather than throwing, and `put` overwrites. Bodies are
 * kept as the serialised strings R2 would store, so a payload that does not
 * survive `JSON.stringify` → `json()` fails here rather than in production.
 */
function fakeR2Bucket(): R2BucketLike & { size(): number } {
  const objects = new Map<string, string>()
  return {
    async get(key: string) {
      const body = objects.get(key)
      if (body === undefined) return null
      return { json: async <T>(): Promise<T> => JSON.parse(body) as T }
    },
    async put(key: string, value: string) {
      objects.set(key, value)
      return undefined
    },
    async delete(key: string) {
      objects.delete(key)
    },
    size: () => objects.size,
  }
}

const implementations: Array<{ name: string; make: () => SnapshotStorage }> = [
  { name: 'InMemoryStorage', make: () => new InMemoryStorage() },
  { name: 'createR2Storage', make: () => createR2Storage(fakeR2Bucket()) },
]

for (const { name, make } of implementations) {
  describe(`SnapshotStorage contract — ${name}`, () => {
    it('returns null for a key that was never written', async () => {
      const storage = make()
      expect(await storage.get('MISSING1')).toBeNull()
    })

    it('round-trips an object payload', async () => {
      const storage = make()
      const payload = { kind: 'pilot', name: 'Mule', nested: { hp: 10, tags: ['a', 'b'] } }

      const result = await storage.put('ABCD1234', payload)
      expect(result.modified).toBe(true)
      expect(await storage.get('ABCD1234')).toEqual(payload)
    })

    it('overwrites by default', async () => {
      const storage = make()
      await storage.put('ABCD1234', { v: 1 })
      const second = await storage.put('ABCD1234', { v: 2 })

      expect(second.modified).toBe(true)
      expect(await storage.get('ABCD1234')).toEqual({ v: 2 })
    })

    it('onlyIfNew refuses to overwrite, and reports modified: false', async () => {
      // The publish handler treats `modified: false` as an id collision and
      // tells the caller to retry. An implementation that silently overwrote
      // would destroy someone else's snapshot under a colliding id.
      const storage = make()
      await storage.put('ABCD1234', { v: 1 })
      const second = await storage.put('ABCD1234', { v: 2 }, { onlyIfNew: true })

      expect(second.modified).toBe(false)
      expect(await storage.get('ABCD1234')).toEqual({ v: 1 })
    })

    it('onlyIfNew writes when the key is absent', async () => {
      const storage = make()
      const result = await storage.put('FRESH123', { v: 1 }, { onlyIfNew: true })

      expect(result.modified).toBe(true)
      expect(await storage.get('FRESH123')).toEqual({ v: 1 })
    })

    it('delete removes a stored snapshot', async () => {
      const storage = make()
      await storage.put('ABCD1234', { v: 1 })
      await storage.delete('ABCD1234')

      expect(await storage.get('ABCD1234')).toBeNull()
    })

    it('delete is idempotent — removing a missing id is not an error', async () => {
      // The delete endpoint is a revoke: a caller pressing it twice, or racing
      // themselves, must not see a failure.
      const storage = make()
      await storage.delete('NEVERSET')
      await storage.delete('NEVERSET')

      expect(await storage.get('NEVERSET')).toBeNull()
    })

    it('keeps distinct ids independent', async () => {
      const storage = make()
      await storage.put('AAAAAAAA', { which: 'a' })
      await storage.put('BBBBBBBB', { which: 'b' })

      expect(await storage.get('AAAAAAAA')).toEqual({ which: 'a' })
      expect(await storage.get('BBBBBBBB')).toEqual({ which: 'b' })
    })

    it('survives a payload with unicode and nested arrays', async () => {
      // Snapshots carry user-entered names. A backend that mangles non-ASCII on
      // the way through would corrupt them silently rather than failing.
      const storage = make()
      const payload = { name: 'Crawler “Bänshee” — 🜁', log: [[1, 2], ['x']] }
      await storage.put('UNICODE1', payload)

      expect(await storage.get('UNICODE1')).toEqual(payload)
    })
  })
}
