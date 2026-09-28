import { v } from 'convex/values'
import { containerOf, SHELF, sameContainer } from '../src/lib/container'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalAction } from './_generated/server'
import { internalMutation, PARSERS } from './model/entities'

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
 * ## The container repair
 *
 * `repairContainers` makes every owned body name the container its row is
 * filed in. It runs once, from `.github/workflows/convex-maintenance.yml`:
 *
 *     bunx convex run maintenance:repairContainers --prod
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

/** The tables whose body carries a container the client reads, with their parsers. */
const CONTAINED = {
  pilots: PARSERS.pilots,
  mechs: PARSERS.mechs,
  crawlers: PARSERS.crawlers,
} as const
type ContainedTable = keyof typeof CONTAINED

/** What one page of `repairContainers` did, and where the next page starts. */
type RepairPage = { repaired: number; skipped: number; cursor: string; isDone: boolean }

/**
 * One page of `repairContainers`, for one table: `body.gameId := row.gameId`
 * on every owned row whose body names a different container.
 *
 * The column is the authority because it is what the server enforces
 * ownership and container against, so repairing toward it needs no membership
 * lookup and cannot move an entity somewhere it was not already filed. Bodies
 * are compared through `containerOf`, because a pre-ADR-030 body has no
 * `gameId` and resolves through `workspaceId`.
 *
 * Unowned rows (a communal crawler, an unclaimed pre-gen) are the table's, not
 * a player's, and are left alone. A body that no longer parses is counted as
 * skipped and left exactly as it is.
 */
export const repairContainersPage = internalMutation({
  args: {
    table: v.union(v.literal('pilots'), v.literal('mechs'), v.literal('crawlers')),
    cursor: v.union(v.string(), v.null()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RepairPage> => {
    const page = await ctx.db
      .query(args.table)
      .paginate({ cursor: args.cursor, numItems: args.pageSize ?? DEFAULT_PAGE_SIZE })
    let repaired = 0
    let skipped = 0

    for (const row of page.page) {
      if (!row.ownerId) continue
      const body = row.body as Record<string, unknown> | null
      if (typeof body !== 'object' || body === null) {
        skipped += 1
        continue
      }

      const declared = row.gameId === null ? SHELF : { kind: 'game' as const, gameId: row.gameId }
      if (sameContainer(containerOf(body), declared)) continue

      const parsed = CONTAINED[args.table].safeParse({ ...body, gameId: row.gameId ?? null })
      if (!parsed.success) {
        skipped += 1
        continue
      }

      await ctx.db.patch(row._id, { body: parsed.data, updatedAt: Date.now() })
      repaired += 1
    }

    return { repaired, skipped, cursor: page.continueCursor, isDone: page.isDone }
  },
})

type RepairReport = {
  repaired: number
  skipped: number
  byKind: Partial<Record<ContainedTable, number>>
}

/**
 * Repair every owned body whose container disagrees with its row, across all
 * accounts. Idempotent: a repaired body agrees with its row, so a second run
 * reports `repaired: 0`.
 */
export const repairContainers = internalAction({
  args: {
    /** Rows per page. Only tests have a reason to set it. */
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RepairReport> => {
    const report: RepairReport = { repaired: 0, skipped: 0, byKind: {} }
    for (const table of ['pilots', 'mechs', 'crawlers'] as const) {
      let cursor: string | null = null
      for (;;) {
        const page: RepairPage = await ctx.runMutation(internal.maintenance.repairContainersPage, {
          table,
          cursor,
          pageSize: args.pageSize,
        })
        report.repaired += page.repaired
        report.skipped += page.skipped
        if (page.repaired > 0) report.byKind[table] = (report.byKind[table] ?? 0) + page.repaired
        if (page.isDone) break
        cursor = page.cursor
      }
    }
    return report
  },
})
