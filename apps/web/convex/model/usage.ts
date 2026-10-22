import type { MutationCtx } from '../_generated/server'

/**
 * The weekly usage tallies (ADR-054): one counter per signal per week, bumped
 * by the write that is the signal (a Downtime begun, a bot command answered).
 * A counter, never a log: it records that something happened, not who did it.
 */

const DAY = 86_400_000

/** Monday 00:00 UTC of the week `at` falls in: the key every tally files under. */
export function weekStartOf(at: number): number {
  const day = Math.floor(at / DAY)
  // 1 January 1970 was a Thursday: day 0 is three days after a Monday.
  const sinceMonday = (day + 3) % 7
  return (day - sinceMonday) * DAY
}

/** Add one to `key`'s tally for the week of `at`. */
export async function bumpCount(ctx: MutationCtx, key: string, at = Date.now()): Promise<void> {
  const weekStart = weekStartOf(at)
  const row = await ctx.db
    .query('usageCounts')
    .withIndex('by_key_week', (q) => q.eq('key', key).eq('weekStart', weekStart))
    .unique()
  if (row === null) await ctx.db.insert('usageCounts', { key, weekStart, count: 1 })
  else await ctx.db.patch(row._id, { count: row.count + 1 })
}

/** Note that the bot answered in Discord server `guildId` at `at`. */
export async function touchGuild(
  ctx: MutationCtx,
  guildId: string,
  at = Date.now()
): Promise<void> {
  const row = await ctx.db
    .query('botGuilds')
    .withIndex('by_guild', (q) => q.eq('guildId', guildId))
    .unique()
  if (row === null) await ctx.db.insert('botGuilds', { guildId, firstSeenAt: at, lastSeenAt: at })
  // An hour's precision is plenty for a weekly count, and saves a write per command.
  else if (at - row.lastSeenAt > DAY / 24) await ctx.db.patch(row._id, { lastSeenAt: at })
}
