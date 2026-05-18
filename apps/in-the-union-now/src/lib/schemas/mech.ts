import { z } from 'zod'

/**
 * chassisRef: slug reference to a Chassis in salvageunion-reference.
 * Resolution against game data is handled at the presentation/query layer.
 */
export const MechSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.literal(1),
    name: z.string(),
    /** Slug reference to a Chassis in salvageunion-reference */
    chassisRef: z.string(),
    /** Slugs of mech system items installed */
    systems: z.array(z.string()),
    /** Slugs of mech module items installed */
    modules: z.array(z.string()),
    /** Slugs of cargo items carried in the mech */
    cargo: z.array(z.string()),
    /** Optional: name of the paint/visual pattern applied */
    patternName: z.string().optional(),
    /** Active condition slugs */
    conditions: z.array(z.string()),
    /** Optional: links this mech to a workspace */
    workspaceId: z.string().optional(),
    // ---------------------------------------------------------------------------
    // Live-play current stat tracking (Wave 6, #199).
    // These are current values for the active session — separate from the chassis
    // defaults shown in MechSheet. When absent the sheet falls back to chassis
    // defaults as the display value; when set they represent the mech's current
    // live state (damage taken, resources spent, etc.).
    // ---------------------------------------------------------------------------
    /** Current hull/structure points (falls back to chassis structurePoints) */
    currentHP: z.number().int().min(0).optional(),
    /** Current action points */
    currentAP: z.number().int().min(0).optional(),
    /** Current tech points */
    currentTP: z.number().int().min(0).optional(),
    /** Current structure points */
    currentSP: z.number().int().min(0).optional(),
    /** Current energy points (falls back to chassis energyPoints) */
    currentEP: z.number().int().min(0).optional(),
    /** Current heat level (falls back to chassis heatCapacity) */
    currentHeat: z.number().int().min(0).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type Mech = z.infer<typeof MechSchema>
