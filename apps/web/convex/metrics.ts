import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { internalQuery, query } from './_generated/server'
import { callerIsAdmin, requireAdmin } from './model/admin'
import { internalMutation, mutation } from './model/entities'
import { metricsCounts } from './model/signalTables'

/**
 * Usage metrics (ADR-054): aggregate counts only, read by the admin page
 * (`/build/admin/metrics`) and the Monday report from one query.
 *
 * Convex has no count, and the totals span tables that grow without bound, so
 * they are tallied once a day a page at a time (`tally`, scheduled from
 * `crons.ts`) into a `metricsSnapshots` row, and the reads take the newest.
 * The weekly signals (Downtime runs, bot commands) are counters bumped as they
 * happen (`model/usage.ts`), read straight from `usageCounts`.
 */

/** The tables the tally walks, in order; each stage is one table. */
const STAGES = [
  'users',
  'pilots',
  'mechs',
  'crawlers',
  'npcs',
  'mechPatterns',
  'games',
  'botGuilds',
] as const

/** Rows per tally step: small enough that a page of sheet bodies stays far inside a mutation's read limit. */
const PAGE = 100

/** How many weeks of tallies the reads return, newest first. */
const WEEKS = 8

const WEEK = 7 * 86_400_000

type Counts = Infer<typeof metricsCounts>

const ZERO: Counts = {
  accounts: 0,
  pilots: 0,
  mechs: 0,
  crawlers: 0,
  npcs: 0,
  patterns: 0,
  games: 0,
  sharedGames: 0,
  botGuilds: 0,
  botGuildsThisWeek: 0,
}

/** One week's tallies: `downtime:game`, `bot:su roll` and the rest, by key. */
const weekTally = v.object({ weekStart: v.number(), counts: v.record(v.string(), v.number()) })

const metricsRead = v.object({
  snapshot: v.union(v.object({ takenAt: v.number(), counts: metricsCounts }), v.null()),
  weeks: v.array(weekTally),
})

type MetricsRead = Infer<typeof metricsRead>

/** The newest snapshot and the last `WEEKS` weeks of tallies: the one read both readers share. */
async function readMetrics(ctx: QueryCtx): Promise<MetricsRead> {
  const snapshot = await ctx.db
    .query('metricsSnapshots')
    .withIndex('by_taken')
    .order('desc')
    .first()
  const latest = await ctx.db.query('usageCounts').withIndex('by_week').order('desc').first()
  const weeks: MetricsRead['weeks'] = []
  if (latest !== null) {
    const since = latest.weekStart - (WEEKS - 1) * WEEK
    const byWeek = new Map<number, Record<string, number>>()
    for await (const row of ctx.db
      .query('usageCounts')
      .withIndex('by_week', (q) => q.gte('weekStart', since))
      .order('desc')) {
      const counts = byWeek.get(row.weekStart) ?? {}
      counts[row.key] = (counts[row.key] ?? 0) + row.count
      byWeek.set(row.weekStart, counts)
    }
    for (const [weekStart, counts] of byWeek) weeks.push({ weekStart, counts })
  }
  return {
    snapshot: snapshot === null ? null : { takenAt: snapshot.takenAt, counts: snapshot.counts },
    weeks,
  }
}

/** The metrics, for an admin; null for anybody else, signed in or not. */
export const forAdmin = query({
  args: {},
  returns: v.union(metricsRead, v.null()),
  handler: async (ctx) => ((await callerIsAdmin(ctx)) ? await readMetrics(ctx) : null),
})

/**
 * The same read for the Monday report, which runs it with the deployment's key
 * (`convex run metrics:report`) rather than calling it from code.
 *
 * @operator
 */
export const report = internalQuery({
  args: {},
  returns: metricsRead,
  handler: readMetrics,
})

/** Take a fresh snapshot now rather than at the night's tally. Admins only. */
export const refresh = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx)
    await ctx.scheduler.runAfter(0, internal.metrics.tally, {})
    return null
  },
})

/**
 * One step of the tally: count one page of one table into `counts`, then
 * schedule the next page, or the next table, or write the snapshot. The
 * running counts ride in the arguments, so no step holds more than its page.
 */
export const tally = internalMutation({
  args: {
    stage: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    counts: v.optional(metricsCounts),
    startedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const stage = args.stage ?? 0
    const counts = { ...(args.counts ?? ZERO) }
    const startedAt = args.startedAt ?? Date.now()
    const table = STAGES[stage]
    if (table === undefined) {
      await ctx.db.insert('metricsSnapshots', { takenAt: startedAt, counts })
      return null
    }

    const page = await ctx.db.query(table).paginate({ cursor: args.cursor ?? null, numItems: PAGE })
    for (const row of page.page) {
      switch (table) {
        case 'users':
          if (!('isAnonymous' in row && row.isAnonymous === true)) counts.accounts += 1
          break
        case 'mechPatterns':
          counts.patterns += 1
          break
        case 'games': {
          counts.games += 1
          const members =
            'summary' in row && row.summary !== undefined
              ? row.summary.memberCount
              : (
                  await ctx.db
                    .query('memberships')
                    .withIndex('by_game', (q) => q.eq('gameId', row._id as Id<'games'>))
                    .take(2)
                ).length
          if (members >= 2) counts.sharedGames += 1
          break
        }
        case 'botGuilds':
          counts.botGuilds += 1
          if ('lastSeenAt' in row && row.lastSeenAt >= startedAt - WEEK) {
            counts.botGuildsThisWeek += 1
          }
          break
        default:
          counts[table] += 1
      }
    }

    await ctx.scheduler.runAfter(
      0,
      internal.metrics.tally,
      page.isDone
        ? { stage: stage + 1, cursor: null, counts, startedAt }
        : { stage, cursor: page.continueCursor, counts, startedAt }
    )
    return null
  },
})
