import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { BOUNDARY_KINDS } from 'game-domain/games/safety'
import { literalUnion } from './validators'

/**
 * A Game's Safety Protocols (Core Book pp.12-13), spread into `schema.ts` like
 * `playTables`: its boundaries and its Stop Sign (`safety.ts`). Both go with
 * the Game (`GAME_APPARATUS_TABLES`).
 */

/** `BOUNDARY_KINDS` (game-domain/games/safety): Out of Bounds, or Off Camera. */
export const boundaryKind = literalUnion(BOUNDARY_KINDS)

export const safetyTables = {
  /**
   * One boundary on one of a Game's two lists. Any member adds one; who did
   * is kept so they can take it back, and is never shown to the table.
   */
  boundaries: defineTable({
    gameId: v.id('games'),
    kind: boundaryKind,
    text: v.string(),
    addedBy: v.id('users'),
    addedAt: v.number(),
  }).index('by_game', ['gameId', 'addedAt']),

  /**
   * A Game's Stop Sign and how it reaches Discord: one row per Game, written
   * the first time either is set. `stop` is set while the game is paused;
   * `shownBy` is kept so whoever showed it may lift it, never shown to the
   * table. `postToChannel` is the table runner's opt-in to a post in the
   * Game's bound channel; absent reads as off. `postedAt` is the last such
   * post, so a sign shown again and again posts at most once a minute.
   */
  safety: defineTable({
    gameId: v.id('games'),
    stop: v.union(v.object({ shownBy: v.id('users'), shownAt: v.number() }), v.null()),
    postToChannel: v.optional(v.boolean()),
    postedAt: v.optional(v.number()),
  }).index('by_game', ['gameId']),
}
