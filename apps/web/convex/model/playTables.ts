import { defineTable } from 'convex/server'
import type { GenericId } from 'convex/values'
import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Seat } from 'game-domain/schemas/seat'
import { SeatSchema } from 'game-domain/schemas/seat'
import { mirrors } from './validators'

/**
 * Play's tables (ADR-051), spread into `schema.ts`: the Discord channel
 * bindings, the Game's Downtime and the pilot's seat, with the seat's
 * validators the function modules take their arguments against. Split out of
 * `schema.ts` to hold it under its file-size budget; the rules in that file's
 * header hold here too.
 */

/**
 * `RANGE_BANDS` (game-domain/schemas/seat) — ADR-038. Exported so `seats.setRange`
 * takes its argument against this same union.
 */
export const seatRange = zodToConvex(SeatSchema.shape.range)

/** A `Seat` as its row stores it: the Game and the owner are Convex ids, still optional. */
type SeatRow = {
  [K in keyof Seat]: K extends 'gameId'
    ? GenericId<'games'> | Exclude<Seat[K], string>
    : K extends 'ownerId'
      ? GenericId<'users'> | Exclude<Seat[K], string>
      : Seat[K]
}

/** `SeatMount` (game-domain/schemas/seat). Exported for `seats.forGame`'s answer. */
export const seatMount = zodToConvex(SeatSchema.shape.mount)

/**
 * `SeatResolving` (game-domain/schemas/seat). Exported so `seats.setResolving`
 * takes its argument against this same validator.
 */
export const seatResolving = zodToConvex(SeatSchema.shape.resolving.unwrap())

/** `SoloDowntime` (game-domain/schemas/seat). Exported for the solo seat reads. */
export const soloDowntime = zodToConvex(SeatSchema.shape.downtime.unwrap())

/** One pilot's claim on one Downtime step (`downtime.claimStep`). */
export const downtimeClaim = v.object({ pilotId: v.string(), stepIndex: v.number() })

export const playTables = {
  /** The Discord channel Play's rolls post to (`/su bind`): a Game's, or with no `gameId` one person's solo play (`model/channelBindings.ts`). */
  channelBindings: defineTable({
    gameId: v.optional(v.id('games')),
    channelId: v.string(),
    /** The channel's name when bound (no `#`); absent on older rows or when Discord sent none. */
    channelName: v.optional(v.string()),
    boundBy: v.id('users'),
    boundAt: v.number(),
  })
    .index('by_channel', ['channelId'])
    .index('by_game', ['gameId', 'boundBy']),

  /**
   * Crew-wide Downtime state (ADR-030).
   *
   * Downtime is the one procedure the whole crew performs in step, so the phase
   * is **Game state advanced by the Mediator** rather than something each
   * player tracks alone. Per-player step completion lives here too, so the
   * table can see who is still working.
   *
   * One row per Game. `stepIndex: null` means Downtime is not running — which
   * is a state, not an absence, and is why this is not simply the row's absence.
   */
  downtime: defineTable({
    gameId: v.id('games'),
    /** Null when Downtime is not running. */
    stepIndex: v.union(v.number(), v.null()),
    startedAt: v.union(v.number(), v.null()),
    /**
     * Which members have marked the current step done. Cleared whenever the
     * phase advances — completion is per step, not cumulative, or a player who
     * finished step 1 would look finished forever.
     */
    completedBy: v.array(v.id('users')),
    /** Set once per Downtime so crawler upkeep is spent once, not per member. */
    upkeepSpent: v.boolean(),
    /**
     * Each step a pilot has applied or skipped this Downtime
     * (`downtime.claimStep`), so a step's Apply runs once per pilot: Undo,
     * the Mediator's Back and a reload never offer it again. Per pilot, not
     * per member (a member may run two). Cleared when a Downtime ends or a
     * fresh one begins, never by a step change or Undo;
     * absent on a row written before it existed, which reads as none.
     */
    claimed: v.optional(v.array(downtimeClaim)),
  }).index('by_game', ['gameId']),

  /**
   * A pilot's seat: its play state at a Game (ADR-038 §2) or solo, on its
   * owner's shelf. Mirrors `game-domain/schemas/seat` column for column,
   * which says what each means (the Game and owner are Convex ids here). A
   * Game seat carries `gameId`, one per pilot, and every member reads it; a
   * solo seat carries `ownerId` instead (a template pre-gen's body id repeats
   * across accounts), and only its owner reads it. Only someone who may write
   * the pilot writes its seat. A Game seat's Downtime is the `downtime` row.
   */
  seats: defineTable(
    mirrors<SeatRow>()(
      v.object({
        gameId: v.optional(v.id('games')),
        ownerId: v.optional(v.id('users')),
        pilotId: v.string(),
        mount: seatMount,
        range: seatRange,
        activeEffects: v.array(v.string()),
        resolving: v.optional(seatResolving),
        ejected: v.optional(v.boolean()),
        downtime: v.optional(soloDowntime),
        lastSeenAt: v.optional(v.number()),
        updatedAt: v.number(),
      })
    )
  )
    // Each key alone is a prefix: a Game's seats in one read (solo seats sit
    // under an absent `gameId`), and one account's solo seats (Game seats
    // under an absent `ownerId`); one seat by both.
    .index('by_game_pilot', ['gameId', 'pilotId'])
    .index('by_owner_pilot', ['ownerId', 'pilotId']),
}
