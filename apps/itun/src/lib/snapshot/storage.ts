/**
 * SnapshotStorage — read-only access to the retired snapshot store.
 *
 * Snapshots are no longer minted or revoked (ADR-036), so the store is only ever
 * read: the Worker looks a snapshot up to say which entity it was taken of.
 * **Nothing here writes or deletes**, and nothing should — the objects in R2
 * are kept untouched, by decision, and an old link's id is all it needs.
 *
 * One implementation, createR2Storage, held to its contract by
 * `__tests__/storageConformance.test.ts`. ADR-033 §3 covers why snapshots
 * live in R2.
 */

export type SnapshotStorage = {
  /** The stored snapshot, or null when no object has this id. */
  get(id: string): Promise<unknown | null>
}

/**
 * The slice of an R2 bucket binding this module uses.
 *
 * Declared structurally rather than importing `@cloudflare/workers-types`,
 * which would put a second definition of `fetch`/`Request`/`Response` into an
 * app that is otherwise typechecked for the browser. Same reason as the
 * `AssetBucket` seam in `apps/su-assets`. Read-only on purpose: a binding that
 * cannot be asked to write cannot be made to by a later edit to this file.
 */
export type R2BucketLike = {
  get(key: string): Promise<{ json<T>(): Promise<T> } | null>
}

/** Returns a SnapshotStorage backed by an R2 bucket binding. */
export function createR2Storage(bucket: R2BucketLike): SnapshotStorage {
  return {
    async get(id: string): Promise<unknown | null> {
      const object = await bucket.get(id)
      if (!object) return null
      return (await object.json<unknown>()) ?? null
    },
  }
}
