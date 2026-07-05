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
