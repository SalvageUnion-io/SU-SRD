import { z } from 'salvageunion-reference/zod'

/**
 * A Game's plan: the Mediator's own notes for the campaign and its sessions
 * as a dated list ([ADR-067](../../../../docs/ARCHITECTURE.md#decisions) §4).
 * Layer 1 of the campaign planner, Game > sessions > scenes > an optional
 * encounter: a session's `scenes` are in the shape now so a later layer adds
 * its screens without a migration, and nothing draws them yet.
 *
 * Kept in the Game's room, read and written by its Mediator alone; a player
 * never receives it.
 */

/** How long the Game's notes may run. */
export const GAME_PLAN_MAX_NOTES = 20_000
/** How long one session's note may run. */
export const GAME_PLAN_MAX_SESSION_NOTE = 10_000
/** How long a session's or a scene's title may run. */
export const GAME_PLAN_MAX_TITLE = 120
/** The most sessions one Game lists. */
export const GAME_PLAN_MAX_SESSIONS = 200
/** The most scenes one session holds. */
const GAME_PLAN_MAX_SCENES = 50
/** How long a Game's description may run: a line or two on the invite. */
export const GAME_MAX_DESCRIPTION = 280

/** A calendar day, `YYYY-MM-DD`: when the session is, in nobody's time zone. */
const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** A scene of a session: a beat the Mediator plans, around an encounter or not. */
const PlanSceneSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().max(GAME_PLAN_MAX_TITLE),
    note: z.string().max(GAME_PLAN_MAX_SESSION_NOTE).optional(),
    /** One of the Mediator's encounters, by id; it may since have gone. */
    encounterId: z.string().min(1).optional(),
  })
  .strict()

const PlanSessionSchema = z
  .object({
    id: z.string().min(1),
    date: DaySchema.optional(),
    title: z.string().max(GAME_PLAN_MAX_TITLE).optional(),
    /** The Mediator's private note for the session. */
    note: z.string().max(GAME_PLAN_MAX_SESSION_NOTE),
    scenes: z.array(PlanSceneSchema).max(GAME_PLAN_MAX_SCENES).optional(),
  })
  .strict()

export type PlanSession = z.infer<typeof PlanSessionSchema>

export const GamePlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    notes: z.string().max(GAME_PLAN_MAX_NOTES),
    sessions: z.array(PlanSessionSchema).max(GAME_PLAN_MAX_SESSIONS),
  })
  .strict()

export type GamePlan = z.infer<typeof GamePlanSchema>

/** A Game nobody has planned yet. */
export const EMPTY_GAME_PLAN: GamePlan = { schemaVersion: 1, notes: '', sessions: [] }
