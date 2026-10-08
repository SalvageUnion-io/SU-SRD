import { z } from 'salvageunion-reference/zod'

/**
 * A pilot's seat at a Game: the Dashboard's play state, shared with the crew
 * and saved on the Game
 * ([ADR-038](../../../../../docs/ARCHITECTURE.md#adr-038) §2).
 *
 * One seat per pilot, not per member: a member covering for an absent player
 * runs two. A seat points at its pilot and boarded mech by app id, the way
 * soft-link ends do, and is never a field on either record. That keeps mount
 * state out of sheets and public sheets.
 *
 * This is the source of truth for `seats` in `convex/schema.ts`, whose unions
 * mirror the enums below; `test/convex/seatSchemaParity.test.ts` keeps them in
 * step.
 *
 * "In Downtime" is deliberately absent: it is the Game's `downtime` row, not
 * per-seat state. The deck action being resolved is on it, as an optional
 * field, so a reload mid-roll keeps the roll and the crew watches it live.
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

export const SeatSchema = z.object({
  /** The Game's Convex id. */
  gameId: z.string().min(1),
  /** The pilot's app id. */
  pilotId: z.string().min(1),
  mount: SeatMountSchema,
  range: RangeBandSchema,
  /** Refs of the activated contributions that are switched on (ADR-029 §4). */
  activeEffects: z.array(z.string()),
  /** The deck action being resolved; absent when none is. */
  resolving: SeatResolvingSchema.optional(),
  updatedAt: z.number(),
})
