/**
 * Usage metrics in the shared database (ADR-057): aggregate counts only, read
 * by the admin page (`/build/admin/metrics`) and the Monday report.
 *
 * - **Weekly counters** are bumped by the write that is the signal (a Downtime
 *   begun, a bot command answered): `bumpUsage`, and `touchGuild` for the
 *   servers the bot answered in.
 * - **Totals** are each account room's own (`putAccountTotals`) and each Game
 *   room's own (`games`), summed on every read (`readMetrics`), so no read
 *   walks the rooms and nothing is stored twice.
 */

import type { SharedDb } from './db'

const DAY = 86_400_000

const WEEK = 7 * DAY

/** How many weeks of tallies the reads return, newest first. */
const WEEKS = 8

/** The usage totals, as the admin page and the Monday report read them. */
type MetricsCounts = {
  /** Accounts that have signed in. */
  accounts: number
  pilots: number
  mechs: number
  crawlers: number
  npcs: number
  patterns: number
  games: number
  /** Games with two or more members: tables that actually play together. */
  sharedGames: number
  /** Discord servers the bot has answered a command in, ever. */
  botGuilds: number
  /** Of those, the servers it answered in during the seven days before the read. */
  botGuildsThisWeek: number
}

/** Today's totals and the last weeks' tallies: the one read both readers share. */
export type MetricsRead = {
  totals: MetricsCounts
  weeks: { weekStart: number; counts: Record<string, number> }[]
}

/** One account's totals, as its room counts them. */
export type AccountTotals = {
  discordId: string
  pilots: number
  mechs: number
  crawlers: number
  npcs: number
  patterns: number
}

/** Monday 00:00 UTC of the week `at` falls in: the key every tally files under. */
export function weekStartOf(at: number): number {
  const day = Math.floor(at / DAY)
  // 1 January 1970 was a Thursday: day 0 is three days after a Monday.
  const sinceMonday = (day + 3) % 7
  return (day - sinceMonday) * DAY
}

/** Add one to `key`'s tally for the week of `at`. A counter, never a log. */
export async function bumpUsage(db: SharedDb, key: string, at = Date.now()) {
  await db
    .prepare(
      `insert into usage_counts (key, week_start, count) values (?1, ?2, 1)
       on conflict (key, week_start) do update set count = count + 1`
    )
    .bind(key, weekStartOf(at))
    .run()
}

/** Note that the bot answered in Discord server `guildId` at `at`. */
export async function touchGuild(db: SharedDb, guildId: string, at = Date.now()) {
  // An hour's precision is plenty for a weekly count, and saves a write per command.
  await db
    .prepare(
      `insert into bot_guilds (guild_id, first_seen_at, last_seen_at) values (?1, ?2, ?2)
       on conflict (guild_id) do update set last_seen_at = excluded.last_seen_at
       where excluded.last_seen_at - last_seen_at > ?3`
    )
    .bind(guildId, at, DAY / 24)
    .run()
}

/** Write an account's totals, or replace them: its room calls this when one changes. */
export async function putAccountTotals(db: SharedDb, totals: AccountTotals, now = Date.now()) {
  await db
    .prepare(
      `insert into account_totals (discord_id, pilots, mechs, crawlers, npcs, patterns, updated_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       on conflict (discord_id) do update set
         pilots = excluded.pilots, mechs = excluded.mechs, crawlers = excluded.crawlers,
         npcs = excluded.npcs, patterns = excluded.patterns, updated_at = excluded.updated_at`
    )
    .bind(
      totals.discordId,
      totals.pilots,
      totals.mechs,
      totals.crawlers,
      totals.npcs,
      totals.patterns,
      now
    )
    .run()
}

/** An account is gone: it counts no more. */
export async function dropAccountTotals(db: SharedDb, discordId: string) {
  await db.prepare('delete from account_totals where discord_id = ?1').bind(discordId).run()
}

/** Today's totals, counted at `now`: every unit, on a Shelf or in a Game. */
async function countTotals(db: SharedDb, now: number): Promise<MetricsCounts> {
  const counts = await db
    .prepare(
      `select
         (select count(*) from account_totals) as accounts,
         (select coalesce(sum(pilots), 0) from account_totals)
           + (select coalesce(sum(pilots), 0) from games) as pilots,
         (select coalesce(sum(mechs), 0) from account_totals)
           + (select coalesce(sum(mechs), 0) from games) as mechs,
         (select coalesce(sum(crawlers), 0) from account_totals)
           + (select coalesce(sum(crawlers), 0) from games) as crawlers,
         (select coalesce(sum(npcs), 0) from account_totals)
           + (select coalesce(sum(npcs), 0) from games) as npcs,
         (select coalesce(sum(patterns), 0) from account_totals) as patterns,
         (select count(*) from games) as games,
         (select count(*) from (select game_id from memberships group by game_id
            having count(*) >= 2)) as sharedGames,
         (select count(*) from bot_guilds) as botGuilds,
         (select count(*) from bot_guilds where last_seen_at >= ?1) as botGuildsThisWeek`
    )
    .bind(now - WEEK)
    .first<MetricsCounts>()
  // One row of subqueries: there is always an answer.
  return counts as MetricsCounts
}

/** Today's totals and the last `WEEKS` weeks of tallies. */
export async function readMetrics(db: SharedDb, now = Date.now()): Promise<MetricsRead> {
  const [totals, latest] = await Promise.all([
    countTotals(db, now),
    db
      .prepare('select max(week_start) as week_start from usage_counts')
      .first<{ week_start: number | null }>(),
  ])
  const weeks: MetricsRead['weeks'] = []
  if (latest?.week_start != null) {
    const { results } = await db
      .prepare(
        `select week_start, key, count from usage_counts where week_start >= ?1
         order by week_start desc, key`
      )
      .bind(latest.week_start - (WEEKS - 1) * WEEK)
      .all<{ week_start: number; key: string; count: number }>()
    const byWeek = new Map<number, Record<string, number>>()
    for (const row of results) {
      const counts = byWeek.get(row.week_start) ?? {}
      counts[row.key] = row.count
      byWeek.set(row.week_start, counts)
    }
    for (const [weekStart, counts] of byWeek) weeks.push({ weekStart, counts })
  }
  return { totals, weeks }
}

/**
 * An account room's row in the totals: written after a change, and only when
 * a count moved since the last write, so most changes write nothing.
 */
export class AccountTotalsWriter {
  private written = ''

  constructor(
    private readonly db: SharedDb | undefined,
    private readonly current: () => AccountTotals | null
  ) {}

  async write(now = Date.now()): Promise<void> {
    const totals = this.current()
    if (this.db === undefined || totals === null) return
    const key = JSON.stringify(totals)
    if (key === this.written) return
    this.written = key
    try {
      await putAccountTotals(this.db, totals, now)
    } catch (error) {
      this.written = ''
      console.error('writing account totals failed', totals.discordId, error)
    }
  }
}
