import { z } from 'salvageunion-reference/zod'
import { EncounterNpcSchema } from './encounterNpc'

/**
 * Encounter — one piece of a Mediator's prep (ADR-059): the opposition, the
 * roll tables to hand and private notes, built on the owner's shelf before a
 * Game sits down and run into a Game's Opposition when the fight starts.
 *
 * Always its maker's and only on a shelf: it is never moved into a Game.
 * Running one copies its opposition into the Game's tray as fresh
 * `encounterNpcs` and its tables and notes into the Game's running encounter
 * (`RunningEncounterSchema`), so the shelf copy stays as it was built.
 */

/** The most opposition one encounter holds; a fight bigger than this is two. */
export const ENCOUNTER_MAX_OPPOSITION = 40
/** The most roll tables one encounter pins. */
export const ENCOUNTER_MAX_TABLES = 12
/** How long an encounter's notes may run. */
export const ENCOUNTER_MAX_NOTES = 10_000
/** How long an encounter's name may run. */
export const ENCOUNTER_MAX_NAME = 80
/** How long the briefing may run: one alert to the table, not a chapter. */
export const ENCOUNTER_MAX_BRIEFING = 1_000
/** The most groups one encounter splits its opposition into. */
export const ENCOUNTER_MAX_GROUPS = 12
/** How long a group's name may run. */
export const ENCOUNTER_MAX_GROUP_NAME = 40
/** The waves an encounter can field: the first, and two held back. */
export const ENCOUNTER_MAX_WAVE = 3

/**
 * One opponent as the encounter keeps it: the tray NPC it becomes, without
 * the live state (HP, conditions, rolls) a fight gives it. Running the
 * encounter starts each one at its `maxHp`.
 */
const EncounterOpponentSchema = EncounterNpcSchema.pick({
  refSchema: true,
  refSlug: true,
  refName: true,
  refPattern: true,
  userPattern: true,
  name: true,
  maxHp: true,
  statKind: true,
})
  .extend({
    /** The opponent's own id inside the encounter, so a row can be renamed or removed. */
    id: z.string(),
    /** The group it fights in, one of the encounter's `groups`; absent, it fights alone. */
    groupId: z.string().optional(),
  })
  .strict()

export type EncounterOpponent = z.infer<typeof EncounterOpponentSchema>

/**
 * A group: opponents who meet the Pilots together, so roll one Reaction and
 * check Morale as one when half of them fall (Core Book p.267-268). Its wave
 * says when it arrives: 1 with the encounter, 2 or 3 held back until the
 * Mediator brings it in.
 */
const EncounterGroupSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(ENCOUNTER_MAX_GROUP_NAME),
    wave: z.number().int().min(1).max(ENCOUNTER_MAX_WAVE),
  })
  .strict()

export type EncounterGroup = z.infer<typeof EncounterGroupSchema>

/** The briefing: what the Pilots see when it starts, for the Mediator to tell the table. */
const BriefingSchema = z.string().max(ENCOUNTER_MAX_BRIEFING)

/** The tables an encounter pins, by their names in the reference data (as Play pins them). */
const TablesSchema = z.array(z.string().min(1)).max(ENCOUNTER_MAX_TABLES)

/** The notes: the Mediator's own, never shown to players. */
const NotesSchema = z.string().max(ENCOUNTER_MAX_NOTES)

/** The name, trimmed and never blank. */
const NameSchema = z.string().trim().min(1).max(ENCOUNTER_MAX_NAME)

export const EncounterSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: NameSchema,
    opposition: z.array(EncounterOpponentSchema).max(ENCOUNTER_MAX_OPPOSITION),
    tables: TablesSchema,
    notes: NotesSchema,
    /** Absent on encounters built before groups; read as none. */
    groups: z.array(EncounterGroupSchema).max(ENCOUNTER_MAX_GROUPS).optional(),
    /** Absent on encounters built before briefings; read as blank. */
    briefing: BriefingSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((encounter, ctx) => {
    const groups = new Set((encounter.groups ?? []).map((g) => g.id))
    encounter.opposition.forEach((opponent, i) => {
      if (opponent.groupId !== undefined && !groups.has(opponent.groupId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['opposition', i, 'groupId'],
          message: "An opponent can only join one of the encounter's groups",
        })
      }
    })
  })

export type Encounter = z.infer<typeof EncounterSchema>

/**
 * The encounter a Game is running: what the Mediator's Play shows beside the
 * Opposition, copied from the shelf encounter when it was run. One per Game,
 * and like the tray, the Mediator's alone.
 */
export const RunningEncounterSchema = z
  .object({
    /** The shelf encounter it was run from; it may since have changed or gone. */
    encounterId: z.string(),
    name: NameSchema,
    tables: TablesSchema,
    notes: NotesSchema,
    /** Copied when run; absent or blank, there is nothing to tell the table. */
    briefing: BriefingSchema.optional(),
    /** Its groups, copied when run, so a held-back wave can be named and brought in. */
    groups: z.array(EncounterGroupSchema).max(ENCOUNTER_MAX_GROUPS).optional(),
    /**
     * The opposition held back to a later wave, not yet on the tray: each
     * joins it when the Mediator brings its wave in (`mediator.bringInWave`).
     */
    held: z.array(EncounterOpponentSchema).max(ENCOUNTER_MAX_OPPOSITION).optional(),
    startedAt: z.string().datetime(),
  })
  .strict()

export type RunningEncounter = z.infer<typeof RunningEncounterSchema>
