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
 * per-seat state. The action being resolved joins the seat with the display
 * tabs layer, as an optional field.
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

export const SeatSchema = z.object({
  /** The Game's Convex id. */
  gameId: z.string().min(1),
  /** The pilot's app id. */
  pilotId: z.string().min(1),
  mount: SeatMountSchema,
  range: RangeBandSchema,
  /** Refs of the activated contributions that are switched on (ADR-029 §4). */
  activeEffects: z.array(z.string()),
  updatedAt: z.number(),
})
