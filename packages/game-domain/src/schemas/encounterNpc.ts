import { z } from 'salvageunion-reference/zod'
import { containerFields } from './entity'

/**
 * EncounterNpc — one tracked NPC instance on the GM encounter tray.
 * Persisted like every entity: the `encounterNpcs` Convex
 * table when signed in, nowhere when not;
 * container-scoped via the nullable `gameId` (ADR-030 §2).
 *
 * The record stores a SLUG reference into salvageunion-reference (data
 * conventions: slugs, never UUIDs) plus the frozen add-time stats it needs to
 * run live (maxHp/statKind), so the tray keeps working even if the reference
 * lookup drifts. Multiple instances of the same reference NPC are expected —
 * each instance is its own record with its own name/HP/conditions.
 */

/** The reference schemas an encounter-tray NPC can be drawn from. */
export const ENCOUNTER_REF_SCHEMAS = [
  'npcs',
  'chassis',
  'squads',
  'creatures',
  'bio-titans',
  'vehicles',
  'meld',
  'drones',
] as const
const EncounterRefSchemaSchema = z.enum(ENCOUNTER_REF_SCHEMAS)

/**
 * The Mediator tables the tray can roll: Reaction, Morale and Retreat
 * (Workshop Manual p.268), and for an important NPC (p.255) its Critical
 * Damage or Critical Injury at 0 and a mech's Heat Check.
 */
const MediatorTableIdSchema = z.enum([
  'reaction',
  'morale',
  'retreat',
  'critical-damage',
  'critical-injury',
  'heat-check',
])

/**
 * Recorded result of a Mediator table roll (Reaction / Morale / Retreat).
 * Snapshot-safe plain data — same shape discipline as the mech's
 * HeatCheckResult. `label`/`value` are copied verbatim from the reference
 * roll-table entry at roll time.
 */
export const MediatorRollResultSchema = z
  .object({
    table: MediatorTableIdSchema,
    roll: z.number().int().min(1).max(20),
    /** Band label from the table entry (e.g. 'Friendly'), when present. */
    label: z.string().optional(),
    /** Full outcome text from the table entry. */
    value: z.string(),
    /** ISO timestamp of when this result was rolled. */
    rolledAt: z.string().datetime(),
  })
  .strict()

export const EncounterNpcSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    ...containerFields,

    /** Which reference schema the NPC came from. */
    refSchema: EncounterRefSchemaSchema,
    /** Slug reference into salvageunion-reference (never a UUID). */
    refSlug: z.string(),
    /** Reference entity name at add time — display fallback if lookup drifts. */
    refName: z.string(),
    /**
     * Slug of the host's pattern it was drawn as (a chassis's mech pattern, a
     * Bio-Titan's variant), when one was picked; absent for the bare entity.
     */
    refPattern: z.string().optional(),
    /**
     * A saved mech pattern it was drawn as (the Mediator's own, or one shared
     * with the Game's crew), copied at add time: the tray keeps it however
     * its maker later edits, unshares or deletes it. `refSlug` is its chassis.
     */
    userPattern: z
      .object({
        name: z.string().min(1),
        systems: z.array(z.string()),
        modules: z.array(z.string()),
      })
      .strict()
      .optional(),

    /** Instance label (defaults to the reference name; e.g. 'Raider 2'). */
    name: z.string(),

    /** Current HP/SP (whichever `statKind` says this NPC tracks). */
    currentHp: z.number().int().min(0),
    /** Max HP/SP captured from the reference entity at add time. */
    maxHp: z.number().int().min(0),
    /** Whether the track is Hit Points (organic) or Structure Points (mech-scale). */
    statKind: z.enum(['hp', 'sp']),

    /** Freeform condition ticks the table has established (add/remove). */
    conditions: z.array(z.string()),

    /**
     * Set once a downed wreck is salvaged or scrapped (Core Book pp.246, 248):
     * what was left of it is destroyed, so it cannot be salvaged twice.
     */
    salvaged: z.boolean().optional(),

    /** Last Mediator table roll recorded against this NPC. */
    lastMediatorRoll: MediatorRollResultSchema.optional(),

    /**
     * An important NPC (Workshop Manual p.254-255): the Mediator tracks more
     * of it. A mech also tracks EP and Heat, frozen from its chassis when it
     * was marked, and any of them may roll its Critical table at 0.
     */
    important: z.boolean().optional(),
    currentEp: z.number().int().min(0).optional(),
    maxEp: z.number().int().min(0).optional(),
    currentHeat: z.number().int().min(0).optional(),
    heatCap: z.number().int().min(0).optional(),
    /** Its last Critical roll or Heat Check, kept apart from its Morale. */
    lastImportantRoll: MediatorRollResultSchema.optional(),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type EncounterNpc = z.infer<typeof EncounterNpcSchema>
