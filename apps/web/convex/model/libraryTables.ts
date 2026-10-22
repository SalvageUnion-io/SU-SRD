import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literalUnion } from './validators'

/**
 * The Homebrew library's tables (ADR-056), spread into `schema.ts`.
 *
 * The library is an index over things that already exist: a listing names a
 * player's saved pattern or built NPC by kind and app id, and every read goes
 * back to that row for its body, its maker and whether it is still shared by
 * link. So a listing never holds a copy that could outlive its source, and a
 * withdrawn link takes the listing with it (`model/library.ts`).
 */

/** What can be listed: a saved mech pattern or a built NPC. */
export const LIBRARY_KINDS = ['pattern', 'npc'] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]
export const libraryKind = literalUnion(LIBRARY_KINDS)

export const libraryTables = {
  /**
   * One listed thing. Its maker lists and delists it; a site admin hides it.
   *
   * `hidden` is a column of its own (not a timestamp's absence) so the public
   * read is one range on `by_hidden_listed`, newest first. A hidden listing is
   * kept, not deleted, so its maker cannot list it again over the takedown;
   * deleting the thing itself deletes it.
   */
  libraryEntries: defineTable({
    kind: libraryKind,
    appId: v.string(),
    ownerId: v.id('users'),
    listedAt: v.number(),
    hidden: v.boolean(),
    hiddenAt: v.optional(v.number()),
    /** Open reports, kept in step by `library.report` and cleared by a hide or a dismiss. */
    reportCount: v.number(),
  })
    .index('by_hidden_listed', ['hidden', 'listedAt'])
    .index('by_kind_app_id', ['kind', 'appId'])
    .index('by_owner', ['ownerId'])
    .index('by_reported', ['hidden', 'reportCount']),

  /** One signed-in reader's report of one listing: at most one each, the reason replaced on a second. */
  libraryReports: defineTable({
    entryId: v.id('libraryEntries'),
    reporterId: v.id('users'),
    reason: v.string(),
    at: v.number(),
  })
    .index('by_entry_reporter', ['entryId', 'reporterId'])
    .index('by_reporter', ['reporterId']),
}
