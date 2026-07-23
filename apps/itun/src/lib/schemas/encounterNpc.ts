import { z } from 'salvageunion-reference/zod'

/**
 * EncounterNpc — one tracked NPC instance on the GM encounter tray
 * (design-review R-5). Local-first like everything else: persisted to its own
 * IndexedDB object store (`encounterNpcs`), workspace-scoped via the optional
 * `workspaceId`, no backend.
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
  'squads',
  'creatures',
  'bio-titans',
  'vehicles',
  'meld',
] as const
export const EncounterRefSchemaSchema = z.enum(ENCOUNTER_REF_SCHEMAS)
export type EncounterRefSchema = z.infer<typeof EncounterRefSchemaSchema>

/** The three Mediator tables the tray can roll (Workshop Manual p.268). */
export const MediatorTableIdSchema = z.enum(['reaction', 'morale', 'retreat'])
export type MediatorTableId = z.infer<typeof MediatorTableIdSchema>

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
export type MediatorRollResult = z.infer<typeof MediatorRollResultSchema>

export const EncounterNpcSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    /** Workspace this tracked NPC belongs to; absent = unassigned. */
    workspaceId: z.string().optional(),

    /** Which reference schema the NPC came from. */
    refSchema: EncounterRefSchemaSchema,
    /** Slug reference into salvageunion-reference (never a UUID). */
    refSlug: z.string(),
    /** Reference entity name at add time — display fallback if lookup drifts. */
    refName: z.string(),

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

    /** Last Mediator table roll recorded against this NPC. */
    lastMediatorRoll: MediatorRollResultSchema.optional(),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type EncounterNpc = z.infer<typeof EncounterNpcSchema>
