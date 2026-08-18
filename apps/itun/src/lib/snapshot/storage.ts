/**
 * SnapshotStorage — thin abstraction over the blob store.
 *
 * Production: NetlifyBlobsStorage (uses @netlify/blobs getStore()).
 * Tests: InMemoryStorage (a Map-backed stub — no mock.module() needed).
 *
 * See ADR-004-snapshot-netlify-functions.md for rationale.
 */

export type PutOptions = {
  /** When true, the write only succeeds if the key does not already exist. */
  onlyIfNew?: boolean
}

export type PutResult = {
  /** False if the key already existed and onlyIfNew was true. */
  modified: boolean
}

export type SnapshotStorage = {
  get(id: string): Promise<unknown | null>
  put(id: string, payload: unknown, options?: PutOptions): Promise<PutResult>
  /** Removes a snapshot by id. Idempotent — deleting a missing id is a no-op. */
  delete(id: string): Promise<void>
}

// ---------------------------------------------------------------------------
// In-memory implementation (test / local-dev stub)
// ---------------------------------------------------------------------------

export class InMemoryStorage implements SnapshotStorage {
  private readonly store = new Map<string, unknown>()

  async get(id: string): Promise<unknown | null> {
    return this.store.has(id) ? (this.store.get(id) ?? null) : null
  }

  async put(id: string, payload: unknown, options?: PutOptions): Promise<PutResult> {
    if (options?.onlyIfNew && this.store.has(id)) {
      return { modified: false }
    }
    this.store.set(id, payload)
    return { modified: true }
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id)
  }
}

// ---------------------------------------------------------------------------
// Netlify Blobs production implementation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cloudflare R2 implementation (ADR-033)
// ---------------------------------------------------------------------------

/**
 * The slice of an R2 bucket binding this module uses.
 *
 * Declared structurally rather than importing `@cloudflare/workers-types`,
 * which would put a second definition of `fetch`/`Request`/`Response` into an
 * app that is otherwise typechecked for the browser. Same reason, and the same
 * three-method shape, as the `AssetBlobStore` seam in `apps/su-assets`.
 */
export type R2BucketLike = {
  get(key: string): Promise<{ json<T>(): Promise<T> } | null>
  put(key: string, value: string): Promise<unknown>
  delete(key: string): Promise<void>
}

/**
 * Returns a SnapshotStorage backed by an R2 bucket binding.
 *
 * ## Why R2 and not KV (ADR-033 §3)
 *
 * KV looks like the right shape — payloads cap at 256 KB against a 25 MB value
 * limit, and access is by short id. The disqualifying property is consistency,
 * not shape. Cloudflare documents that KV writes take **up to 60 seconds** to
 * propagate globally and that **negative lookups are cached**; the publish flow
 * reads a key twice before creating it (once in `generateUniqueId`, once in the
 * `onlyIfNew` check below), so it would prime a negative-cache entry for exactly
 * the key it is about to write — and the client then immediately requests that
 * key, because publish-then-share *is* the feature.
 *
 * `client.ts` makes the consequence concrete: its retry set is `{502, 504}` and
 * it excludes 404 deliberately, on the grounds that a store "has already said
 * no". True for Blobs and for R2; false for KV. Choosing KV would silently
 * invalidate that written invariant.
 *
 * Measured against a real bucket before this landed: **20/20 publish →
 * immediate-read round trips returned the written bytes with no delay.**
 *
 * ## `onlyIfNew` is a check-then-set, exactly as the Netlify implementation is
 *
 * Deliberately identical semantics, so the two implementations are
 * interchangeable and the conformance suite can hold them to one contract. The
 * race it leaves open is the same one the Netlify version documents, and it is
 * already guarded upstream: `generateUniqueId` only proposes ids that do not
 * exist, over a 40-bit space.
 *
 * R2 does support a genuinely atomic conditional put, which would close that
 * race outright. It is not used here because changing the contract and porting
 * the platform in one step would mean a difference in behaviour with two
 * possible causes. Worth doing as its own change.
 */
export function createR2Storage(bucket: R2BucketLike): SnapshotStorage {
  return {
    async get(id: string): Promise<unknown | null> {
      const object = await bucket.get(id)
      if (!object) return null
      return (await object.json<unknown>()) ?? null
    },

    async put(id: string, payload: unknown, options?: PutOptions): Promise<PutResult> {
      if (options?.onlyIfNew) {
        const existing = await bucket.get(id)
        if (existing !== null) {
          return { modified: false }
        }
      }
      await bucket.put(id, JSON.stringify(payload))
      return { modified: true }
    },

    async delete(id: string): Promise<void> {
      await bucket.delete(id)
    },
  }
}

/**
 * Returns a SnapshotStorage backed by Netlify Blobs.
 *
 * Requires NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN at runtime (injected
 * automatically inside a Netlify Function; must use `netlify dev` locally).
 *
 * Import is dynamic so that tests never import @netlify/blobs (avoiding the
 * environment-context requirement in non-Netlify runtimes).
 */
export async function createNetlifyBlobsStorage(): Promise<SnapshotStorage> {
  const { getStore } = await import('@netlify/blobs')
  const blobStore = getStore('snapshots')

  return {
    async get(id: string): Promise<unknown | null> {
      const result = await blobStore.get(id, { type: 'json' })
      return result ?? null
    },

    async put(id: string, payload: unknown, options?: PutOptions): Promise<PutResult> {
      const body = JSON.stringify(payload)
      if (options?.onlyIfNew) {
        const existing = await blobStore.get(id)
        if (existing !== null) {
          return { modified: false }
        }
      }
      await blobStore.set(id, body)
      return { modified: true }
    },

    async delete(id: string): Promise<void> {
      await blobStore.delete(id)
    },
  }
}
