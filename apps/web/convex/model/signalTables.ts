import { defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * The tables behind the site's usage signals and feedback (ADR-055), spread
 * into `schema.ts` like `playTables`. None of them holds anything about a
 * person but `feedback`, and that only until the day is out.
 */

/** Where a piece of feedback came from: the app's "Suggest or report", or `/su feedback`. */
export const feedbackSource = v.union(v.literal('app'), v.literal('bot'))

/** What a piece of feedback is: an idea, or something broken. */
export const feedbackKind = v.union(v.literal('suggestion'), v.literal('report'))

/** One metrics snapshot's counts (`metrics.ts`), as the admin page and the Monday report read them. */
export const metricsCounts = v.object({
  /** Accounts that have signed in (anonymous rows left out). */
  accounts: v.number(),
  pilots: v.number(),
  mechs: v.number(),
  crawlers: v.number(),
  npcs: v.number(),
  patterns: v.number(),
  games: v.number(),
  /** Games with two or more members: tables that actually play together. */
  sharedGames: v.number(),
  /** Discord servers the bot has answered a command in, ever. */
  botGuilds: v.number(),
  /** Of those, the servers it answered in during the seven days before the snapshot. */
  botGuildsThisWeek: v.number(),
})

export const signalTables = {
  /**
   * A weekly tally per signal (`model/usage.ts`): `downtime:game`,
   * `downtime:solo`, `bot:<command>`. A week is keyed by its Monday 00:00 UTC.
   * One counter row per key per week; never who did it.
   */
  usageCounts: defineTable({
    key: v.string(),
    weekStart: v.number(),
    count: v.number(),
  })
    .index('by_key_week', ['key', 'weekStart'])
    .index('by_week', ['weekStart']),

  /**
   * The Discord servers the bot has answered a command in, by id, with when it
   * first and last did. A server's id, never a member's: the distinct-server
   * count is these rows.
   */
  botGuilds: defineTable({
    guildId: v.string(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
  }).index('by_guild', ['guildId']),

  /** A daily snapshot of the totals (`metrics.tally`); the newest is the one read. */
  metricsSnapshots: defineTable({
    takenAt: v.number(),
    counts: metricsCounts,
  }).index('by_taken', ['takenAt']),

  /**
   * Feedback on its way to a labelled GitHub issue (`feedback.ts`). The text
   * is cleared once the issue is filed; the row stays until it is a day old so
   * the per-sender limit can count it, and the hourly sweep then deletes it.
   * `sender` is the account or the Discord id, held for that limit alone.
   */
  feedback: defineTable({
    sender: v.string(),
    source: feedbackSource,
    kind: feedbackKind,
    /** The words, until filed. */
    text: v.union(v.string(), v.null()),
    /** The page it was sent from (app) or null (bot). */
    page: v.union(v.string(), v.null()),
    createdAt: v.number(),
    /** The GitHub issue number once filed; null while it waits. */
    issue: v.union(v.number(), v.null()),
    attempts: v.number(),
    /** When a filing claimed it (`feedback.claim`); absent while nothing holds it. */
    filingSince: v.optional(v.number()),
  })
    .index('by_sender_created', ['sender', 'createdAt'])
    .index('by_issue', ['issue'])
    .index('by_created', ['createdAt']),
}
