/**
 * The server row version this browser last saw, per entity id.
 *
 * A version is the row's `updatedAt` on the server (or, for the tray and the
 * pattern library, which have no such column, the body's own stamp — see
 * `rowVersion` in `lib/links/linkSync.ts`). Two readers need it:
 *
 *  - **`ShelfSync`** adopts a served row only when it is newer than the version
 *    recorded here, so a body edited on another device reaches this tab even
 *    though no id changed, and an emission older than a write this tab already
 *    made is not adopted over it.
 *  - **`commitOp`** sends the unit's `headSeq` beside it as the op's `baseSeq`,
 *    and the server refuses an op whose fields changed after it (ADR-063).
 *
 * Module state rather than a store: nothing renders from it. It is one
 * account's, so it is forgotten when the session ends (`sessionRows.ts`).
 */

const versions = new Map<string, number>()

/** Each unit's `headSeq` as this browser last held it: what its next op is made against (ADR-063). */
const seqs = new Map<string, number>()

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

/** The `headSeq` of the copy this browser holds of `id`, or `null` when it holds none. */
export function knownSeq(id: string): number | null {
  return seqs.get(id) ?? null
}

/** Record the `headSeq` of the copy this browser now holds, never moving one backwards. */
export function noteSeq(id: string, headSeq: number | undefined): void {
  if (headSeq === undefined) return
  const known = seqs.get(id)
  if (known === undefined || headSeq > known) seqs.set(id, headSeq)
}

/** Forget every version: the rows they describe are gone. */
export function forgetVersions(): void {
  versions.clear()
  seqs.clear()
}
