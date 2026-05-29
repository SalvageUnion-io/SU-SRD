import { z } from 'zod'
import { ItemConditionMapSchema } from './mech'

/**
 * classRef: slug reference to a class in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 */
export const PilotSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    callsign: z.string(),
    /** Slug reference to a Pilot Class in salvageunion-reference */
    classRef: z.string(),
    /** Slugs of class abilities selected for this pilot */
    abilities: z.array(z.string()),
    /** Slugs of equipment items carried */
    equipment: z.array(z.string()),
    /** Freeform roll result strings (injury table, etc.) */
    rollResults: z.array(z.string()),
    motto: z.string(),
    keepsake: z.string(),
    appearance: z.string(),
    background: z.string().default(''),
    /** Active condition slugs */
    conditions: z.array(z.string()),
    /** Optional: links this pilot to a workspace */
    workspaceId: z.string().optional(),
    // ---------------------------------------------------------------------------
    // Live-play current stat tracking (#245).
    // These are current values for the active session — separate from any
    // class/rules defaults. When absent the sheet falls back to 0.
    // TODO: source base value from rules once pilot class data exposes HP/AP.
    // ---------------------------------------------------------------------------
    /** Current hit points */
    currentHP: z.number().int().min(0).optional(),
    /** Current action points */
    currentAP: z.number().int().min(0).optional(),
    /**
     * Per-equipment condition map (REQ-011 #240). Keyed by equipment slug.
     * When absent or key missing, the display layer defaults to 'intact'.
     */
    equipmentConditions: ItemConditionMapSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Pilot = z.infer<typeof PilotSchema>
