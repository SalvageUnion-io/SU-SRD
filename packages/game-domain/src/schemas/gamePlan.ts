import { z } from 'salvageunion-reference/zod'

/**
 * A Game's plan: the Mediator's own notes for the campaign and its sessions
 * as a dated list ([ADR-067](../../../../docs/ARCHITECTURE.md#decisions) §4).
 * Layer 1 of the campaign planner, Game > sessions > scenes > an optional
 * encounter: a session's `scenes` are in the shape now so a later layer adds
 * its screens without a migration, and nothing draws them yet.
 *
 * Kept in the Game's room, read and written by its Mediator alone; a player
 * never receives it. The sessions (their days and titles) are the Game's;
 * the notes are their author's (`StoredGamePlanSchema`), so a Mediator reads
 * only what they wrote themselves, and a hand over shows the next one none.
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

/** One author's notes: the Game's, and each session's by the session's id. */
const AuthorNotesSchema = z
  .object({
    notes: z.string().max(GAME_PLAN_MAX_NOTES),
    sessions: z.record(z.string(), z.string().max(GAME_PLAN_MAX_SESSION_NOTE)),
  })
  .strict()

/**
 * The plan as the room keeps it (ADR-067 §4, as amended): the plan, plus whose
 * notes are whose. Both additions are optional, so a row written before them
 * reads unchanged: its `notes` and each session's `note` are `author`'s, and
 * with no `author` they are whoever runs the table's.
 */
export const StoredGamePlanSchema = GamePlanSchema.extend({
  /** Whose the plan's own `notes` and `note`s are: the rows written before notes had authors. */
  author: z.string().min(1).optional(),
  /** Every other note, by the Discord id of the member who wrote it. */
  byAuthor: z.record(z.string(), AuthorNotesSchema).optional(),
}).strict()

export type StoredGamePlan = z.infer<typeof StoredGamePlanSchema>

/** The plan one author reads: the Game's sessions, and only their own notes. */
export function planFor(stored: StoredGamePlan, author: string): GamePlan {
  const mine = stored.byAuthor?.[author]
  const legacy = mine === undefined && (stored.author ?? author) === author
  return {
    schemaVersion: 1,
    notes: mine?.notes ?? (legacy ? stored.notes : ''),
    sessions: stored.sessions.map((session) => ({
      ...session,
      note: mine?.sessions[session.id] ?? (legacy ? session.note : ''),
    })),
  }
}

/**
 * The stored plan after `author` saves `plan`: the sessions become the ones
 * saved, the notes are filed under their author, and nobody else's are touched
 * (but a note for a session that is gone goes with it).
 */
export function planWith(stored: StoredGamePlan, author: string, plan: GamePlan): StoredGamePlan {
  const owner = stored.author ?? author
  const byAuthor: Record<string, z.infer<typeof AuthorNotesSchema>> = { ...stored.byAuthor }
  // Notes kept before they had authors move under whoever they belong to.
  if (owner !== author && byAuthor[owner] === undefined) byAuthor[owner] = notesOf(stored)
  byAuthor[author] = notesOf(plan)
  const kept = new Set(plan.sessions.map((session) => session.id))
  for (const [id, notes] of Object.entries(byAuthor)) {
    byAuthor[id] = {
      notes: notes.notes,
      sessions: Object.fromEntries(Object.entries(notes.sessions).filter(([s]) => kept.has(s))),
    }
  }
  return {
    schemaVersion: 1,
    notes: '',
    sessions: plan.sessions.map((session) => ({ ...session, note: '' })),
    author: owner,
    byAuthor,
  }
}

function notesOf(plan: GamePlan): z.infer<typeof AuthorNotesSchema> {
  return {
    notes: plan.notes,
    sessions: Object.fromEntries(
      plan.sessions.filter((session) => session.note !== '').map((s) => [s.id, s.note])
    ),
  }
}

/**
 * The session days from `from` on, soonest first: all a member who does not
 * run the table is told of the plan (never a title or a note).
 */
export function sessionDaysFrom(plan: GamePlan, from: string, most = 5): string[] {
  return plan.sessions
    .flatMap((session) =>
      session.date !== undefined && session.date >= from ? [session.date] : []
    )
    .sort()
    .slice(0, most)
}
