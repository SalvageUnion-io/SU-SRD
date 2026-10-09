/**
 * The server row version this browser last saw, per entity id.
 *
 * A version is the row's `updatedAt` on the server (or, for the tray and the
 * pattern library, which have no such column, the body's own stamp — see
 * `rowVersion` in `lib/links/linkSync.ts`). Two readers need it:
 *
 *  - **`ShelfSync`** adopts a served row only when it is newer than the version
 *    recorded here, so a body edited on another device reaches this cache even
 *    though no id changed, and an emission older than a write this tab already
 *    made is not adopted over it.
 *  - **`commitEntityWrite`** sends it with a pilot or mech write as the version
 *    the edit was made against, and the server refuses the write when its row
 *    has moved on (`entities.upsertByAppId`). A whole-body write from a stale
 *    copy would otherwise undo the other device's edit without anyone seeing.
 *
 * Module state rather than a store: nothing renders from it. It is one
 * account's, so it is forgotten with the cache (`lib/account/cacheOwner.ts`).
 */

const versions = new Map<string, number>()

/** Every recorded version, for a sync plan to compare against. */
export function serverVersions(): ReadonlyMap<string, number> {
  return versions
}

/** The version this browser last saw for `id`, or `undefined` when none. */
export function knownVersion(id: string): number | undefined {
  return versions.get(id)
}

/** Record a version, never moving one backwards. */
export function noteVersion(id: string, updatedAt: number): void {
  const known = versions.get(id)
  if (known === undefined || updatedAt > known) versions.set(id, updatedAt)
}

/** Forget every version: the cache they describe is gone. */
export function forgetVersions(): void {
  versions.clear()
}
