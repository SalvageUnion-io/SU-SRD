/**
 * The Netlify Blobs `SnapshotStorage` implementation.
 *
 * ## Why this is a separate module
 *
 * It used to live in `storage.ts` beside the in-memory and R2 implementations,
 * with its `@netlify/blobs` import written as a dynamic `await import(...)` so
 * that tests never loaded it. That is enough for Bun at runtime and **not**
 * enough for a bundler: esbuild follows dynamic imports too, so the Cloudflare
 * Worker — which imports `createR2Storage` from the same file — pulled in
 * `@netlify/blobs`, which imports `node:process`, and the build failed.
 *
 * The lesson generalises and is worth stating once: **a dynamic import does not
 * keep a dependency out of a bundle.** Only a module boundary does. The same
 * mistake in a different disguise cost this migration two builds — once here,
 * once when the shared snapshot handlers still lived next to `@sentry/node`.
 *
 * So the platform-specific implementation lives with the platform. `storage.ts`
 * holds the contract and the two implementations every runtime can load.
 */

import type { PutOptions, PutResult, SnapshotStorage } from './storage'

/**
 * Returns a SnapshotStorage backed by Netlify Blobs.
 *
 * Requires NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN at runtime (injected
 * automatically inside a Netlify Function; must use `netlify dev` locally).
 *
 * The import stays dynamic so that merely importing this module does not
 * require the Blobs runtime context — that part of the original reasoning was
 * sound, it just could not also solve the bundling problem.
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
