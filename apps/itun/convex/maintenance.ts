import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalAction } from './_generated/server'
import { bodyAppId, internalMutation, refreshGameSummary } from './model/entities'

/**
 * One-off repairs that operate on the whole deployment.
 *
 * Everything here is internal: not reachable from any client, only from
 * `bunx convex run` with deployment credentials. That is deliberate — these
 * are operator tools that bypass the per-entity authorization every mutation in
 * `entities.ts` pays, so the boundary has to be "you hold the deploy key", not a
 * role check.
 *
 * ## The duplicate-appId repair
 *
 * `pilots`, `mechs` and `crawlers` are addressed by the client's own `appId`,
 * and the lookups that address them — `byAppId` and `patchCrawlerByAppId` —
 * use `.unique()`, which **throws** when a second row shares an app id. Because
 * mirrored writes are fire-and-forget, that throw never reached a player: the
 * local write succeeded, the UI looked correct, and every subsequent edit to
 * that entity silently failed to reach the server of record. An account in that
 * state does not recover on its own and does not get better with time.
 *
 * `claimLocal` is what created the duplicates (it inserted unconditionally, and
 * a device-local marker was all that stopped it running twice) and it no longer
 * can. This is the other half: the rows already written are still there, and
 * still breaking every write, until something removes them.
 *
 * **Run the dry run first.** With no arguments this reports and changes
 * nothing:
 *
 *     bunx convex run maintenance:dedupeAppIds --prod
 *     bunx convex run maintenance:dedupeAppIds '{"apply": true}' --prod
 *
 * ## Every repair here pages
 *
 * Each one is an action that walks a table a page at a time, one mutation per
 * page, rather than one mutation that reads the whole table. A single mutation
 * has a read limit, and a repair that works at today's size and fails at next
 * year's fails on the day it is needed. The price is that a run is not one
 * transaction: a page applied stays applied if a later page fails, and running
 * it again resumes the work, because every repair here is idempotent.
 *
 * ## The backfills
 *
 * Two columns are denormalised from data that already existed, and rows older
 * than the column have none until one of these runs. Readers cope with the gap
 * (see each column's comment in `schema.ts`), so the order of deploy and
 * backfill does not matter — but the read-path savings only arrive once it
 * has run:
 *
 *     bunx convex run maintenance:backfillGameSummaries --prod
 *     bunx convex run maintenance:backfillBodyAppIds --prod
 */

/** Rows one page of a repair reads, unless the caller asks for another size. */
const DEFAULT_PAGE_SIZE = 200

/** Tables addressed by a client-minted `appId`, and therefore duplicable. */
const APP_ID_TABLES = ['pilots', 'mechs', 'crawlers'] as const
type AppIdTable = (typeof APP_ID_TABLES)[number]

type Row = Doc<'pilots'> | Doc<'mechs'> | Doc<'crawlers'>

/** What a single duplicated app id looked like, and what was done about it. */
type GroupReport = {
  table: AppIdTable
  appId: string
  rows: number
  kept: string
  deleted: string[]
  /**
   * `changeLog` rows still pointing at a row this repair would delete.
   *
   * That table is the audit trail and the proposal bus at once — a Mediator's
   * pending proposal is a row in `proposed` state — and it addresses an entity
   * by **Convex id**, not by `appId` (see `loadOwnable`). So deleting the loser
   * of a duplicate pair can leave a proposal aimed at nothing, and can detach
   * history from the surviving row.
   *
   * It degrades gracefully rather than corrupting: applying such a proposal
   * answers "That entity no longer exists". But it is a real consequence, so it
   * is counted and reported up front instead of being discovered afterwards.
   */
  orphanedChangeLogRows: number
}

/**
 * Which row survives.
 *
 * The order matters more than it looks. An owned row beats an unowned one
 * because an unclaimed entity is an offer nobody took up, whereas an owned one
 * is somebody's character. Among rows that tie on that, the most recently
 * written wins — with the caveat that *these* rows have not been written since
 * the duplication broke their mirror, so in practice the tiebreak that usually
 * decides it is creation time, and the oldest row is the one the player has
 * been looking at.
 *
 * Returns the survivor first, losers after.
 */
function rankForKeeping(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const aOwned = 'ownerId' in a && a.ownerId !== null ? 1 : 0
    const bOwned = 'ownerId' in b && b.ownerId !== null ? 1 : 0
    if (aOwned !== bOwned) return bOwned - aOwned
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
    return a._creationTime - b._creationTime
  })
}

/** Rows grouped by app id, keeping only the genuinely duplicated. */
function duplicateGroups(rows: Row[]): Map<string, Row[]> {
  const byAppId = new Map<string, Row[]>()
  for (const row of rows) {
    if (typeof row.appId !== 'string') continue
    const group = byAppId.get(row.appId)
    if (group === undefined) byAppId.set(row.appId, [row])
    else group.push(row)
  }
  for (const [appId, group] of byAppId) {
    if (group.length < 2) byAppId.delete(appId)
  }
  return byAppId
}

/**
 * One page of a table's rows in `appId` order, cut on a group boundary.
 *
 * Walking `by_app_id` puts every copy of an app id next to its siblings, which
 * is what lets this page at all: the question is "which app ids repeat", and
 * in index order a repeat is adjacent. The one care needed is at the page
 * edge — a group straddling it would be judged on half its rows — so the last
 * app id on a full page is re-read whole, and the next page starts after it.
 *
 * Rows with no `appId` sort before every string and are never read: they
 * cannot be duplicates of anything.
 */
async function appIdPage(
  ctx: MutationCtx,
  table: AppIdTable,
  after: string | undefined,
  pageSize: number
): Promise<{ rows: Row[]; next: string | null }> {
  const page = (await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) =>
      after === undefined ? q.gte('appId', '') : q.gt('appId', after)
    )
    .take(pageSize)) as Row[]

  const last = page.at(-1)?.appId
  if (page.length < pageSize || last === undefined) return { rows: page, next: null }

  const lastGroup = (await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', last))
    .collect()) as Row[]
  return { rows: [...page.filter((row) => row.appId !== last), ...lastGroup], next: last }
}

/** How many `changeLog` rows (audit entries and proposals alike) name this row. */
async function changeLogRowsFor(
  ctx: MutationCtx,
  id: Id<'pilots'> | Id<'mechs'> | Id<'crawlers'>
): Promise<number> {
  const rows = await ctx.db
    .query('changeLog')
    .withIndex('by_entity_state_field', (q) => q.eq('entityId', id))
    .collect()
  return rows.length
}

/** What one page of `dedupeAppIds` found, and where the next page starts. */
type DedupePage = {
  scanned: number
  rowsDeleted: number
  orphanedChangeLogRows: number
  groups: GroupReport[]
  /** The last app id this page covered, or null when the table is done. */
  next: string | null
}

/** One page of the duplicate-appId repair. `dedupeAppIds` drives it. */
export const dedupeAppIdsPage = internalMutation({
  args: {
    table: v.union(v.literal('pilots'), v.literal('mechs'), v.literal('crawlers')),
    after: v.optional(v.string()),
    apply: v.boolean(),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DedupePage> => {
    const { rows, next } = await appIdPage(
      ctx,
      args.table,
      args.after,
      args.pageSize ?? DEFAULT_PAGE_SIZE
    )
    const groups: GroupReport[] = []
    let rowsDeleted = 0
    let orphanedChangeLogRows = 0

    for (const [appId, group] of duplicateGroups(rows)) {
      const [keep, ...losers] = rankForKeeping(group)
      if (keep === undefined) continue

      let orphaned = 0
      for (const loser of losers) {
        orphaned += await changeLogRowsFor(ctx, loser._id)
      }

      groups.push({
        table: args.table,
        appId,
        rows: group.length,
        kept: keep._id,
        deleted: losers.map((row) => row._id),
        orphanedChangeLogRows: orphaned,
      })
      orphanedChangeLogRows += orphaned

      if (args.apply) {
        for (const loser of losers) {
          await ctx.db.delete(loser._id)
          rowsDeleted += 1
        }
      }
    }

    return { scanned: rows.length, rowsDeleted, orphanedChangeLogRows, groups, next }
  },
})

type DedupeReport = {
  applied: boolean
  /** Rows carrying an app id that the repair read. Rows with none cannot repeat. */
  scanned: number
  duplicatedAppIds: number
  rowsDeleted: number
  orphanedChangeLogRows: number
  groups: GroupReport[]
}

export const dedupeAppIds = internalAction({
  args: {
    /** Write the deletions. Omitted or false = report only, change nothing. */
    apply: v.optional(v.boolean()),
    /** Rows per page. Only tests have a reason to set it. */
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DedupeReport> => {
    const apply = args.apply === true
    const report: DedupeReport = {
      applied: apply,
      scanned: 0,
      duplicatedAppIds: 0,
      // Honest in dry-run: nothing was deleted, so this is 0 and `groups`
      // carries what *would* go. A report that pre-counted its own hypothetical
      // deletions reads exactly like one that already made them.
      rowsDeleted: 0,
      orphanedChangeLogRows: 0,
      groups: [],
    }

    for (const table of APP_ID_TABLES) {
      let after: string | undefined
      do {
        const page: DedupePage = await ctx.runMutation(internal.maintenance.dedupeAppIdsPage, {
          table,
          after,
          apply,
          pageSize: args.pageSize,
        })
        report.scanned += page.scanned
        report.rowsDeleted += page.rowsDeleted
        report.orphanedChangeLogRows += page.orphanedChangeLogRows
        report.groups.push(...page.groups)
        after = page.next ?? undefined
      } while (after !== undefined)
    }

    report.duplicatedAppIds = report.groups.length
    return report
  },
})

/** Where a paginated walk over a whole table has got to. */
type BackfillPage = { updated: number; cursor: string; isDone: boolean }

/** One page of `backfillGameSummaries`. */
export const backfillGameSummariesPage = internalMutation({
  args: { cursor: v.union(v.string(), v.null()), pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<BackfillPage> => {
    const page = await ctx.db
      .query('games')
      .paginate({ cursor: args.cursor, numItems: args.pageSize ?? DEFAULT_PAGE_SIZE })
    let updated = 0
    for (const game of page.page) {
      // Recomputed even where one exists, so this doubles as a repair should a
      // stored summary ever disagree with the rows.
      if (await refreshGameSummary(ctx, game._id)) updated += 1
    }
    return { updated, cursor: page.continueCursor, isDone: page.isDone }
  },
})

/**
 * Store `games.summary` on every Game — see that column in `schema.ts`.
 * Idempotent: a Game whose stored summary is already right is not written.
 */
export const backfillGameSummaries = internalAction({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ updated: number }> => {
    let updated = 0
    let cursor: string | null = null
    for (;;) {
      const page: BackfillPage = await ctx.runMutation(
        internal.maintenance.backfillGameSummariesPage,
        { cursor, pageSize: args.pageSize }
      )
      updated += page.updated
      if (page.isDone) return { updated }
      cursor = page.cursor
    }
  },
})

const bodyIdTable = v.union(v.literal('mechPatterns'), v.literal('encounterNpcs'))

/** One page of `backfillBodyAppIds`, for one table. */
export const backfillBodyAppIdsPage = internalMutation({
  args: {
    table: bodyIdTable,
    cursor: v.union(v.string(), v.null()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillPage> => {
    const page = await ctx.db
      .query(args.table)
      .paginate({ cursor: args.cursor, numItems: args.pageSize ?? DEFAULT_PAGE_SIZE })
    let updated = 0
    for (const row of page.page) {
      if (row.appId !== undefined) continue
      const appId = bodyAppId(row.body)
      if (appId === undefined) continue
      await ctx.db.patch(row._id, { appId })
      updated += 1
    }
    return { updated, cursor: page.continueCursor, isDone: page.isDone }
  },
})

/**
 * Lift `body.id` into the `appId` column on patterns and NPCs written before
 * the column existed. Until it runs, `findOwnedByAppId` still finds those rows
 * through its fallback; after, the fallback reads an empty range.
 */
export const backfillBodyAppIds = internalAction({
  args: { pageSize: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ updated: number }> => {
    let updated = 0
    for (const table of ['mechPatterns', 'encounterNpcs'] as const) {
      let cursor: string | null = null
      for (;;) {
        const page: BackfillPage = await ctx.runMutation(
          internal.maintenance.backfillBodyAppIdsPage,
          { table, cursor, pageSize: args.pageSize }
        )
        updated += page.updated
        if (page.isDone) break
        cursor = page.cursor
      }
    }
    return { updated }
  },
})
