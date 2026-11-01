import { z } from 'salvageunion-reference/zod'

/**
 * The vocabulary of a pilot's seat, whose rows the rooms keep (`rooms/seats.ts`).
 *
 * A seat is a pilot's play state, in a Game (shared with the crew and saved on
 * the Game, [ADR-038](../../../../docs/adr/038-dashboard-game-surface.md) §2)
 * or solo, on its owner's shelf (Play's solo screen).
 *
 * One seat per pilot, not per member: a member covering for an absent player
 * runs two. A seat points at its pilot and boarded mech by app id, the way
 * soft-link ends do, and is never a field on either record. That keeps mount
 * state out of sheets and public sheets.
 *
 * A Game seat has no "in Downtime": that is the Game's Downtime row. A solo
 * seat runs its own, since nobody else is at the table. The deck action being
 * resolved is on it, so a reload mid-roll keeps the roll and the crew watches
 * it live.
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
export const SeatResolvingSchema = z.object({
  ref: z.string().min(1),
  name: z.string(),
  activated: z.boolean(),
  roll: z.object({ roll: z.number(), band: z.enum(CORE_ROLL_BAND_NAMES) }).optional(),
  /**
   * An Area Salvage's roll, which reads its own table rather than the Core
   * Mechanic (p.248), with the Tech Level of the area its Supply was spent on.
   */
  salvage: z
    .object({ roll: z.number().int().min(1).max(20), areaTl: z.number().int().min(1).max(6) })
    .optional(),
  applied: z.boolean(),
})
export type SeatResolving = z.infer<typeof SeatResolvingSchema>
