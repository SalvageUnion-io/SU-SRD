import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Homebrew's shared reads and writes (ADR-056): a pattern's moderation row,
 * and the clean-up when a pattern or a reporter goes.
 */

type AnyCtx = QueryCtx | MutationCtx

/** A pattern's moderation row, or null while nobody has reported or hidden it. */
export async function moderationOf(
  ctx: AnyCtx,
  patternId: Id<'mechPatterns'>
): Promise<Doc<'homebrewModeration'> | null> {
  return await ctx.db
    .query('homebrewModeration')
    .withIndex('by_pattern', (q) => q.eq('patternId', patternId))
    .first()
}

/** The ids of every hidden pattern: the few a site admin took down. */
export async function hiddenPatternIds(ctx: AnyCtx): Promise<Set<Id<'mechPatterns'>>> {
  const rows = await ctx.db
    .query('homebrewModeration')
    .withIndex('by_hidden', (q) => q.eq('hidden', true))
    .collect()
  return new Set(rows.map((row) => row.patternId))
}

/** Delete a pattern's reports, and its moderation row with them when `all`. */
export async function deletePatternReports(
  ctx: MutationCtx,
  patternId: Id<'mechPatterns'>,
  { all }: { all: boolean }
) {
  const reports = await ctx.db
    .query('homebrewReports')
    .withIndex('by_pattern_reporter', (q) => q.eq('patternId', patternId))
    .collect()
  for (const report of reports) await ctx.db.delete(report._id)
  const row = await moderationOf(ctx, patternId)
  if (row === null) return
  if (all) await ctx.db.delete(row._id)
  else await ctx.db.patch(row._id, { reportCount: 0 })
}

/** Delete every report one account made, each pattern's count with it: the account is going. */
export async function deleteReportsBy(ctx: MutationCtx, reporterId: Id<'users'>) {
  const reports = await ctx.db
    .query('homebrewReports')
    .withIndex('by_reporter', (q) => q.eq('reporterId', reporterId))
    .collect()
  for (const report of reports) {
    await ctx.db.delete(report._id)
    const row = await moderationOf(ctx, report.patternId)
    if (row !== null && row.reportCount > 0) {
      await ctx.db.patch(row._id, { reportCount: row.reportCount - 1 })
    }
  }
}
