/**
 * The one local → account reconciler (ADR-034, ADR-035).
 *
 * ## Why there is one
 *
 * Work can be held outside the account in exactly two places, and there used
 * to be a separate path, with its own UI, for each:
 *
 *  - **this session** — what an anonymous visitor built in the in-memory
 *    backend. `UnsavedWorkBanner` said so, `AnonymousWorkPromoter` uploaded it
 *    on sign-in through `promoteAnonymousWork`, with its own retry button.
 *  - **this device** — a pre-account roster still in IndexedDB.
 *    `LegacyLocalData` said so in a second banner, and migrated it on sign-in
 *    through its own `claimLocal` call and its own error line, with no retry.
 *
 * Both ended in the same mutation and had to interpret the same partial-success
 * result, and they did it in two places that drifted — ADR-035 exists because
 * paths like these once disagreed about what "saved" meant. This module is the
 * rule, once: what counts as work, how it is sent, and what a result means.
 * `components/account/AccountReconciler.tsx` is the one surface that shows it.
 *
 * ## The two sources still differ in one way, deliberately
 *
 * Session work was built in this tab by somebody who then pressed "sign in to
 * save this", so it is sent as-is and adopted into the local cache afterwards
 * (the backend flip would otherwise leave the screen showing nothing until the
 * next sync). Device work may already be in the account, so it is filtered
 * through `selectStranded` against `entities.listMine` first, and is NOT
 * adopted — those rows are already on disk.
 */

import type { useMutation } from 'convex/react'
import type { api } from '../../../convex/_generated/api'
import { useEncounterStore } from '../../stores/encounterStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import type { EncounterNpc } from '../schemas/encounterNpc'
import type { ExportBundle } from '../schemas/exportBundle'
import type { MechPattern } from '../schemas/pattern'
import type { ServedRoster } from './legacyMigration'
import { servedIds } from './legacyMigration'

/** Everything that can be held outside the account, from either source. */
export type LocalWork = {
  pilots: unknown[]
  mechs: unknown[]
  crawlers: unknown[]
  softLinks: unknown[]
  mechPatterns: unknown[]
  encounterNpcs: unknown[]
}

/**
 * How many records a selection holds. Zero means there is nothing to say.
 *
 * Soft links are deliberately excluded from the COUNT: they are wiring between
 * things rather than things, so "3 builds" reads correctly while "5 builds"
 * (with two links) would not. They are still sent.
 */
export function countWork(work: LocalWork): number {
  return (
    work.pilots.length +
    work.mechs.length +
    work.crawlers.length +
    work.mechPatterns.length +
    work.encounterNpcs.length
  )
}

/**
 * Read this session's work out of the in-memory caches.
 *
 * Synchronous and from `getState()` on purpose: `selectBackend()` reads live
 * auth state, so the instant a sign-in resolves it flips from `memory` to
 * `remote` and the stores start reading IndexedDB instead of the Maps. The
 * Zustand caches survive the flip; an `await` here would be a window in which
 * the first rehydrate blanks them and an empty roster gets "saved".
 */
export function captureSessionWork(): LocalWork {
  const entities = useEntityStore.getState()
  return {
    pilots: entities.list('pilot'),
    mechs: entities.list('mech'),
    crawlers: entities.list('crawler'),
    softLinks: entities.list('softLink'),
    mechPatterns: usePatternStore.getState().list(),
    encounterNpcs: useEncounterStore.getState().list(),
  }
}

/** A row's own id, or null for a row without one. */
function rowId(row: unknown): string | null {
  const id = (row as { id?: unknown } | null)?.id
  return typeof id === 'string' ? id : null
}

/** Every row id a selection holds, soft links included. */
export function workIds(work: LocalWork): Set<string> {
  const ids = new Set<string>()
  for (const rows of Object.values(work) as unknown[][]) {
    for (const row of rows) {
      const id = rowId(row)
      if (id !== null) ids.add(id)
    }
  }
  return ids
}

/**
 * A selection with the given rows taken out.
 *
 * What keeps a signed-in account's cached rows out of the anonymous capture.
 * The Zustand caches survive signing out, so without this the account's own
 * roster reads as "this tab's unsaved work" the moment the backend returns to
 * `memory` — and the next sign-in, possibly to a different account, uploads it.
 */
export function withoutIds(work: LocalWork, excluded: ReadonlySet<string>): LocalWork {
  if (excluded.size === 0) return work
  const keep = (rows: readonly unknown[]): unknown[] =>
    rows.filter((row) => {
      const id = rowId(row)
      return id === null || !excluded.has(id)
    })
  return {
    pilots: keep(work.pilots),
    mechs: keep(work.mechs),
    crawlers: keep(work.crawlers),
    softLinks: keep(work.softLinks),
    mechPatterns: keep(work.mechPatterns),
    encounterNpcs: keep(work.encounterNpcs),
  }
}

/**
 * The part of this session's work the account does not hold yet.
 *
 * What makes "Try again" a retry rather than a resend. `claimLocal` answers a
 * row whose app id is already taken with `alreadyPresent` — including a row
 * the caller's OWN first pass just saved — so resending the whole capture after
 * a partial save reports every row that landed as a failure, and the error line
 * can never clear. Filtering against `entities.listMine`, the way device rows
 * are, sends only what is still missing.
 *
 * Soft links follow the rows they wire, as in `selectStranded`: a link between
 * two saved rows is itself a repeat and would come back `alreadyPresent`.
 */
export function unsavedWork(work: LocalWork, served: ServedRoster): LocalWork {
  const missing = (rows: readonly unknown[], owned: ReadonlySet<string>): unknown[] =>
    rows.filter((row) => {
      const id = (row as { id?: unknown } | null)?.id
      return typeof id !== 'string' || !owned.has(id)
    })

  const pilots = missing(work.pilots, servedIds(served.pilots))
  const mechs = missing(work.mechs, servedIds(served.mechs))
  const crawlers = missing(work.crawlers, servedIds(served.crawlers))
  const moving = new Set(
    [...pilots, ...mechs, ...crawlers]
      .map((row) => (row as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === 'string')
  )
  const softLinks = work.softLinks.filter((link) => {
    const l = link as { from?: { id?: unknown }; to?: { id?: unknown } }
    return (
      (typeof l.from?.id === 'string' && moving.has(l.from.id)) ||
      (typeof l.to?.id === 'string' && moving.has(l.to.id))
    )
  })

  return {
    pilots,
    mechs,
    crawlers,
    softLinks,
    mechPatterns: missing(work.mechPatterns, servedIds(served.mechPatterns)),
    encounterNpcs: missing(work.encounterNpcs, servedIds(served.encounterNpcs)),
  }
}

type ClaimLocal = ReturnType<typeof useMutation<typeof api.entities.claimLocal>>

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
 * Send local work to the account, and optionally cache it locally afterwards.
 *
 * Takes the mutation as an argument rather than calling `useMutation` itself,
 * so this stays a plain function testable without a Convex provider.
 *
 * A server refusal **rejects** — the caller reports it and keeps the work. A
 * failed local adoption does **not**: the server write already landed, so the
 * work IS saved, and reporting a failure after a successful save is how one
 * save becomes two. A briefly empty cache heals on the next sync.
 */
export async function reconcile(
  claimLocal: ClaimLocal,
  work: LocalWork,
  options: { adopt: boolean }
): Promise<ReconcileResult> {
  const result = await claimLocal({
    pilots: work.pilots,
    mechs: work.mechs,
    crawlers: work.crawlers,
    softLinks: work.softLinks,
    mechPatterns: work.mechPatterns,
    encounterNpcs: work.encounterNpcs,
  })

  if (options.adopt) await adoptLocally(work)

  return { claimed: result.claimed, stranded: strandedCount(result) }
}

/**
 * Put session work into the signed-in cache under its own ids.
 *
 * `adopt` keeps each record's id, so the local copy IS the entity rather than a
 * fork of it — the same reason `GameRoster.ensureLocal` uses it.
 */
async function adoptLocally(work: LocalWork): Promise<void> {
  const report = (kind: string, err: unknown) => {
    // Worth knowing — a row the server accepted that this build cannot parse is
    // a real schema disagreement — but not worth failing the save over.
    console.warn(`[itun] saved ${kind} but could not cache it locally`, err)
  }

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
        report(kind, err)
      }
    }
  }

  const patterns = usePatternStore.getState()
  for (const row of work.mechPatterns) {
    try {
      await patterns.adopt(row as MechPattern)
    } catch (err) {
      report('pattern', err)
    }
  }

  const npcs = useEncounterStore.getState()
  for (const row of work.encounterNpcs) {
    try {
      await npcs.adopt(row as EncounterNpc)
    } catch (err) {
      report('npc', err)
    }
  }
}

/**
 * One backup holding both sources, for the single "Download all".
 *
 * Signed out there are two separate things somebody could lose — this tab's
 * work and this device's rows — and asking them to take two downloads to be
 * safe is how one of them does not get taken. The session bundle already
 * carries the envelope (and has reset the backup nudge, which is correct: it is
 * a real export of this session's work); the device rows are appended.
 */
export function combineBundles(session: ExportBundle | null, device: ExportBundle | null) {
  if (session === null) return device
  if (device === null) return session
  return {
    ...session,
    entities: {
      pilots: [...session.entities.pilots, ...device.entities.pilots],
      mechs: [...session.entities.mechs, ...device.entities.mechs],
      crawlers: [...session.entities.crawlers, ...device.entities.crawlers],
    },
    softLinks: [...session.softLinks, ...device.softLinks],
    mechPatterns: [...session.mechPatterns, ...device.mechPatterns],
    encounterNpcs: [...session.encounterNpcs, ...device.encounterNpcs],
  } satisfies ExportBundle
}
