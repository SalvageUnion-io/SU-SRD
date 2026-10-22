import { defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Homebrew's moderation tables (ADR-057), spread into `schema.ts`.
 *
 * Homebrew itself is no table: it is every saved pattern its maker shares with
 * "Anyone with the link" (`mechPatterns.publicRead`). These hold only what a
 * reader and a site admin add to one: its reports, and whether it is hidden.
 * Both are keyed by the pattern's row, so a takedown outlives its link being
 * withdrawn and shared again, and deleting the pattern deletes them
 * (`model/homebrew.ts`).
 */
export const homebrewTables = {
  /** A pattern's open reports and its takedown; written on its first report or hide. */
  homebrewModeration: defineTable({
    patternId: v.id('mechPatterns'),
    hidden: v.boolean(),
    hiddenAt: v.optional(v.number()),
    /** Open reports, kept in step by `homebrew.report` and cleared by a hide or a dismiss. */
    reportCount: v.number(),
  })
    .index('by_pattern', ['patternId'])
    .index('by_hidden', ['hidden', 'hiddenAt'])
    .index('by_reported', ['hidden', 'reportCount']),

  /** One signed-in reader's report of one pattern: at most one each, the reason replaced on a second. */
  homebrewReports: defineTable({
    patternId: v.id('mechPatterns'),
    reporterId: v.id('users'),
    reason: v.string(),
    at: v.number(),
  })
    .index('by_pattern_reporter', ['patternId', 'reporterId'])
    .index('by_reporter', ['reporterId']),
}
