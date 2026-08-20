/**
 * Turning anonymous work into saved work.
 *
 * ADR-034 decision 1 lets a visitor build without an account, in memory, and
 * requires an account only to **keep** what they built. This module is the
 * "keep" half: it takes everything sitting in the anonymous stores and writes
 * it to Convex, then fills the local cache from the same rows.
 *
 * ## The hazard this module exists to handle
 *
 * `selectBackend()` reads live auth state, so the instant a sign-in resolves it
 * flips from `memory` to `remote` — and `dbStoreFor` starts returning the
 * IndexedDB stores instead of the Maps. The Maps are still there, but **nothing
 * reads them any more**, and the first `rehydrate()` after that point overwrites
 * the in-memory cache with what IndexedDB holds, which for a brand-new visitor
 * is nothing at all.
 *
 * So the work must be **captured from the Zustand cache** (which survives the
 * flip, because it is neither backend) and promoted before anything re-reads.
 * Capturing from `dbStoreFor` instead would race the flip and silently promote
 * an empty roster — the failure mode being: user signs in to save, is told it
 * worked, and finds an empty account.
 *
 * ## Why this promotes rather than offers
 *
 * `ClaimLocalData` deliberately *offers* — uploading somebody's existing roster
 * the moment they sign in is a decision made with their data, and signing in to
 * look at a friend's game should not publish your own builds. That reasoning
 * does not apply here and the difference is consent, not mechanism: this path is
 * only reached because the user pressed a control that says "sign in to save
 * this". Asking again immediately afterwards would be asking whether they meant
 * the thing they just asked for.
 *
 * The mutation underneath is the same `entities.claimLocal`, which is already
 * idempotent — it skips anything it already holds — so a promotion that runs
 * twice is a no-op rather than a duplicate roster.
 */

import type { useMutation } from 'convex/react'
import type { api } from '../../../convex/_generated/api'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'

/** Everything an anonymous session can be holding. */
export type AnonymousWork = {
  pilots: unknown[]
  mechs: unknown[]
  crawlers: unknown[]
  softLinks: unknown[]
  mechPatterns: unknown[]
}

/**
 * Read the anonymous work out of the in-memory caches.
 *
 * Synchronous and from `getState()` on purpose — see the header. This must not
 * await anything, because an await is a window in which the backend can flip.
 */
export function captureAnonymousWork(): AnonymousWork {
  const entities = useEntityStore.getState()
  return {
    pilots: entities.list('pilot'),
    mechs: entities.list('mech'),
    crawlers: entities.list('crawler'),
    softLinks: entities.list('softLink'),
    mechPatterns: usePatternStore.getState().list(),
  }
}

/** How many records a capture holds. Zero means there is nothing to offer. */
export function countAnonymousWork(work: AnonymousWork): number {
  return (
    work.pilots.length + work.mechs.length + work.crawlers.length + work.mechPatterns.length
    // Soft links are deliberately excluded from the COUNT: they are wiring
    // between things rather than things, so "3 builds" reads correctly while
    // "5 builds" (with two links) would not. They are still promoted.
  )
}

type ClaimLocal = ReturnType<typeof useMutation<typeof api.entities.claimLocal>>

export type PromotionResult = {
  claimed: number
  skipped: number
  alreadyPresent: number
}

/**
 * Write captured anonymous work to the server, then cache it locally.
 *
 * Takes the mutation as an argument rather than calling `useMutation` itself,
 * so this stays a plain function testable without a Convex provider — the same
 * shape the rest of `src/lib` uses.
 *
 * The local adoption is not decoration. Without it the UI would keep rendering
 * the Maps until something happened to re-read, and the first rehydrate would
 * blank the roster even though the server now holds it — correct data, and a
 * screen that says otherwise.
 */
export async function promoteAnonymousWork(
  claimLocal: ClaimLocal,
  work: AnonymousWork
): Promise<PromotionResult> {
  const result = await claimLocal({
    pilots: work.pilots,
    mechs: work.mechs,
    crawlers: work.crawlers,
    softLinks: work.softLinks,
    mechPatterns: work.mechPatterns,
  })

  // Adopt keeps each record's own id, so the local copy IS the entity rather
  // than a fork of it — the same reason `GameRoster.ensureLocal` uses adopt.
  // **A failed adoption must not fail the promotion.** The server write above
  // has already landed, so the work IS saved; adoption only fills the local
  // cache. Letting a parse failure here throw would tell the user their save
  // failed immediately after it succeeded, and would very likely make them try
  // again — which is how one save becomes two. A cache that is briefly empty
  // heals on the next read; a false failure message does not.
  const store = useEntityStore.getState()
  for (const [kind, rows] of [
    ['pilot', work.pilots],
    ['mech', work.mechs],
    ['crawler', work.crawlers],
    ['softLink', work.softLinks],
  ] as const) {
    for (const row of rows) {
      try {
        await store.adopt(kind, row as never)
      } catch (err) {
        // Worth knowing about — a row the server accepted that this build
        // cannot parse is a real schema disagreement — but not worth failing on.
        console.warn(`[itun] promoted ${kind} but could not cache it locally`, err)
      }
    }
  }

  return {
    claimed: result.claimed,
    skipped: result.skipped,
    alreadyPresent: result.alreadyPresent,
  }
}
