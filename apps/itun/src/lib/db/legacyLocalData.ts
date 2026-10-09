/**
 * The pre-account roster this browser is still holding, and how to get it out.
 *
 * ## What this answers
 *
 * Whether this browser holds rows that may not be in any account yet — a
 * roster built before accounts were required — and therefore whether there is
 * anything left to migrate ([ADR-035](../../../../../docs/ARCHITECTURE.md#adr-035)).
 * `present` is a to-do, not a mode: `AccountReconciler` migrates the rows on
 * sign-in, and `markLegacyLocalDataMigrated` closes the window. Until it is
 * closed, `ShelfSync` may not prune (`db/pruneRules.ts`) and nothing may wipe
 * the cache (`lib/account/cacheOwner.ts`).
 *
 * ## It reads the meta row, not the rows
 *
 * The answer is the cache's recorded `origin` (`cacheMeta.ts`): `legacy` is
 * `present`, `cache` is `absent`. It used to count the roster stores at boot
 * and keep the verdict in module memory, and both halves were wrong. A
 * signed-in browser's cache is full of rows `ShelfSync` put there, so every
 * load counted them as a roster, re-ran the migration, and re-claimed any
 * cached build that had since been deleted on another device. And a verdict in
 * memory is forgotten by the next load, so the window closed for a page view at
 * a time. The origin is written once, by the v18 upgrade, and a completed
 * migration persists the close.
 *
 * ## Reads are salvage-tolerant, deliberately
 *
 * The rows come back through the ordinary `db.*` stores rather than a raw
 * `getAll`, so a record written by an older build is repaired on read exactly as
 * every other reader repairs it. A roster that has been sitting in a browser
 * since before ADR-030 is the single most likely place for version skew, and
 * this is the one pass that has to survive it.
 */

import * as db from './index'
import { readCacheMeta, writeCacheMeta } from './index'

export type LegacyProbeState = 'unknown' | 'present' | 'absent'

let state: LegacyProbeState = 'unknown'

/** What the probe has concluded so far. `unknown` until it resolves. */
export function legacyLocalDataState(): LegacyProbeState {
  return state
}

/**
 * Record that this browser's pre-account rows are now in `userId`'s account.
 *
 * The close the migration window never had, and now a durable one: the cache's
 * origin becomes `cache`, owned by `userId`, so the next load neither re-runs
 * the migration nor treats the account's cached rows as somebody's roster.
 * Until this is called `mayPrune` refuses to delete anything, because a local
 * row absent from `listMine` might be un-uploaded rather than deleted-elsewhere.
 *
 * Called **only** after a pass that stranded nothing. A pass that skipped or
 * declined even one row leaves the origin `legacy`, which costs nothing but a
 * disabled prune and is the only answer that cannot delete work.
 */
export async function markLegacyLocalDataMigrated(userId: string): Promise<void> {
  state = 'absent'
  await writeCacheMeta({ origin: 'cache', userId })
}

/**
 * Look once, at boot, and remember.
 *
 * Idempotent: after the first resolution this returns the cached answer without
 * touching IndexedDB again.
 */
export function probeLegacyLocalData(): Promise<LegacyProbeState> {
  if (state !== 'unknown') return Promise.resolve(state)
  // Two callers ask at boot (`ConnectionProvider` and `AccountReconciler`);
  // sharing the in-flight probe means one read, not two.
  inFlight ??= runProbe(generation)
  return inFlight
}

/**
 * Bumped by `_resetLegacyProbe`, so a probe still running from before a reset
 * cannot write its (now stale) answer over the fresh state.
 */
let generation = 0
let inFlight: Promise<LegacyProbeState> | null = null

async function runProbe(started: number): Promise<LegacyProbeState> {
  let answer: LegacyProbeState = 'absent'
  try {
    const meta = await readCacheMeta()
    answer = meta.origin === 'legacy' ? 'present' : 'absent'
  } catch (err) {
    // A browser that refuses IndexedDB — private mode, a locked-down profile,
    // a blocked upgrade — cannot be holding a roster this app can read.
    // `absent` is both true and the useful answer: there is nothing to migrate
    // and nothing to hold back the cache.
    console.warn('[itun] could not probe for legacy local data; assuming none', err)
  }

  if (started !== generation) return state
  inFlight = null
  // `markLegacyLocalDataMigrated` may have run while this was reading; an
  // answer it already settled is not reopened by a slower probe.
  if (state === 'unknown') state = answer
  return state
}

/** Everything a pre-account browser can be holding. */
export type LegacyLocalData = {
  pilots: unknown[]
  mechs: unknown[]
  crawlers: unknown[]
  softLinks: unknown[]
  mechPatterns: unknown[]
  encounterNpcs: unknown[]
}

/**
 * Read the whole local roster out of IndexedDB.
 *
 * Every kind `claimLocal` accepts, because a partial migration is how the
 * crawler and the pattern library were dropped from the first version of that
 * mutation — a player watched half a campaign not arrive.
 *
 * A store that will not read yields an empty array rather than failing the
 * pass: one unreadable object store must not strand the five that are fine.
 */
export async function readLegacyLocalData(): Promise<LegacyLocalData> {
  const read = async (name: string, list: () => Promise<unknown[]>): Promise<unknown[]> => {
    try {
      return await list()
    } catch (err) {
      console.warn(`[itun] could not read local ${name} while migrating`, err)
      return []
    }
  }

  const [pilots, mechs, crawlers, softLinks, mechPatterns, encounterNpcs] = await Promise.all([
    read('pilots', () => db.pilots.list()),
    read('mechs', () => db.mechs.list()),
    read('crawlers', () => db.crawlers.list()),
    read('softLinks', () => db.softLinks.list()),
    read('mechPatterns', () => db.mechPatterns.list()),
    read('encounterNpcs', () => db.encounterNpcs.list()),
  ])

  return { pilots, mechs, crawlers, softLinks, mechPatterns, encounterNpcs }
}

/** Test-only: forget what the probe concluded. */
export function _resetLegacyProbe(): void {
  state = 'unknown'
  generation += 1
  inFlight = null
}
