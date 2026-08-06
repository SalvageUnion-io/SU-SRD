import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'

/**
 * One-off repairs that operate on the whole deployment.
 *
 * Everything here is an `internalMutation`: not reachable from any client, only
 * from `bunx convex run` with deployment credentials. That is deliberate — these
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
 */

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

/** Rows of one table grouped by app id, keeping only the genuinely duplicated. */
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

/** How many `changeLog` rows (audit entries and proposals alike) name this row. */
async function changeLogRowsFor(
  ctx: MutationCtx,
  id: Id<'pilots'> | Id<'mechs'> | Id<'crawlers'>
): Promise<number> {
  const rows = await ctx.db
    .query('changeLog')
    .withIndex('by_entity', (q) => q.eq('entityId', id))
    .collect()
  return rows.length
}

export const dedupeAppIds = internalMutation({
  args: {
    /** Write the deletions. Omitted or false = report only, change nothing. */
    apply: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    applied: boolean
    scanned: number
    duplicatedAppIds: number
    rowsDeleted: number
    orphanedChangeLogRows: number
    groups: GroupReport[]
  }> => {
    const apply = args.apply === true
    const groups: GroupReport[] = []
    let scanned = 0
    let rowsDeleted = 0
    let orphanedChangeLogRows = 0

    for (const table of APP_ID_TABLES) {
      /*
       * A full scan, on purpose: the whole question is "which app ids appear
       * more than once", and an index on `appId` answers "where is this one"
       * rather than "which are repeated". These tables hold one row per built
       * character, so the scan is small — but it is a scan, and if these ever
       * grow to where `.collect()` strains, this becomes a paginated job rather
       * than a bigger read.
       */
      const rows = (await ctx.db.query(table).collect()) as Row[]
      scanned += rows.length

      for (const [appId, group] of duplicateGroups(rows)) {
        const [keep, ...losers] = rankForKeeping(group)
        if (keep === undefined) continue

        let orphaned = 0
        for (const loser of losers) {
          orphaned += await changeLogRowsFor(ctx, loser._id)
        }

        groups.push({
          table,
          appId,
          rows: group.length,
          kept: keep._id,
          deleted: losers.map((row) => row._id),
          orphanedChangeLogRows: orphaned,
        })
        orphanedChangeLogRows += orphaned

        if (apply) {
          for (const loser of losers) {
            await ctx.db.delete(loser._id)
            rowsDeleted += 1
          }
        }
      }
    }

    return {
      applied: apply,
      scanned,
      duplicatedAppIds: groups.length,
      // Honest in dry-run: nothing was deleted, so this is 0 and `groups`
      // carries what *would* go. A report that pre-counted its own hypothetical
      // deletions reads exactly like one that already made them.
      rowsDeleted,
      orphanedChangeLogRows,
      groups,
    }
  },
})
