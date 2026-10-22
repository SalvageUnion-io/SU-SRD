import { defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * The Mediator's prep (ADR-053), spread into `schema.ts`: encounters built on
 * a shelf, and the one a Game is running. Split out like `playTables.ts`, and
 * the rules in `schema.ts`'s header hold here too: each body is `v.any()` and
 * parsed at the edge (`EncounterSchema`, `RunningEncounterSchema`).
 */
export const prepTables = {
  /**
   * An encounter: opposition, tables and notes, on its maker's shelf. Always
   * owned and never in a Game, so it carries no `gameId`: running one copies
   * it into the Game (`mediator.runEncounter`), it does not move.
   */
  encounters: defineTable({
    ownerId: v.id('users'),
    /** `body.id`, lifted into a column as `mechPatterns.appId` is, for one read per write. */
    appId: v.string(),
    body: v.any(),
  })
    // `ownerId` alone is a prefix, so this also serves "all of mine".
    .index('by_owner_app_id', ['ownerId', 'appId']),

  /**
   * The encounter a Game is running: its name, tables and notes, copied when
   * it was run. One row per Game at most, read and written by its Mediator
   * alone, like the tray (ADR-030 §5). Part of the Game's apparatus, so it
   * goes with the Game (`GAME_APPARATUS_TABLES`).
   */
  runningEncounters: defineTable({
    gameId: v.id('games'),
    body: v.any(),
  }).index('by_game', ['gameId']),
}
