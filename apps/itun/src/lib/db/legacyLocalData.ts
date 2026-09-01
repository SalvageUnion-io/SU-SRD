/**
 * The pre-account roster this browser is still holding, and how to get it out.
 *
 * ## What this used to be, and why it changed
 *
 * This module used to answer one question for `backendForMode`: *does this
 * browser hold a roster from before accounts were required?* — and a `present`
 * answer kept the whole durable IndexedDB backend alive for an anonymous
 * visitor, indefinitely. That was the migration window, and it was described as
 * closing "per browser rather than on a date".
 *
 * It never closed. Nothing in the app ever set it to `absent`, and the only
 * path off the device was a card on the Account screen that the player had to
 * find, could dismiss forever, and which counted the *entity store* rather than
 * IndexedDB. So a browser that had ever held a build stayed on a second source
 * of truth for good: a durable local roster, invisible to the account, that
 * reappeared the moment its owner signed out. That is precisely the state
 * [ADR-035](../../../../docs/adrs/ADR-035-no-isolated-local-only-data.md) exists
 * to end.
 *
 * ## What it is now
 *
 * The probe survives, and its answer is unchanged — but nothing reads it to
 * *choose a backend* any more. Anonymous is always in-memory (see
 * `stores/entityBackend.ts`), and this module's job is to say **whether there
 * is anything left to migrate**, and to hand those rows over so it can be.
 *
 * `present` therefore now means "this browser has rows that may not be in the
 * account yet", which is a to-do rather than a mode. `markLegacyLocalDataMigrated`
 * is what finally makes it `absent` — the close this window never had — and it
 * is what re-enables cache pruning (`db/pruneRules.ts`).
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
import { openItunDatabase } from './index'
import { STORE_NAMES } from './stores'

export type LegacyProbeState = 'unknown' | 'present' | 'absent'

let state: LegacyProbeState = 'unknown'

/** What the probe has concluded so far. `unknown` until it resolves. */
export function legacyLocalDataState(): LegacyProbeState {
  return state
}

/**
 * Record that this browser's pre-account rows are now in the account.
 *
 * The close the migration window never had. Until this is called
 * `mayPrune` refuses to delete anything, because a local row absent from
 * `listMine` might be un-uploaded rather than deleted-elsewhere — and once it
 * is called that ambiguity is gone, so the cache can finally behave like one.
 *
 * Called **only** after a claim that stranded nothing. A claim that skipped or
 * declined even one row leaves the state `present`, which costs nothing but a
 * disabled prune and is the only answer that cannot delete work.
 */
export function markLegacyLocalDataMigrated(): void {
  state = 'absent'
}

/**
 * The stores whose contents mean "this browser has something left to migrate".
 *
 * Only the ones a *person* built. `workspaces` is the retired container and
 * `changeLog` is provenance about entities rather than an entity, so neither
 * would justify a migration pass on its own — and a stray log row from a
 * since-deleted pilot is exactly the kind of leftover that would.
 *
 * **`encounterNpcs` belongs here now, and did not before.** While this probe
 * only chose a backend, an NPC tray was not a reason to keep one. The question
 * it answers changed with ADR-035 — `readLegacyLocalData` and `claimLocal` both
 * cover the tray — so a browser holding nothing but a tray used to probe
 * `absent` and was never migrated and never warned.
 *
 * **`softLinks` is deliberately still out.** A link is wiring between entities
 * rather than a thing somebody built, so a browser holding only orphaned links
 * has nothing to migrate — and counting them would hold that browser at
 * `present` forever, which keeps `mayPrune` off for good over junk.
 */
const ROSTER_STORES = [
  STORE_NAMES.pilots,
  STORE_NAMES.mechs,
  STORE_NAMES.crawlers,
  STORE_NAMES.mechPatterns,
  STORE_NAMES.encounterNpcs,
] as const

/**
 * Look once, at boot, and remember.
 *
 * Idempotent: after the first resolution this returns the cached answer without
 * touching IndexedDB again.
 */
export async function probeLegacyLocalData(): Promise<LegacyProbeState> {
  if (state !== 'unknown') return state

  try {
    const idb = await openItunDatabase()
    for (const store of ROSTER_STORES) {
      // `count` rather than `getAll`: the question is "is there anything", and
      // reading a whole roster to answer it would parse every record at boot
      // for no reason. The read that does parse is `readLegacyLocalData`, and
      // it only runs when there is something to migrate.
      const n = await idb.count(store)
      if (n > 0) {
        state = 'present'
        return state
      }
    }
    state = 'absent'
  } catch (err) {
    // A browser that refuses IndexedDB — private mode, a locked-down profile,
    // a blocked upgrade — cannot be holding a roster this app can read.
    // `absent` is both true and the useful answer: there is nothing to migrate
    // and nothing to hold back the cache.
    console.warn('[itun] could not probe for legacy local data; assuming none', err)
    state = 'absent'
  }

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
}
