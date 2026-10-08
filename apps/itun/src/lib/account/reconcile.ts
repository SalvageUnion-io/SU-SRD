/**
 * The one local → account reconciler (ADR-034, ADR-035).
 *
 * ## Why there is one
 *
 * Work can be held outside the account in exactly one place now: **this
 * device** — a pre-account roster still in IndexedDB. There used to be a
 * second, **this session** (what an anonymous visitor built in an in-memory
 * backend, uploaded on sign-in), and each had its own path, its own UI and its
 * own reading of `claimLocal`'s partial-success result — paths that drifted,
 * which is what ADR-035 exists because of. Signed out, ITUN is read-only
 * (ADR-034 decision 1, as amended), so the session source is gone; this module
 * keeps the rule for the one that remains: how work is sent and what a result
 * means. `components/account/AccountReconciler.tsx` is the one surface that
 * shows it.
 *
 * Device work may already be in the account, so it is filtered through
 * `selectStranded` against `entities.listMine` before it reaches here, and is
 * not adopted into the cache afterwards — those rows are already on disk.
 */

import type { useMutation } from 'convex/react'
import type { api } from '../../../convex/_generated/api'
import type { StrandedWork } from './legacyMigration'

type ClaimLocal = ReturnType<typeof useMutation<typeof api.claim.claimLocal>>

/** What a reconciliation pass achieved. */
export type ReconcileResult = {
  claimed: number
  /**
   * Rows that are still outside the account after a RESOLVED call.
   *
   * `claimLocal` reports per-row failure in its return value, not by throwing:
   * `skipped` is a body the server could not parse, `alreadyPresent` an app id
   * taken somewhere in the database (import keeps ids, so another account can
   * hold it). Either way the row is present locally and absent from the
   * account — which is exactly what `ShelfSync`'s prune would read as "deleted
   * elsewhere" if this were treated as success. `claimed > 0` is true in every
   * partial case, so it cannot be the test.
   *
   * `declined` is NOT counted. Those are rows naming a Game that exists — a
   * crewmate's build this browser cached — which the server refuses precisely
   * because they are not this account's to move, and which are already safe on
   * the server.
   */
  stranded: number
}

/** The arithmetic above, pinned on its own because it is the whole guard. */
export function strandedCount(result: { skipped: number; alreadyPresent: number }): number {
  return result.skipped + result.alreadyPresent
}

/**
 * Send local work to the account.
 *
 * Takes the mutation as an argument rather than calling `useMutation` itself,
 * so this stays a plain function testable without a Convex provider. A server
 * refusal **rejects** — the caller reports it and keeps the work.
 */
export async function reconcile(
  claimLocal: ClaimLocal,
  work: StrandedWork
): Promise<ReconcileResult> {
  const result = await claimLocal({
    pilots: work.pilots,
    mechs: work.mechs,
    crawlers: work.crawlers,
    softLinks: work.softLinks,
    mechPatterns: work.mechPatterns,
    encounterNpcs: work.encounterNpcs,
  })
  return { claimed: result.claimed, stranded: strandedCount(result) }
}
