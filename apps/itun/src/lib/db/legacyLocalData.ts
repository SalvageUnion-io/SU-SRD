/**
 * Does this browser already hold a roster from before accounts were required?
 *
 * ## Why the flip needs this
 *
 * ADR-034 sends an anonymous visitor to the in-memory backend. For somebody
 * arriving fresh that is exactly right. For the years of **existing Solo users**
 * it is a disaster: their pilots are in IndexedDB, the memory store is empty, and
 * the app would stop reading the one place their work lives. They would open ITUN
 * and find nothing — not deleted, but unreachable, which from where they sit is
 * the same thing.
 *
 * P5's claim path does not save them either, because the claim card reads the
 * entity store, and in memory mode the entity store is empty. There would be
 * nothing to offer and no way to know there was anything to ask for.
 *
 * So the flip is conditional: **anonymous goes to memory only in a browser that
 * has no legacy roster.** A browser that has one keeps reading it, and keeps
 * being offered the claim, until the user takes it or exports. That is the
 * migration window, and it closes per browser rather than on a date.
 *
 * ## Fails to the safe side, deliberately
 *
 * The probe is asynchronous and `selectBackend()` is not, so there is a window at
 * boot where the answer is not yet known. During it the state is `unknown`, and
 * `unknown` is treated as "there might be a roster" — the backend stays `local`.
 *
 * That direction is not arbitrary. Guessing `absent` wrongly sends an existing
 * user's writes to a Map that is thrown away when the tab closes; guessing
 * `present` wrongly gives a brand-new visitor a durable local write they were
 * going to be asked to claim anyway. One of those loses work and the other does
 * not, so the window resolves toward the one that does not.
 */

import { openItunDatabase } from './index'
import { STORE_NAMES } from './stores'

export type LegacyProbeState = 'unknown' | 'present' | 'absent'

let state: LegacyProbeState = 'unknown'

/** What the probe has concluded so far. `unknown` until it resolves. */
export function legacyLocalDataState(): LegacyProbeState {
  return state
}

/**
 * The stores whose contents mean "this browser has a roster".
 *
 * Only the ones a *person* built. `workspaces` is the retired container and
 * `changeLog` is provenance about entities rather than an entity, so neither
 * would justify holding a fresh visitor in the local backend on its own — and a
 * stray log row from a since-deleted pilot is exactly the kind of leftover that
 * would.
 */
const ROSTER_STORES = [
  STORE_NAMES.pilots,
  STORE_NAMES.mechs,
  STORE_NAMES.crawlers,
  STORE_NAMES.mechPatterns,
] as const

/**
 * Look once, at boot, and remember.
 *
 * Idempotent: after the first resolution this returns the cached answer without
 * touching IndexedDB again. The answer is allowed to go stale in one direction
 * only — a browser that gains a roster during the session got it through the
 * local backend, which is the branch `present` already selects.
 */
export async function probeLegacyLocalData(): Promise<LegacyProbeState> {
  if (state !== 'unknown') return state

  try {
    const db = await openItunDatabase()
    for (const store of ROSTER_STORES) {
      // `count` rather than `getAll`: the question is "is there anything", and
      // reading a whole roster to answer it would parse every record at boot
      // for no reason.
      const n = await db.count(store)
      if (n > 0) {
        state = 'present'
        return state
      }
    }
    state = 'absent'
  } catch (err) {
    // A browser that refuses IndexedDB — private mode, a locked-down profile,
    // a blocked upgrade — cannot be holding a legacy roster this app can read.
    // `absent` is both true and the useful answer: it lets an anonymous visitor
    // work in memory rather than stranding them against a store that will not
    // open.
    console.warn('[itun] could not probe for legacy local data; assuming none', err)
    state = 'absent'
  }

  return state
}

/** Test-only: forget what the probe concluded. */
export function _resetLegacyProbe(): void {
  state = 'unknown'
}
