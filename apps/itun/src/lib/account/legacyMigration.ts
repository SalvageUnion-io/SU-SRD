/**
 * Getting a pre-account roster off a device and into the account that owns it.
 *
 * ## The state this exists to end
 *
 * ADR-034 required an account to persist anything, but exempted any browser
 * that already held a roster: it kept the durable IndexedDB backend, "until the
 * user takes the claim or exports". Nothing ever closed that window. The only
 * path off the device was `ClaimLocalData`, a card on the Account screen —
 * findable only if you went looking, dismissible forever, and counting the
 * *entity store* rather than IndexedDB, so once a sync had filled that store the
 * card could read a full account and offer nothing.
 *
 * The result is the bug this module was written for: a roster that is present
 * signed out and absent signed in. Two sources of truth, one of them invisible
 * to the product, exactly as
 * [ADR-035](../../../../docs/adrs/ADR-035-no-isolated-local-only-data.md)
 * describes.
 *
 * ## Two things go wrong, and both have to be fixed
 *
 * **The rows never reach the account.** Handled by {@link claimStrandedRows},
 * which runs by itself the moment a signed-in session has a `listMine` to
 * compare against — no card, no screen to find, no decline.
 *
 * **A row that DID reach the account can still be invisible.** Migration v13
 * mapped every non-Default Workspace onto `gameId: <that workspace id>`, and
 * those ids name no real Game. Signed out nothing filters, so the pile renders
 * whole; signed in, `Roster` scopes to the active container and every one of
 * them is addressed to a Game the account is not in — so they vanish. Claiming
 * them unchanged would upload them into the same invisibility, which is why
 * {@link shelve} rewrites the container as part of the migration rather than
 * afterwards.
 *
 * That second half is the reason a phantom container counts as *stranded* here
 * even though the row is not on the shelf: a container nobody can reach is not
 * a container.
 */

import type { ContainerFields } from '../container'
import { containerOf } from '../container'
import type { LegacyLocalData } from '../db/legacyLocalData'
import type { ExportBundle } from '../schemas/exportBundle'

/** The `{ appId, body }` / `{ body }` rows `entities.listMine` returns. */
type ServedRow = { body: unknown }

/** A local row, as far as this module needs to understand one. */
type LocalRow = ContainerFields & { id: string }

/**
 * Rewrite a row's container to the shelf.
 *
 * `gameId: null` **explicitly**, never by deleting the key: `containerOf` reads
 * `null` as "on the shelf, decided" and `undefined` as "predates the split, fall
 * back to `workspaceId`" — and falling back is how the row acquired a phantom
 * Game in the first place. Setting it to `null` is what makes the migration
 * stick.
 *
 * `workspaceId` is left alone. The entity schemas are `.strict()` and still
 * declare it, and `containerOf` never reaches the fallback once `gameId` is
 * `null`, so removing it would be an unrelated irreversible edit riding along
 * with a migration.
 */
export function shelve<T extends object>(body: T): T {
  return { ...body, gameId: null }
}

/** The ids of the entities the server said this account already owns. */
function servedIds(rows: readonly ServedRow[]): Set<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    const id = (row.body as { id?: unknown } | null)?.id
    if (typeof id === 'string') ids.add(id)
  }
  return ids
}

/**
 * Is this local row isolated — held by the device and by nothing else?
 *
 * Two ways to be reachable, and a row needs only one:
 *
 *  - **the account owns it.** `entities.listMine` returns everything the caller
 *    owns, in any container, so its presence there settles the question.
 *  - **it lives in a Game the account is a member of.** These are the rows
 *    `GameRoster` caches on purpose: a Game's unclaimed pre-gens and its
 *    communal crawler have no owner at all, so they are legitimately absent from
 *    `listMine` while being entirely server-backed. Claiming one would copy
 *    somebody else's character onto your shelf.
 *
 * Everything else is stranded: a shelf row the account does not own (it never
 * reached the server), or a row addressed to a Game that does not exist (a
 * Workspace id left by migration v13 — see the module header).
 */
export function isStranded(
  row: LocalRow,
  ownedIds: ReadonlySet<string>,
  memberGameIds: ReadonlySet<string>
): boolean {
  if (ownedIds.has(row.id)) return false
  const container = containerOf(row)
  return !(container.kind === 'game' && memberGameIds.has(container.gameId))
}

/** What a reconciliation pass decided to send. */
export type StrandedWork = {
  pilots: unknown[]
  mechs: unknown[]
  crawlers: unknown[]
  softLinks: unknown[]
  mechPatterns: unknown[]
  encounterNpcs: unknown[]
}

/** Total rows in a selection. Zero means the browser holds nothing isolated. */
export function countStranded(work: StrandedWork): number {
  return (
    work.pilots.length +
    work.mechs.length +
    work.crawlers.length +
    work.mechPatterns.length +
    work.encounterNpcs.length
    // Soft links are excluded from the count for the same reason
    // `countAnonymousWork` excludes them: they are wiring between things rather
    // than things, so "3 builds" reads correctly and "5" would not. They are
    // still sent.
  )
}

/** The subset of `entities.listMine` this reconciliation reads. */
export type ServedRoster = {
  pilots: readonly ServedRow[]
  mechs: readonly ServedRow[]
  crawlers: readonly ServedRow[]
  mechPatterns: readonly ServedRow[]
  encounterNpcs: readonly ServedRow[]
}

/**
 * Decide what a browser is holding that the account is not.
 *
 * Pure, and separated from the component for the same reason `pruneRules` is
 * separated from `ShelfSync`: this rule decides what gets uploaded on somebody's
 * behalf, so the tests have to drive **the rule itself** rather than a copy of
 * it living in a test file.
 *
 * Every entity that comes back is already {@link shelve}d, because a claim lands
 * on the shelf by definition (`entities.claimLocal`) and the body has to agree
 * with the row it is stored in — a body that still names a Game is how a claimed
 * build arrives in the account and stays invisible anyway.
 */
export function selectStranded(
  local: LegacyLocalData,
  served: ServedRoster,
  memberGameIds: ReadonlySet<string>
): StrandedWork {
  const strandedOf = (rows: readonly unknown[], owned: ReadonlySet<string>): unknown[] =>
    rows
      .filter((row): row is LocalRow => typeof (row as LocalRow | null)?.id === 'string')
      .filter((row) => isStranded(row, owned, memberGameIds))
      .map((row) => shelve(row))

  const pilots = strandedOf(local.pilots, servedIds(served.pilots))
  const mechs = strandedOf(local.mechs, servedIds(served.mechs))
  const crawlers = strandedOf(local.crawlers, servedIds(served.crawlers))

  /*
   * Patterns and NPCs carry no container the player can navigate to — a pattern
   * is a saved loadout and a shelf NPC is a personal tray — so ownership alone
   * decides, with no phantom-Game case to consider.
   *
   * A row with no string id is dropped rather than sent, the same as an entity
   * without one. It cannot be addressed, so it cannot be reconciled — and
   * sending it would come back `skipped`, which holds the migration window open
   * for a row that could never close it.
   */
  const unowned = (rows: readonly unknown[], owned: ReadonlySet<string>): unknown[] =>
    rows.filter((row) => {
      const id = (row as { id?: unknown } | null)?.id
      return typeof id === 'string' && !owned.has(id)
    })

  const mechPatterns = unowned(local.mechPatterns, servedIds(served.mechPatterns))
  const encounterNpcs = unowned(local.encounterNpcs, servedIds(served.encounterNpcs))

  /*
   * Only the links whose wiring is part of what is being sent.
   *
   * Sending every local link instead would be safe — `claimLocal` matches a
   * link by its (from, to, kind) triple and reports a repeat as
   * `alreadyPresent` — but "safe" is not "free" here: a non-zero
   * `alreadyPresent` is what stops the migration being marked complete, so a
   * browser with nothing left to migrate would re-send its links forever and
   * never close its window.
   */
  const moving = new Set(
    [...pilots, ...mechs, ...crawlers].map((row) => (row as { id: string }).id)
  )
  const softLinks = local.softLinks.filter((link) => {
    const l = link as { from?: { id?: unknown }; to?: { id?: unknown } }
    return (
      (typeof l.from?.id === 'string' && moving.has(l.from.id)) ||
      (typeof l.to?.id === 'string' && moving.has(l.to.id))
    )
  })

  return { pilots, mechs, crawlers, softLinks, mechPatterns, encounterNpcs }
}

/**
 * A backup of what is on the device, built from IndexedDB rather than the store.
 *
 * The stores are the wrong source here by construction: an anonymous session
 * reads the in-memory backend, so `buildExportBundle` would hand somebody
 * downloading their pre-account roster an empty file. This reads the rows that
 * are actually on the disk.
 *
 * It deliberately does **not** call `recordExport()`. That resets the backup
 * nudge, which tracks un-exported writes to the *account* — a legacy download is
 * evidence about the device, and letting it silence the nudge would mean a
 * signed-in player's real edits went unnudged because of a file they took for a
 * different reason.
 */
export function buildLegacyExportBundle(local: LegacyLocalData): ExportBundle {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    entities: {
      pilots: local.pilots,
      mechs: local.mechs,
      crawlers: local.crawlers,
    },
    workspaces: [],
    softLinks: local.softLinks,
    mechPatterns: local.mechPatterns,
    encounterNpcs: local.encounterNpcs,
  } as ExportBundle
}
