import { z } from 'salvageunion-reference/zod'

/**
 * A pilot's seat: its play state, in a Game (shared with the crew and saved on
 * the Game, [ADR-038](../../../../docs/adr/038-dashboard-game-surface.md) §2)
 * or solo, on its owner's shelf (Play's solo screen).
 *
 * One seat per pilot, not per member: a member covering for an absent player
 * runs two. A seat points at its pilot and boarded mech by app id, the way
 * soft-link ends do, and is never a field on either record. That keeps mount
 * state out of sheets and public sheets.
 *
 * This is the source of truth for `seats` in `apps/web/convex/schema.ts`: its
 * range, mount and resolve validators are built from the schemas below
 * (`zodToConvex`), and the row is checked against `Seat` when it compiles.
 *
 * A Game seat carries `gameId`; a solo seat carries `ownerId` instead (the
 * shelf it sits on, as a shelf row is `gameId` null + `ownerId`), so it is one
 * per pilot. A Game seat has no "in Downtime": that is the Game's `downtime`
 * row. A solo seat runs its own (`downtime`), since nobody else is at the
 * table. The deck action being resolved is on it, as an optional field, so a
 * reload mid-roll keeps the roll and the crew watches it live.
 */

/** Self-declared engagement range band. */
export const RANGE_BANDS = ['Close', 'Medium', 'Long', 'Far'] as const
const RangeBandSchema = z.enum(RANGE_BANDS)
export type RangeBand = z.infer<typeof RangeBandSchema>

/** On foot, or boarded in one mech (by app id). */
const SeatMountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('foot') }),
  z.object({ kind: z.literal('boarded'), mechId: z.string().min(1) }),
])
export type SeatMount = z.infer<typeof SeatMountSchema>

/** The Core Mechanic's five bands, as `salvageunion-reference/rules` names them. */
export const CORE_ROLL_BAND_NAMES = ['nailed', 'success', 'tough', 'failure', 'cascade'] as const

/**
 * The deck action in progress: which one, and how far the player has got.
 *
 * `ref` is the deck's key for the action and `name` what the crew reads
 * ("Rook is resolving Crush"). Activating, rolling and applying are separate
 * flags because the flow is not a line: a player may roll before activating,
 * and Push replaces the roll. The rest of a resolve (a Hot X, the EP-or-AP
 * choice) stays on the screen that is showing it.
 */
const SeatResolvingSchema = z.object({
  ref: z.string().min(1),
  name: z.string(),
  activated: z.boolean(),
  roll: z.object({ roll: z.number(), band: z.enum(CORE_ROLL_BAND_NAMES) }).optional(),
  applied: z.boolean(),
})
export type SeatResolving = z.infer<typeof SeatResolvingSchema>

/**
 * A solo seat's Downtime, absent while none is running: the step it is on,
 * when it began, and whether its crawler upkeep is paid. Upkeep is paid once
 * per Downtime: only a fresh Downtime clears the flag, never a step change.
 * Which steps are done is read off their step ops (ADR-063 §6); `doneSteps`
 * is no longer written, kept so seats written before still parse.
 */
const SoloDowntimeSchema = z.object({
  stepIndex: z.number().int().min(0),
  startedAt: z.number(),
  upkeepSpent: z.boolean(),
  doneSteps: z.array(z.number().int().min(0)).optional(),
})

export const SeatSchema = z.object({
  /** The Game's Convex id; absent on a solo seat. */
  gameId: z.string().min(1).optional(),
  /** A solo seat's owner (whose shelf it is on); absent on a Game seat. */
  ownerId: z.string().min(1).optional(),
  /** The pilot's app id. */
  pilotId: z.string().min(1),
  mount: SeatMountSchema,
  range: RangeBandSchema,
  /** Refs of the activated contributions that are switched on (ADR-029 §4). */
  activeEffects: z.array(z.string()),
  /** The deck action being resolved; absent when none is. */
  resolving: SeatResolvingSchema.optional(),
  /** Set by an Eject, cleared by the next Board or Dismount; absent when not ejected. */
  ejected: z.boolean().optional(),
  /** A solo seat's Downtime; absent on a Game seat and while none runs. */
  downtime: SoloDowntimeSchema.optional(),
  /**
   * A retired presence stamp, kept so stored rows still parse; presence is
   * the Game room's now. Not play state: it never moves `updatedAt`.
   */
  lastSeenAt: z.number().optional(),
  updatedAt: z.number(),
})
export type Seat = z.infer<typeof SeatSchema>
