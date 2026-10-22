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
  })
  .strict()

export type EncounterOpponent = z.infer<typeof EncounterOpponentSchema>

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
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

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
    startedAt: z.string().datetime(),
  })
  .strict()

export type RunningEncounter = z.infer<typeof RunningEncounterSchema>
